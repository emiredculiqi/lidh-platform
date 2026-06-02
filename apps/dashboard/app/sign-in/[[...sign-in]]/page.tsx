import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

// Catch-all route hosting Clerk's hosted SignIn UI. The [[...sign-in]] segment
// lets Clerk handle its own internal routes (verification, password reset, etc).
//
// Branding: the Lidh.al logo + wordmark live OUTSIDE the Clerk card because
// Clerk 7.x's appearance.layout.logoImageUrl is unreliable in production.
// Rendering it ourselves means we control the size, link target and spacing.
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-fog px-4 py-10">
      <Link
        href="https://lidh.al"
        className="flex items-center gap-2 text-brand-deep"
      >
        <Image
          src="/logo.png"
          alt="Lidh.al"
          width={40}
          height={40}
          priority
          className="h-10 w-10"
        />
        <span className="font-display text-xl font-bold tracking-tight">
          Lidh<span className="text-accent-orange">.</span>al
        </span>
      </Link>
      <SignIn appearance={clerkAppearance} />
    </main>
  );
}
