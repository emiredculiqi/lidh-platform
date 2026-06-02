import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

// Catch-all route hosting Clerk's hosted SignIn UI. The [[...sign-in]] segment
// lets Clerk handle its own internal routes (verification, password reset, etc).
//
// `appearance` is duplicated from <ClerkProvider> because Clerk 7.x doesn't
// reliably propagate the prop through. See lib/clerk-appearance.ts.
export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-fog px-4">
      <SignIn appearance={clerkAppearance} />
    </main>
  );
}
