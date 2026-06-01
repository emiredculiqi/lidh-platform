"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/api-core";
import { useT } from "@/lib/i18n";

/**
 * Funnel panel on the tenant overview. Three logical cards: Funnel URL,
 * Status (lifecycle), Owner. Admin-only actions are hidden behind the
 * `isPlatformAdmin` prop — API also enforces with @PlatformAdminOnly.
 */
export function FunnelPanel({
  tenant,
  isPlatformAdmin,
}: {
  tenant: Tenant;
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);

  const t = useT({
    al: {
      funnelUrl: "URL e funelit",
      copy: "Kopjo URL",
      copied: "U kopjua",
      funnelHelp:
        "I përhershëm. Shpërndaje në Instagram, WhatsApp, vizita karta — ajo që kontrollohet është shërbimi, jo URL-ja.",
      status: "Statusi",
      paidActive: "Plan me pagesë aktiv — nuk skadon.",
      trialActiveBefore: "Provë aktive · përfundon pas ",
      trialDay: "ditë",
      trialDays: "ditësh",
      archived: "Arkivuar — agjenti është pezulluar në të gjitha kanalet.",
      trialExpiredBold: "Prova ka skaduar.",
      trialExpiredRest:
        " Faqja e funelit shfaq mesazhin “momentalisht offline” derisa të caktohet një plan ose të zgjatet prova.",
      extendTrial: "Zgjat provën…",
      grantPlan: "Cakto plan…",
      owner: "Pronari i biznesit",
      noOwner: "Asnjë pronar i caktuar.",
      ownerActive: "aktiv",
      ownerPending: "në pritje të regjistrimit",
      pendingHelp:
        "Do të lidhet automatikisht kur të kyçet për herë të parë në app.lidh.al/sign-up.",
      assignOwner: "Cakto pronarin…",
      changeOwner: "Ndrysho…",
      extendPrompt: "Zgjat provën për sa ditë nga tani? (1–365)",
      extendErrRange: "ditët duhet të jenë numër i plotë midis 1 dhe 365",
      extendErrDefault: "nuk u zgjat dot prova",
      planPrompt:
        "ID i planit për të caktuar (nga tabela Plan). Heq provën.",
      planErrDefault: "nuk u caktua dot plani",
    },
    en: {
      funnelUrl: "Funnel URL",
      copy: "Copy URL",
      copied: "Copied",
      funnelHelp:
        "Permanent. Share on Instagram, WhatsApp, business cards — the service is what gates, not the URL.",
      status: "Status",
      paidActive: "Paid plan active — no expiry.",
      trialActiveBefore: "Trial active · ends in ",
      trialDay: "day",
      trialDays: "days",
      archived: "Archived — agent paused on every channel.",
      trialExpiredBold: "Trial expired.",
      trialExpiredRest:
        " The funnel page shows the “currently offline” message until a plan is granted or the trial extended.",
      extendTrial: "Extend trial…",
      grantPlan: "Grant plan…",
      owner: "Business owner",
      noOwner: "No owner assigned.",
      ownerActive: "active",
      ownerPending: "pending sign-up",
      pendingHelp:
        "They'll be bound automatically on their first sign-in at app.lidh.al/sign-up.",
      assignOwner: "Assign owner…",
      changeOwner: "Change…",
      extendPrompt: "Extend trial by how many days from now? (1–365)",
      extendErrRange: "days must be an integer between 1 and 365",
      extendErrDefault: "could not extend trial",
      planPrompt: "Plan ID to assign (from the Plan table). Clears the trial.",
      planErrDefault: "could not grant plan",
    },
  });

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
    const raw = window.prompt(t.extendPrompt, "15");
    if (raw == null) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setErr(t.extendErrRange);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.extendTrial(tenant.id, days);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.extendErrDefault);
    } finally {
      setBusy(false);
    }
  }

  async function grantPlan() {
    const planId = window.prompt(t.planPrompt);
    if (!planId) return;
    setBusy(true);
    setErr(null);
    try {
      await api.grantPlan(tenant.id, planId.trim());
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.planErrDefault);
    } finally {
      setBusy(false);
    }
  }

  const lifecycleBorder = !tenant.isActive
    ? "border-red-200 bg-red-50/40"
    : tenant.planId
      ? "border-brand-mint/40 bg-brand-mint/10"
      : "border-accent-orange/30 bg-accent-orange/5";

  return (
    <section className="space-y-3">
      {/* 1. Funnel URL */}
      <div className="rounded-xl border border-brand-ink/10 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/55">
              {t.funnelUrl}
            </p>
            <code className="block break-all text-sm text-brand-deep">
              {tenant.funnelUrl}
            </code>
            <p className="text-xs text-brand-ink/55">{t.funnelHelp}</p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog"
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
      </div>

      {/* 2. Lifecycle / plan */}
      <div className={`rounded-xl border p-4 ${lifecycleBorder}`}>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/55">
          {t.status}
        </p>
        <p className="mt-1 text-sm text-brand-deep">
          {tenant.planId ? (
            t.paidActive
          ) : trialActive ? (
            <>
              {t.trialActiveBefore}
              <strong>
                {trialDays} {trialDays === 1 ? t.trialDay : t.trialDays}
              </strong>{" "}
              (
              {tenant.trialEndsAt
                ? new Date(tenant.trialEndsAt).toLocaleDateString()
                : ""}
              )
            </>
          ) : tenant.status === "archived" ? (
            t.archived
          ) : (
            <>
              <strong>{t.trialExpiredBold}</strong>
              {t.trialExpiredRest}
            </>
          )}
        </p>
        {isPlatformAdmin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={extendTrial}
              disabled={busy}
              className="rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog disabled:opacity-50"
            >
              {t.extendTrial}
            </button>
            <button
              type="button"
              onClick={grantPlan}
              disabled={busy}
              className="rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog disabled:opacity-50"
            >
              {t.grantPlan}
            </button>
          </div>
        ) : null}
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
      </div>

      {/* 3. Owner */}
      <div className="rounded-xl border border-brand-ink/10 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink/55">
              {t.owner}
            </p>
            {tenant.ownerEmail ? (
              <p className="text-sm text-brand-deep">
                <span className="font-medium">{tenant.ownerEmail}</span>
                <span className="ml-2 inline-block rounded bg-brand-mint/20 px-1.5 py-0.5 text-xs font-medium text-brand-deep">
                  {t.ownerActive}
                </span>
              </p>
            ) : tenant.pendingOwnerEmail ? (
              <p className="text-sm text-brand-deep">
                <span className="font-medium">{tenant.pendingOwnerEmail}</span>
                <span className="ml-2 inline-block rounded bg-brand-blue/15 px-1.5 py-0.5 text-xs font-medium text-brand-blue">
                  {t.ownerPending}
                </span>
              </p>
            ) : (
              <p className="text-sm text-brand-ink/55">{t.noOwner}</p>
            )}
            {tenant.pendingOwnerEmail && !tenant.ownerEmail ? (
              <p className="text-xs text-brand-ink/55">{t.pendingHelp}</p>
            ) : null}
          </div>
          {isPlatformAdmin ? (
            <button
              type="button"
              onClick={() => setOwnerModalOpen(true)}
              className="shrink-0 rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-brand-ink/80 transition hover:bg-brand-fog"
            >
              {tenant.ownerEmail || tenant.pendingOwnerEmail
                ? t.changeOwner
                : t.assignOwner}
            </button>
          ) : null}
        </div>
      </div>

      {isPlatformAdmin ? (
        <SetOwnerModal
          open={ownerModalOpen}
          tenant={tenant}
          onClose={() => setOwnerModalOpen(false)}
          onSaved={() => {
            setOwnerModalOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * Lightweight modal for setting / changing the tenant owner email. No
 * external UI library — controlled state + fixed overlay + Esc/click-out.
 */
function SetOwnerModal({
  open,
  tenant,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = useT({
    al: {
      headingAdd: "Shto një pronar tjetër",
      headingChange: "Ndrysho pronarin në pritje",
      headingAssign: "Cakto pronarin e biznesit",
      helperAdd: (cur: string) =>
        `Pronari aktual është ${cur}. Shtimi i një email-i tjetër NUK e heq atë — vetëm shton një pronar të dytë.`,
      helperChange:
        "Zëvendëso email-in në pritje më poshtë. Email-i i ri lidhet kur kyçet (ose menjëherë nëse përdoruesi ekziston).",
      helperAssign:
        "Nëse përdoruesi me këtë email ekziston, lidhet menjëherë si pronar. Përndryshe, lidhet në kyçjen e parë në app.lidh.al/sign-up.",
      label: "Email i pronarit",
      placeholder: "owner@business.al",
      invalid: "Të lutemi vendos një email të vlefshëm.",
      defaultErr: "Pronari nuk u caktua.",
      cancel: "Anulo",
      save: "Ruaj",
      saving: "Duke ruajtur…",
    },
    en: {
      headingAdd: "Add another owner",
      headingChange: "Change pending owner",
      headingAssign: "Assign business owner",
      helperAdd: (cur: string) =>
        `Current owner is ${cur}. Adding another email will not remove them — it adds a second owner.`,
      helperChange:
        "Replace the pending email below. The new email will be bound on first sign-in (or immediately if that user already exists).",
      helperAssign:
        "If a user with this email already exists, they'll be bound as owner immediately. Otherwise, they'll be bound on their first sign-in at app.lidh.al/sign-up.",
      label: "Owner email",
      placeholder: "owner@business.al",
      invalid: "Please enter a valid email address.",
      defaultErr: "Could not set owner.",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving…",
    },
  });

  useEffect(() => {
    if (open) {
      setEmail(tenant.pendingOwnerEmail ?? "");
      setErr(null);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, tenant.pendingOwnerEmail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErr(t.invalid);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.setOwner(tenant.id, value);
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.defaultErr);
      setBusy(false);
    }
  }

  const heading = tenant.ownerEmail
    ? t.headingAdd
    : tenant.pendingOwnerEmail
      ? t.headingChange
      : t.headingAssign;

  const helper = tenant.ownerEmail
    ? t.helperAdd(tenant.ownerEmail)
    : tenant.pendingOwnerEmail
      ? t.helperChange
      : t.helperAssign;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-brand-ink/10 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-semibold text-brand-deep">
          {heading}
        </h3>
        <p className="mt-1 text-sm text-brand-ink/60">{helper}</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-brand-ink/60">
              {t.label}
            </span>
            <input
              ref={inputRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.placeholder}
              className="w-full rounded-lg border border-brand-ink/15 px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              disabled={busy}
            />
          </label>

          {err ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {err}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-brand-ink/15 bg-white px-3 py-2 text-sm font-medium text-brand-ink/80 transition hover:bg-brand-fog disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
