/**
 * Clerk visual theme shared by <ClerkProvider>, <SignIn>, <SignUp>, and any
 * other Clerk component on the dashboard.
 *
 * Why a shared module: Clerk 7.x doesn't always propagate the `appearance`
 * prop from <ClerkProvider> down to <SignIn>/<SignUp> in production builds
 * — the prop has to be passed to the component itself as well. Importing
 * the same object both places keeps them in sync without copy-paste drift.
 *
 * Colors match the brand tokens in tailwind.config.ts (apps/dashboard).
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1E5FDB", // brand-blue — primary CTA
    colorBackground: "#FFFFFF", // form card on brand-fog page bg
    colorText: "#0A0A23", // brand-ink — body text
    colorTextSecondary: "#0A0A23B3", // brand-ink at ~70% opacity
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0A0A23",
    colorNeutral: "#0A0A23",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  layout: {
    // We render the Lidh.al logo OUTSIDE the Clerk card (see sign-in /
    // sign-up pages) — Clerk 7.x's `appearance.layout.logoImageUrl` is
    // unreliable. logoPlacement="none" hides Clerk's own logo slot so
    // the card starts clean.
    logoPlacement: "none" as const,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
} as const;
