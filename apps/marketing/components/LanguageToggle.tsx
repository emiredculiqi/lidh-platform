"use client";

import { useLocale, type Locale } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  const options: { value: Locale; label: string }[] = [
    { value: "al", label: "AL" },
    { value: "en", label: "EN" },
  ];

  return (
    <div className="relative inline-flex items-center rounded-full border border-brand-blue/20 bg-white/70 p-1 text-sm font-semibold backdrop-blur">
      {options.map((opt) => {
        const active = opt.value === locale;
        return (
          <button
            key={opt.value}
            onClick={() => setLocale(opt.value)}
            className={`relative z-10 rounded-full px-3 py-1 transition ${
              active ? "text-white" : "text-brand-deep/70 hover:text-brand-deep"
            }`}
            aria-pressed={active}
          >
            {active && (
              <span className="absolute inset-0 -z-10 rounded-full bg-brand-gradient" />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
