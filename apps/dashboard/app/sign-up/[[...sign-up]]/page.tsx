import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-fog px-4">
      <SignUp appearance={clerkAppearance} />
    </main>
  );
}
