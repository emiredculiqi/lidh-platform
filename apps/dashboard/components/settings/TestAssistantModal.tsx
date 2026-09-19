"use client";

import { useEffect, useState } from "react";
import { TestChat } from "@/components/TestChat";
import { useT } from "@/lib/i18n";

/**
 * "Test the assistant" — a button that opens the preview chat in a modal.
 * Replaces the old Test-agent page: testing is a moment inside Settings, not
 * a section of the product. Uses the Clerk-guarded preview route, so nothing
 * typed here reaches the inbox or usage (ADR-021).
 */
export function TestAssistantButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const t = useT({
    al: {
      open: "Testo asistentin",
      title: "Testo asistentin",
      hint: "Si një vizitor — nuk shfaqet te Bisedat apo te raportet.",
      close: "Mbyll",
    },
    en: {
      open: "Test the assistant",
      title: "Test the assistant",
      hint: "As a visitor — it won't show in your inbox or reports.",
      close: "Close",
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-ink/15 px-3.5 py-2 text-[13px] font-semibold text-brand-deep transition hover:bg-brand-fog"
      >
        {t.open}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-bold text-brand-deep">{t.title}</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-500">{t.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-[13px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                {t.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TestChat tenantSlug={slug} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
