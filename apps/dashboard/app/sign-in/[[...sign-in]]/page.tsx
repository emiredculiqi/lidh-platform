import { SignIn } from "@clerk/nextjs";

// Catch-all route hosting Clerk's hosted SignIn UI. The [[...sign-in]] segment
// lets Clerk handle its own internal routes (verification, password reset, etc).
export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-fog px-4">
      <SignIn />
    </main>
  );
}
