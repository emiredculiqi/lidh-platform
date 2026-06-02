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

      <div className="relative flex h-full flex-col p-10 lg:p-14">
        {/* Large logo centered in the panel's available space. */}
        <Link
          href="https://lidh.al"
          aria-label="Lidh.al"
          className="flex flex-1 items-center justify-center"
        >
          <Image
            src="/logo.png"
            alt="Lidh.al"
            width={420}
            height={420}
            priority
            className="h-64 w-64 lg:h-96 lg:w-96"
          />
        </Link>

        {/* Tagline + supporting copy, bottom-left. */}
        <div>
          <h2 className="max-w-md font-display text-3xl font-bold leading-tight text-brand-deep lg:text-4xl">
            <T
              al="Shërbim më i mirë, menaxhim më i lehtë"
              en="Better service & smarter management"
            />
          </h2>
          <p className="mt-4 max-w-md text-base text-brand-ink/70 lg:text-lg">
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
