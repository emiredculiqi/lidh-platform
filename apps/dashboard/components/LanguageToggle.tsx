"use client";

import { useLocale, type Locale } from "@/lib/i18n";

/**
 * AL / EN pill toggle for the dashboard. Same shape as the marketing
 * site's toggle so the visual language carries over. Lives in the layout
 * top bar so it's always reachable.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  const options: { value: Locale; label: string }[] = [
    { value: "al", label: "AL" },
    { value: "en", label: "EN" },
  ];

  return (
    <div className="relative inline-flex items-center rounded-full border border-brand-ink/15 bg-white p-0.5 text-xs font-semibold">
      {options.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            onClick={() => setLocale(opt.value)}
            className={`relative z-10 rounded-full px-2.5 py-1 transition ${
              active
                ? "bg-brand-blue text-white"
                : "text-brand-ink/60 hover:text-brand-deep"
            }`}
            aria-pressed={active}
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
