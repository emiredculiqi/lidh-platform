"use client";

import { useLocale } from "@/lib/i18n";

// Lidh.al support contact for reactivation (no self-serve billing yet — ADR-017).
const SUPPORT_HREF = "https://wa.me/355695201250";

/**
 * Persistent banner across the business workspace when the tenant is frozen
 * (ADR-017, Phase 3). Enforcement is server-side (ReadOnlyGuard → 403); this is
 * the graceful heads-up so owners understand why edits are blocked. Renders
 * nothing when the dashboard is "full".
 */
export function ReadOnlyBanner({ dashboard }: { dashboard: string }) {
  const { locale } = useLocale();
  if (dashboard === "full") return null;
  const al = locale === "al";
  const archived = dashboard === "none";

  const title = archived
    ? al
      ? "Llogaria është pezulluar"
      : "Account paused"
    : al
      ? "Prova juaj falas mbaroi"
      : "Your free trial has ended";

  const body = archived
    ? al
      ? "Kontaktoni Lidh.al për ta riaktivizuar llogarinë tuaj."
      : "Contact Lidh.al to reactivate your account."
    : al
      ? "Jeni në modalitet vetëm-lexim: shihni bisedat dhe kontaktet, por agjenti nuk përgjigjet dhe ndryshimet janë të bllokuara. Zgjidhni një plan për të vazhduar."
      : "You're in read-only mode: view your conversations and contacts, but the agent won't reply and changes are blocked. Choose a plan to continue.";

  const cta = al ? "Kontaktoni" : "Contact us";

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-7 py-3"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 text-amber-600"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-bold text-amber-900">{title}</span>{" "}
        <span className="text-[12.5px] text-amber-800">{body}</span>
      </div>
      <a
        href={SUPPORT_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 rounded-lg bg-amber-500 px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-amber-600"
      >
        {cta}
      </a>
    </div>
  );
}
