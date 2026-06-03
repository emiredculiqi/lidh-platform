import Image from "next/image";
import Link from "next/link";
import { T } from "@/components/T";
import { AnimatedGradient } from "@/components/AnimatedGradient";

/**
 * Left-side brand panel for sign-in / sign-up. Hidden on mobile so the
 * Clerk form gets the full screen on phones (where the form section carries
 * its own AnimatedGradient instead).
 *
 * Background is `AnimatedGradient` — soft brand-blue/mint base with four
 * blurred discs orbiting and cycling through the brand palette. Layout is
 * top-to-bottom: logo pinned top-left, tagline + supporting copy at the
 * bottom. Dark text reads cleanly over the light gradient.
 */
export function AuthBrandPanel() {
  return (
    <aside className="relative isolate hidden overflow-hidden md:block">
      <AnimatedGradient />

      {/* Logo + tagline as one centered group in the middle of the panel. */}
      <div className="relative flex h-full flex-col items-center justify-center gap-6 p-10 text-center lg:p-14">
        <Link href="https://lidh.al" aria-label="Lidh.al">
          <Image
            src="/logo.png"
            alt="Lidh.al"
            width={420}
            height={420}
            priority
            className="h-64 w-64 lg:h-80 lg:w-80"
          />
        </Link>

        <div className="max-w-lg">
          <h2 className="font-display text-4xl font-bold leading-tight text-brand-deep lg:text-5xl">
            <T
              al="Shërbim më i mirë, menaxhim më i lehtë"
              en="Better service & smarter management"
            />
          </h2>
          <p className="mt-5 text-lg text-brand-ink/70 lg:text-xl">
            <T
              al="Lidh biznesin tënd me klientët, 24/7, mos humbisni më."
              en="Connect your business with customers, 24/7, never miss another one."
            />
          </p>
        </div>
      </div>
    </aside>
  );
}
