import Image from "next/image";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { AuthBrandPanel } from "@/components/AuthBrandPanel";
import { AnimatedGradient } from "@/components/AnimatedGradient";

// Catch-all route hosting Clerk's hosted SignIn UI. The [[...sign-in]] segment
// lets Clerk handle its own internal routes (verification, password reset, etc).
//
// Layout: 50/50 split on desktop (brand panel left, Clerk form right). On
// mobile the brand panel is hidden, so the form section instead carries the
// AnimatedGradient as its own background — the card + logo float over it.
export default function Page() {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <AuthBrandPanel />

      {/* Form side. `isolate` + `overflow-hidden` contain the mobile gradient's
          blurred discs. On desktop md:bg-brand-fog covers it and the md:hidden
          gradient is removed, keeping the right half clean. */}
      <section className="relative isolate flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6 py-10 md:overflow-visible md:bg-brand-fog">
        <div className="md:hidden">
          <AnimatedGradient />
        </div>

        {/* Logo above the form on mobile only — on desktop it lives on the
            brand panel (left). */}
        <Link href="https://lidh.al" aria-label="Lidh.al" className="md:hidden">
          <Image
            src="/logo.png"
            alt="Lidh.al"
            width={120}
            height={120}
            priority
            className="h-[120px] w-[120px]"
          />
        </Link>
        <SignIn appearance={clerkAppearance} />
      </section>
    </main>
  );
}
