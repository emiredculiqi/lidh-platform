import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { LocaleProvider } from "@/lib/i18n";
import { clerkAppearance } from "@/lib/clerk-appearance";
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
    // afterSignOutUrl: where Clerk sends the user after sign-out. Without it,
    // sign-out leaves them on the (now unauthenticated) current route, which
    // the middleware blocks → blank page. /sign-in is public and renders fine.
    //
    // Clerk's prebuilt components have no Albanian localization (51 locales
    // shipped, no `sq`). They stay in English even when locale=al. Rest of
    // the dashboard switches via LocaleProvider + useT() bundles.
    //
    // <html lang> defaults to "sq" because AL is the default locale; the
    // LocaleProvider rewrites it client-side if the user toggles to EN.
    //
    // `appearance` is also re-passed on <SignIn>/<SignUp> directly (see
    // lib/clerk-appearance.ts) — Clerk 7.x's prop propagation is unreliable
    // in production builds.
    <ClerkProvider afterSignOutUrl="/sign-in" appearance={clerkAppearance}>
      <html lang="sq">
        <body className="min-h-screen antialiased">
          <LocaleProvider>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
