"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Client-side locale state for the dashboard. Mirrors the lidh-website
 * (marketing) i18n shape so engineers context-switch cheaply between repos.
 *
 *   - AL is the default — primary audience is Albanian SMBs.
 *   - Persisted to localStorage under `lidh.locale` (matches the marketing
 *     site, so a user toggling on one carries over on the same browser if
 *     they visit the other).
 *   - Also written to <html lang> ("sq" / "en") for screen readers + browser
 *     translation tools.
 */
export type Locale = "al" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "lidh.locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("al");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "al" || stored === "en") setLocaleState(stored);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "al" ? "sq" : "en";
  };

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

export function useT<T>(bundle: { al: T; en: T }): T {
  const { locale } = useLocale();
  return bundle[locale];
}
