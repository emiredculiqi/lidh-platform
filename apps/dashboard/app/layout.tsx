import type { Metadata } from "next";
import { LocaleProvider } from "@/lib/i18n";
import { ClerkLocaleProvider } from "@/components/ClerkLocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lidh.al — Dashboard",
  description: "Lidh.al platform dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // LocaleProvider is OUTSIDE ClerkLocaleProvider so the latter can read the
    // current locale (via useLocale) and pass the matching `localization` to
    // <ClerkProvider> — Albanian by default, English when toggled. See
    // components/ClerkLocaleProvider.tsx.
    //
    // <html lang> defaults to "sq" (AL is the default locale); LocaleProvider
    // rewrites it client-side if the user toggles to EN.
    <LocaleProvider>
      <ClerkLocaleProvider>
        <html lang="sq">
          <body className="min-h-screen antialiased">{children}</body>
        </html>
      </ClerkLocaleProvider>
    </LocaleProvider>
  );
}
