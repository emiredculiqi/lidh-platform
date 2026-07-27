import { describe, it, expect } from "vitest";
import {
  resolveEntitlements,
  GRACE_DAYS,
  type EntitlementInput,
} from "./entitlements";

const DAY = 86_400_000;
// Fixed clock so every case is deterministic (no real `new Date()`).
const NOW = new Date("2026-07-26T12:00:00.000Z");
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

/** Resolve against the fixed NOW, with sensible active-tenant defaults. */
function resolve(input: Partial<EntitlementInput>, now: Date = NOW) {
  return resolveEntitlements(
    { status: "active", trialEndsAt: null, planId: null, ...input },
    { now },
  );
}

describe("resolveEntitlements — the state table", () => {
  it("trialing: trial in the future → full Premium, WhatsApp on", () => {
    const e = resolve({ trialEndsAt: at(20) });
    expect(e.state).toBe("trialing");
    expect(e.chatEnabled).toBe(true);
    expect(e.whatsappEnabled).toBe(true);
    expect(e.dashboard).toBe("full");
  });

  it("grace: trial ended 2 days ago (< 3-day grace) → still serving, warned", () => {
    const e = resolve({ trialEndsAt: at(-2) });
    expect(e.state).toBe("grace");
    expect(e.chatEnabled).toBe(true);
    expect(e.whatsappEnabled).toBe(true);
    expect(e.dashboard).toBe("full");
  });

  it("expired: trial ended 10 days ago, never paid → frozen + read-only", () => {
    const e = resolve({ trialEndsAt: at(-10) });
    expect(e.state).toBe("expired");
    expect(e.chatEnabled).toBe(false);
    expect(e.whatsappEnabled).toBe(false);
    expect(e.dashboard).toBe("read_only");
  });

  it("subscribed Basic: web works, WhatsApp stays OFF (the Premium hook)", () => {
    const e = resolve({ planId: "basic", subscribedPlanHasWhatsApp: false });
    expect(e.state).toBe("subscribed");
    expect(e.chatEnabled).toBe(true);
    expect(e.whatsappEnabled).toBe(false);
    expect(e.dashboard).toBe("full");
  });

  it("subscribed Premium: everything on", () => {
    const e = resolve({ planId: "premium", subscribedPlanHasWhatsApp: true });
    expect(e.state).toBe("subscribed");
    expect(e.chatEnabled).toBe(true);
    expect(e.whatsappEnabled).toBe(true);
    expect(e.dashboard).toBe("full");
  });

  it("archived: hard off, no dashboard", () => {
    const e = resolve({ status: "archived", trialEndsAt: at(20) });
    expect(e.state).toBe("archived");
    expect(e.chatEnabled).toBe(false);
    expect(e.whatsappEnabled).toBe(false);
    expect(e.dashboard).toBe("none");
  });
});

describe("resolveEntitlements — precedence", () => {
  it("archived beats a paid plan", () => {
    const e = resolve({
      status: "archived",
      planId: "premium",
      subscribedPlanHasWhatsApp: true,
    });
    expect(e.state).toBe("archived");
    expect(e.dashboard).toBe("none");
  });

  it("a plan beats a (defensive) leftover trial timestamp", () => {
    // grantPlan clears trialEndsAt, but never trust it: planId must win.
    const e = resolve({ planId: "basic", trialEndsAt: at(20) });
    expect(e.state).toBe("subscribed");
  });
});

describe("resolveEntitlements — grace boundaries", () => {
  it("exactly at trialEndsAt → grace begins (not trialing)", () => {
    const trialEndsAt = at(-1);
    const e = resolve({ trialEndsAt }, trialEndsAt); // now === trialEndsAt
    expect(e.state).toBe("grace");
  });

  it("1ms before grace ends → still grace", () => {
    const trialEndsAt = at(-GRACE_DAYS);
    const justInside = new Date(
      trialEndsAt.getTime() + GRACE_DAYS * DAY - 1,
    );
    expect(resolve({ trialEndsAt }, justInside).state).toBe("grace");
  });

  it("exactly at grace end → frozen (expired)", () => {
    const trialEndsAt = at(-GRACE_DAYS);
    const graceEnd = new Date(trialEndsAt.getTime() + GRACE_DAYS * DAY);
    expect(resolve({ trialEndsAt }, graceEnd).state).toBe("expired");
  });

  it("graceEndsAt = trialEndsAt + GRACE_DAYS while trialing", () => {
    const trialEndsAt = at(20);
    const e = resolve({ trialEndsAt });
    expect(e.graceEndsAt?.getTime()).toBe(
      trialEndsAt.getTime() + GRACE_DAYS * DAY,
    );
  });

  it("honors a custom graceDays option", () => {
    const trialEndsAt = at(-2);
    // With a 1-day grace, being 2 days past the trial is already frozen.
    const e = resolveEntitlements(
      { status: "active", trialEndsAt, planId: null },
      { now: NOW, graceDays: 1 },
    );
    expect(e.state).toBe("expired");
  });
});

describe("resolveEntitlements — WhatsApp gate on subscribed plans", () => {
  it("defaults WhatsApp OFF when the flag is omitted (fail safe)", () => {
    const e = resolve({ planId: "basic" }); // no subscribedPlanHasWhatsApp
    expect(e.whatsappEnabled).toBe(false);
  });

  it("a per-tenant WhatsApp gift on Basic turns it on", () => {
    // Simulates planOverrides.hasWhatsApp = true resolved by the caller.
    const e = resolve({ planId: "basic", subscribedPlanHasWhatsApp: true });
    expect(e.whatsappEnabled).toBe(true);
  });
});

describe("resolveEntitlements — fail safe", () => {
  it("no plan and no trial → frozen, never silently free", () => {
    const e = resolve({ trialEndsAt: null, planId: null });
    expect(e.state).toBe("expired");
    expect(e.chatEnabled).toBe(false);
    expect(e.dashboard).toBe("read_only");
  });
});

describe("GRACE_DAYS", () => {
  it("is 3 (the locked soft-grace decision)", () => {
    expect(GRACE_DAYS).toBe(3);
  });
});
