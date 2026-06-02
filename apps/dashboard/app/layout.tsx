import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { LocaleProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lidh.al — Dashboard",
  description: "Lidh.al platform dashboard",
};

// Clerk visual theme — match the dashboard's brand tokens defined in
// tailwind.config.ts. Applies to <SignIn/>, <SignUp/>, <UserButton/>,
// and the user profile modal.
//
// `appearance.variables` covers most of the theming. `appearance.elements`
// is reserved for element-level overrides if a specific bit still doesn't
// match (Clerk targets components with stable class names — see their docs
// "customization > components"). Logo + layout settings live under
// `appearance.layout`.
const clerkAppearance = {
  variables: {
    colorPrimary: "#1E5FDB", // brand-blue — primary CTA color
    colorBackground: "#FFFFFF", // form card stays white over brand-fog page bg
    colorText: "#0A0A23", // brand-ink — body text
    colorTextSecondary: "#0A0A23B3", // brand-ink at 70% — muted text
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0A0A23",
    colorNeutral: "#0A0A23",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  layout: {
    logoImageUrl: "/logo.png",
    logoLinkUrl: "https://lidh.al",
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
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
    <ClerkProvider afterSignOutUrl="/sign-in" appearance={clerkAppearance}>
      <html lang="sq">
        <body className="min-h-screen antialiased">
          <LocaleProvider>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
