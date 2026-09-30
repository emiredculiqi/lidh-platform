"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

/**
 * Lays out a thread next to its contact panel. At ≥ 1536 px the panel is a
 * fixed column; below that it is collapsed behind a "Contact" button and
 * opens as a drawer over the thread. (At 1280–1440 px, the common laptop
 * widths, a fixed panel left the message column narrower than the panel
 * itself — the thread is the main content and gets the width.)
 */
export function ThreadFrame({
  panel,
  children,
}: {
  panel: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useT({
    al: { contact: "Kontakti", close: "Mbyll" },
    en: { contact: "Contact", close: "Close" },
  });

  return (
    <div className="relative flex min-w-0 flex-1">
      {children}

      {/* ≥ 2xl: the panel is part of the row (it hides itself below 2xl). */}
      {panel}

      {/* < 2xl: a button in the top-right corner of the thread, and a drawer. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-4 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:border-brand-blue hover:text-brand-blue 2xl:hidden"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
        {t.contact}
      </button>
      {open ? (
        <div className="absolute inset-0 z-20 flex justify-end 2xl:hidden">
          <button
            type="button"
            aria-label={t.close}
            onClick={() => setOpen(false)}
            className="flex-1 bg-brand-deep/20"
          />
          <div className="flex h-full w-[300px] max-w-[85%] flex-col bg-white shadow-2xl [&>aside]:!flex [&>aside]:h-full [&>aside]:w-full">
            <div className="flex flex-none items-center justify-end border-b border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                {t.close}
              </button>
            </div>
            {panel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
