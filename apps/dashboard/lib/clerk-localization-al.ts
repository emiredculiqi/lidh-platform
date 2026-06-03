/**
 * Albanian (sq) localization for Clerk's sign-in / sign-up components.
 *
 * @clerk/localizations ships 51 locales but no Albanian, so we hand-author
 * the strings that appear on the auth flows. This is a PARTIAL override —
 * any key we omit falls back to Clerk's English default. Keys mirror the
 * structure of enUS (verified against @clerk/localizations at build time).
 *
 * Typed loosely (`LocalizationLike`) because @clerk/types isn't a direct
 * dependency; ClerkProvider's `localization` prop is a DeepPartial so a
 * plain partial object is accepted at the call site.
 *
 * Scope: the screens an SMB owner actually sees — start (email/social),
 * password entry, email-code verification, forgot-password, and the
 * sign-up equivalents. Deep org/admin/passkey flows stay English for now.
 */
type LocalizationLike = Record<string, unknown>;

export const clerkAlbanian: LocalizationLike = {
  locale: "sq-AL",

  // ── Shared form chrome ──
  backButton: "Kthehu",
  dividerText: "ose",
  formButtonPrimary: "Vazhdo",
  formFieldAction__forgotPassword: "Harrove fjalëkalimin?",
  socialButtonsBlockButton: "Vazhdo me {{provider|titleize}}",
  signInEnterPasswordTitle: "Shkruaj fjalëkalimin",

  formFieldLabel__emailAddress: "Adresa e email-it",
  formFieldLabel__emailAddress_username: "Email ose username",
  formFieldLabel__password: "Fjalëkalimi",
  formFieldLabel__confirmPassword: "Konfirmo fjalëkalimin",
  formFieldLabel__newPassword: "Fjalëkalimi i ri",
  formFieldLabel__currentPassword: "Fjalëkalimi aktual",
  formFieldLabel__firstName: "Emri",
  formFieldLabel__lastName: "Mbiemri",
  formFieldLabel__username: "Username",
  formFieldLabel__backupCode: "Kodi rezervë",

  formFieldInputPlaceholder__emailAddress: "Shkruaj adresën e email-it",
  formFieldInputPlaceholder__emailAddress_username:
    "Shkruaj email ose username",
  formFieldInputPlaceholder__password: "Shkruaj fjalëkalimin",
  formFieldInputPlaceholder__signUpPassword: "Krijo një fjalëkalim",
  formFieldInputPlaceholder__firstName: "Emri",
  formFieldInputPlaceholder__lastName: "Mbiemri",
  formFieldInputPlaceholder__backupCode: "Shkruaj kodin rezervë",

  // ── Sign in ──
  signIn: {
    start: {
      title: "Hyr në {{applicationName}}",
      subtitle: "Mirë se u ktheve! Të lutemi hyr për të vazhduar",
      actionText: "Nuk ke llogari?",
      actionLink: "Regjistrohu",
    },
    password: {
      title: "Shkruaj fjalëkalimin",
      subtitle: "Shkruaj fjalëkalimin e lidhur me llogarinë tënde",
      actionLink: "Përdor një metodë tjetër",
    },
    emailCode: {
      title: "Kontrollo email-in",
      subtitle: "për të vazhduar te {{applicationName}}",
      formTitle: "Kodi i verifikimit",
      resendButton: "Nuk e morre kodin? Ridërgo",
    },
    forgotPasswordAlternativeMethods: {
      title: "Harrove fjalëkalimin?",
      label__alternativeMethods: "Ose, hyr me një metodë tjetër",
      blockButton__resetPassword: "Rivendos fjalëkalimin",
    },
    forgotPassword: {
      title: "Rivendos fjalëkalimin",
      subtitle_email: "Fillimisht, shkruaj kodin e dërguar në email-in tënd",
      formTitle: "Kodi i rivendosjes",
      resendButton: "Nuk e morre kodin? Ridërgo",
    },
    alternativeMethods: {
      title: "Përdor një metodë tjetër",
      actionLink: "Merr ndihmë",
      blockButton__emailCode: "Dërgo kodin te {{identifier}}",
      blockButton__password: "Hyr me fjalëkalimin tënd",
      getHelp: {
        title: "Merr ndihmë",
        content:
          "Nëse has vështirësi për të hyrë në llogari, na shkruaj dhe do të të ndihmojmë.",
        blockButton__emailSupport: "Shkruaj mbështetjes",
      },
    },
  },

  // ── Sign up ──
  signUp: {
    start: {
      title: "Krijo llogarinë tënde",
      subtitle: "Mirë se erdhe! Plotëso të dhënat për të filluar.",
      actionText: "Ke një llogari?",
      actionLink: "Hyr",
    },
    emailCode: {
      title: "Verifiko email-in",
      subtitle: "Shkruaj kodin e verifikimit të dërguar në email",
      formTitle: "Kodi i verifikimit",
      resendButton: "Nuk e morre kodin? Ridërgo",
    },
    continue: {
      title: "Plotëso fushat e mbetura",
      subtitle: "Të lutemi plotëso të dhënat e mbetura për të vazhduar.",
      actionText: "Ke një llogari?",
      actionLink: "Hyr",
    },
  },
};
