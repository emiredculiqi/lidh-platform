import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { LocaleProvider } from "@/lib/i18n";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkAlbanian } from "@/lib/clerk-localization-al";
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
    // ClerkProvider stays the OUTERMOST, server-rendered wrapper (the
    // documented App Router pattern). Rendering <html>/<body> from a server
    // layout — not from inside client providers — avoids SSR/hydration 500s.
    //
    // Clerk's own components (SignIn/SignUp/UserButton) are localized to
    // Albanian unconditionally: AL is the platform default, and Clerk has no
    // built-in `sq`, so we pass our hand-authored pack. The EN toggle still
    // switches the rest of the dashboard (LocaleProvider + useT); it just
    // doesn't re-localize Clerk's ~3 components (acceptable tradeoff vs. the
    // fragility of a client-side ClerkProvider).
    <ClerkProvider
      afterSignOutUrl="/sign-in"
      appearance={clerkAppearance}
      localization={clerkAlbanian}
    >
      <html lang="sq">
        <body className="min-h-screen antialiased">
          <LocaleProvider>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
