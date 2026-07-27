/**
 * Tenant entitlements — the single source of truth for "what is this tenant
 * allowed to do RIGHT NOW?".
 *
 * Everything here is DERIVED synchronously from three stored fields
 * (`status`, `trialEndsAt`, `planId`) plus the clock. There is deliberately
 * NO materialized "expired" status and NO background job that flips tenants
 * off: the instant the grace window passes, the very next request sees the
 * tenant as frozen. Two consequences we want:
 *
 *   - Enforcement can never be stale (no "expired but the nightly job hasn't
 *     run yet" window).
 *   - Enforcement never depends on the scheduler. The cron exists only to
 *     *remind* the owner — a separate concern that can fail without ever
 *     letting a lapsed trial keep serving for free.
 *
 * The one boolean `isTenantActive()` we had before answered only "serve or
 * not". That is too coarse for the model: a downgraded-to-Basic tenant is
 * fully active yet must lose WhatsApp; an expired tenant must keep read-only
 * dashboard access to review their data. So this returns the full picture and
 * every enforcement point reads the column it cares about.
 *
 * See ADR-017.
 */

import type { PrismaClient } from "@lidh/db";

/** Soft-grace window (days) after `trialEndsAt` before a tenant is frozen. */
export const GRACE_DAYS = 3;

const DAY_MS = 86_400_000;

export type EntitlementState =
  | "trialing" // trial running → full Premium
  | "grace" // trial lapsed, still inside the soft window → still Premium, warned
  | "expired" // past grace, never subscribed → frozen (read-only, channels silent)
  | "subscribed" // has a paid plan (currently a permanent grant)
  | "archived"; // admin kill switch (ADR-008) → hard off

export interface Entitlements {
  state: EntitlementState;
  /** Web widget + funnel page may respond. */
  chatEnabled: boolean;
  /** WhatsApp inbound may be auto-answered AND any WhatsApp outbound may send. */
  whatsappEnabled: boolean;
  /**
   * How the dashboard behaves:
   *   full      — normal operate + configure
   *   read_only — can view leads/contacts/conversations/usage; every mutation
   *               is rejected (subscription_required). This is the "frozen but
   *               not locked out" state.
   *   none      — no access at all (archived).
   */
  dashboard: "full" | "read_only" | "none";
  /**
   * When the freeze actually happens (`trialEndsAt` + grace). Handy for
   * countdown banners and reminder scheduling. `null` when the tenant is not
   * on a trial (subscribed / archived / never trialed).
   */
  graceEndsAt: Date | null;
}

export interface EntitlementInput {
  /** Tenant.status — "active" | "archived". */
  status: string;
  /** Tenant.trialEndsAt — `null` once subscribed, or if never trialed. */
  trialEndsAt: Date | null;
  /** Tenant.planId — set ⇒ subscribed (a currently-permanent grant). */
  planId: string | null;
  /**
   * Whether the tenant's OWN subscribed plan grants WhatsApp (Basic → false,
   * Premium → true), with any per-tenant `planOverrides.hasWhatsApp` gift
   * already applied by the caller. Consulted ONLY when the tenant is
   * `subscribed`. During a trial WhatsApp is always on (trial = full Premium,
   * ADR-017), so this field is ignored for trial/grace. Defaults to `false`
   * (fail safe: absent info never unlocks WhatsApp).
   */
  subscribedPlanHasWhatsApp?: boolean;
}

export interface EntitlementOptions {
  /** Clock override. Defaults to the real `new Date()`. Injectable for tests. */
  now?: Date;
  /** Soft-grace window. Defaults to {@link GRACE_DAYS}. */
  graceDays?: number;
}

const OFF = { chatEnabled: false, whatsappEnabled: false } as const;

/**
 * Resolve a tenant's live entitlements. Pure: no DB, no side effects — the
 * caller loads the tenant (and, when subscribed, the plan's WhatsApp flag) and
 * passes plain data in. Precedence, high → low: archived, subscribed, trial.
 */
export function resolveEntitlements(
  input: EntitlementInput,
  opts: EntitlementOptions = {},
): Entitlements {
  const now = opts.now ?? new Date();
  const graceDays = opts.graceDays ?? GRACE_DAYS;

  // 1. Archived wins over everything — an admin explicitly paused this tenant
  //    (ADR-008). Even a valid trial or paid plan does not un-pause it.
  if (input.status === "archived") {
    return { state: "archived", ...OFF, dashboard: "none", graceEndsAt: null };
  }

  // 2. Subscribed. `grantPlan()` clears `trialEndsAt`, so plan and trial are
  //    mutually exclusive — but if both were ever set, the plan wins (they're
  //    paying). No `planExpiresAt` yet, so a plan is a permanent grant until an
  //    admin revokes it (real billing cycles land in M3).
  if (input.planId) {
    return {
      state: "subscribed",
      chatEnabled: true,
      whatsappEnabled: input.subscribedPlanHasWhatsApp === true,
      dashboard: "full",
      graceEndsAt: null,
    };
  }

  // 3. Trial lifecycle. Everything below needs a trial timestamp to reason.
  if (input.trialEndsAt) {
    const trialEnd = input.trialEndsAt.getTime();
    const graceEnd = trialEnd + graceDays * DAY_MS;
    const t = now.getTime();

    // 3a. Trial still running → full Premium (WhatsApp included).
    if (t < trialEnd) {
      return {
        state: "trialing",
        chatEnabled: true,
        whatsappEnabled: true,
        dashboard: "full",
        graceEndsAt: new Date(graceEnd),
      };
    }

    // 3b. Grace: trial lapsed but inside the soft window. Keep serving Premium
    //     so a live customer conversation doesn't die mid-sentence; the
    //     dashboard stays full but the UI warns and reminders escalate.
    if (t < graceEnd) {
      return {
        state: "grace",
        chatEnabled: true,
        whatsappEnabled: true,
        dashboard: "full",
        graceEndsAt: new Date(graceEnd),
      };
    }

    // 3c. Past grace, never subscribed → FROZEN. Channels go silent; the
    //     dashboard drops to read-only so the owner can still review the leads
    //     and conversations they collected. This is the "choose a plan" wall.
    return {
      state: "expired",
      ...OFF,
      dashboard: "read_only",
      graceEndsAt: new Date(graceEnd),
    };
  }

  // 4. No plan AND no trial. Shouldn't happen — every tenant is born with a
  //    30-day trial — but fail SAFE, not open: freeze rather than silently
  //    serving for free.
  return { state: "expired", ...OFF, dashboard: "read_only", graceEndsAt: null };
}

/** The minimal Tenant fields the loader needs (a subset of the Prisma row). */
export interface TenantBillingFields {
  status: string;
  trialEndsAt: Date | null;
  planId: string | null;
  planOverrides: unknown;
}

/**
 * DB-backed adapter over {@link resolveEntitlements}. The pure resolver decides
 * everything; this only fetches the ONE fact it can't derive from the tenant
 * row — whether a *subscribed* tenant's plan grants WhatsApp — and only when
 * the tenant actually has a plan (trial / grace / expired / archived need no
 * query at all). A per-tenant `planOverrides.hasWhatsApp` gift wins over the
 * plan's flag (mirrors ChannelsService.effectiveWhatsAppFeature).
 */
export async function loadTenantEntitlements(
  db: PrismaClient,
  tenant: TenantBillingFields,
  opts: EntitlementOptions = {},
): Promise<Entitlements> {
  let subscribedPlanHasWhatsApp = false;
  if (tenant.planId) {
    const override = (tenant.planOverrides as { hasWhatsApp?: boolean } | null)
      ?.hasWhatsApp;
    if (typeof override === "boolean") {
      subscribedPlanHasWhatsApp = override;
    } else {
      const plan = await db.plan.findUnique({
        where: { id: tenant.planId },
        select: { features: true },
      });
      const features = plan?.features;
      subscribedPlanHasWhatsApp =
        !!features &&
        typeof features === "object" &&
        (features as Record<string, unknown>).hasWhatsApp === true;
    }
  }
  return resolveEntitlements(
    {
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
      planId: tenant.planId,
      subscribedPlanHasWhatsApp,
    },
    opts,
  );
}
