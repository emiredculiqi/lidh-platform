"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { T } from "@/components/T";
import { LanguageToggle } from "@/components/LanguageToggle";

/**
 * Top-level chrome switch. On a tenant workspace route (/tenants/<slug>/…) it
 * renders nothing of its own — the tenant layout provides the full sidebar
 * shell. Everywhere else (admin all-tenants list, /tenants/new, onboarding,
 * persona presets) it renders a simple header + centered container.
 */
export function AppChrome({
  isAdmin,
  mySlug,
  children,
}: {
  isAdmin: boolean;
  mySlug: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  // A real tenant workspace: /tenants/<slug> but NOT /tenants/new or /tenants.
  const inTenantWorkspace = /^\/tenants\/(?!new(?:\/|$))[^/]+/.test(pathname);
  // The platform-admin console provides its own shell (admin sidebar).
  const inAdminConsole = pathname.startsWith("/admin");

  if (inTenantWorkspace || inAdminConsole) return <>{children}</>;

  return (
    <div className="min-h-screen bg-brand-fog">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-6">
          <Link
            href={isAdmin ? "/admin/businesses" : mySlug ? `/tenants/${mySlug}` : "/onboarding"}
            className="font-display text-lg font-extrabold tracking-tight text-brand-deep"
          >
            Lidh<span className="text-brand-sky">.al</span>
            {isAdmin ? (
              <span className="ml-2 rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-blue">
                admin
              </span>
            ) : null}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-500">
            {isAdmin ? (
              <>
                <Link
                  href="/admin/businesses"
                  className="font-semibold text-brand-blue hover:opacity-80"
                >
                  <T al="Konsola" en="Console" />
                </Link>
                <Link href="/admin/presets" className="hover:text-brand-deep">
                  <T al="Personalitete" en="Persona presets" />
                </Link>
              </>
            ) : mySlug ? (
              <Link href={`/tenants/${mySlug}`} className="hover:text-brand-deep">
                <T al="Biznesi im" en="My business" />
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
