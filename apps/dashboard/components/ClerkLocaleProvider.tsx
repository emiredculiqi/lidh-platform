"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useLocale } from "@/lib/i18n";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkAlbanian } from "@/lib/clerk-localization-al";

/**
 * Wraps <ClerkProvider> so its `localization` follows the dashboard locale
 * toggle: Albanian (hand-authored, lib/clerk-localization-al.ts) when locale
 * is "al" — the default — and Clerk's built-in English when "en".
 *
 * `localization` is a ClerkProvider-level option (the <SignIn>/<SignUp>
 * components don't accept it), so the provider has to live in a client
 * component that can read useLocale(). It therefore sits INSIDE LocaleProvider
 * in the root layout.
 *
 * `appearance` is also set here (covers <UserButton> + the profile modal);
 * <SignIn>/<SignUp> re-pass it themselves due to Clerk 7.x propagation
 * quirks (see lib/clerk-appearance.ts).
 */
export function ClerkLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useLocale();

  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
      appearance={clerkAppearance}
      localization={locale === "al" ? clerkAlbanian : undefined}
    >
      {children}
    </ClerkProvider>
  );
}
