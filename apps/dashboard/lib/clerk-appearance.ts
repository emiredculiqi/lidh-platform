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
 *
 * `elements` passes Tailwind utility classes into Clerk's named slots to
 * scale the form up (wider card, taller inputs/buttons, larger heading).
 * NOTE: those classes must be reachable by the Tailwind content scanner —
 * tailwind.config.ts includes "./lib/**" specifically for this file.
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
    fontSize: "1.0625rem", // base bump (Clerk default ~0.8125rem)
    borderRadius: "0.75rem",
    spacingUnit: "1.25rem", // looser vertical rhythm
  },
  layout: {
    // We render the Lidh.al logo OUTSIDE the Clerk card (see sign-in /
    // sign-up pages) — Clerk 7.x's `appearance.layout.logoImageUrl` is
    // unreliable. logoPlacement="none" hides Clerk's own logo slot.
    logoPlacement: "none" as const,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    // Wider card so the whole form reads bigger and more spacious.
    cardBox: "w-full max-w-[36rem] shadow-glow",
    card: "px-12 py-14 gap-8",
    // Bigger, bolder heading like the reference template.
    headerTitle: "text-4xl font-bold",
    headerSubtitle: "text-lg",
    // Taller inputs + clearer labels.
    formFieldLabel: "text-base font-semibold",
    formFieldInput: "py-4 text-lg rounded-xl",
    // Full-width, chunky primary button.
    formButtonPrimary:
      "py-4 text-lg font-semibold rounded-xl normal-case tracking-normal",
    // Social buttons match the input/button scale.
    socialButtonsBlockButton: "py-4 text-lg rounded-xl",
    socialButtonsBlockButtonText: "text-lg font-medium",
    dividerText: "text-base",
    footerActionText: "text-base",
    footerActionLink: "text-base font-semibold",
  },
} as const;
