"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/api-core";

/**
 * Funnel panel on the tenant overview page. Shows the permanent funnel URL,
 * the lifecycle state (trial / paid / inactive / archived) with a countdown,
 * and admin actions to extend the trial or grant a paid plan.
 *
 * Plan picker is intentionally minimal — admin pastes a Plan id (from the
 * Plan table) since there's no UI to manage plans yet. When the Plans admin
 * UI lands, swap the input for a Select bound to GET /v1/plans.
 */
export function FunnelPanel({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Compute the trial countdown server-side-style: same Date logic both sides.
  const trialMs = tenant.trialEndsAt
    ? new Date(tenant.trialEndsAt).getTime() - Date.now()
    : null;
  const trialDays = trialMs != null ? Math.ceil(trialMs / 86_400_000) : null;
  const trialActive = trialMs != null && trialMs > 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(tenant.funnelUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — non-fatal
    }
  }

  async function extendTrial() {
    const raw = window.prompt(
      "Extend trial by how many days from now? (1–365)",
      "15",
    );
    if (raw == null) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setErr("days must be an integer between 1 and 365");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.extendTrial(tenant.id, days);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not extend trial");
    } finally {
      setBusy(false);
    }
  }

  async function grantPlan() {
    const planId = window.prompt(
      "Plan ID to assign (from the Plan table). Clears the trial.",
    );
    if (!planId) return;
    setBusy(true);
    setErr(null);
    try {
      await api.grantPlan(tenant.id, planId.trim());
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not grant plan");
    } finally {
      setBusy(false);
    }
  }

  const inactive = !tenant.isActive;

  return (
    <section
      className={`rounded-xl border p-4 ${
        inactive
          ? "border-red-200 bg-red-50/40"
          : tenant.planId
            ? "border-brand-mint/40 bg-brand-mint/10"
            : "border-accent-orange/30 bg-accent-orange/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-brand-deep">Funnel URL</p>
          <code className="block break-all text-sm">{tenant.funnelUrl}</code>
          <p className="text-xs text-brand-ink/60">
            {tenant.planId ? (
              <>Paid plan active — no expiry.</>
            ) : trialActive ? (
              <>
                Trial active · ends in <strong>{trialDays} day{trialDays === 1 ? "" : "s"}</strong>{" "}
                ({tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : ""})
              </>
            ) : tenant.status === "archived" ? (
              <>Archived — agent paused on every channel.</>
            ) : (
              <>
                <strong>Trial expired.</strong> The funnel page shows the
                &quot;currently offline&quot; message until a plan is granted
                or the trial extended.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog"
        >
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={extendTrial}
          disabled={busy}
          className="rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog disabled:opacity-50"
        >
          Extend trial…
        </button>
        <button
          type="button"
          onClick={grantPlan}
          disabled={busy}
          className="rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog disabled:opacity-50"
        >
          Grant plan…
        </button>
      </div>

      {err ? (
        <p className="mt-2 text-xs text-red-600">{err}</p>
      ) : null}
    </section>
  );
}
