import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

// Shell for every authenticated page. Auth enforced by middleware.ts.
// M2.4: platform-admin view (sees all tenants); per-user scoping comes with
// the auth step (ADR-003).
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-brand-ink/10 bg-white px-6">
        <Link
          href="/tenants"
          className="font-display text-lg font-semibold text-brand-deep"
        >
          Lidh.al
          <span className="ml-2 rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-blue">
            admin
          </span>
        </Link>
        <UserButton />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
