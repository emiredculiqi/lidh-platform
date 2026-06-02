import Image from "next/image";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

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
      <SignUp appearance={clerkAppearance} />
    </main>
  );
}
