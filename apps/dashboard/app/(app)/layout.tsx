import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

// Layout for every authenticated dashboard route. Auth itself is enforced by
// the Clerk middleware (middleware.ts) — by the time this layout renders, we
// know there's a user.
//
// Sidebar / breadcrumbs / notifications expand here in M2.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-brand-ink/10 bg-white px-6">
        <Link
          href="/inbox"
          className="font-display text-lg font-semibold text-brand-deep"
        >
          Lidh.al
        </Link>
        {/* Sign-out redirect goes to "/" by default; our HomePage then sends
            unauthenticated users to /sign-in. To override globally, set
            NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL or pass on ClerkProvider. */}
        <UserButton />
      </header>
      <div>{children}</div>
    </div>
  );
}
