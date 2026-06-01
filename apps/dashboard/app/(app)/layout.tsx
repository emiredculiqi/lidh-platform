import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { api } from "@/lib/api-server";
import type { Me } from "@/lib/api-server";
import { T } from "@/components/T";
import { LanguageToggle } from "@/components/LanguageToggle";

// Shell for every authenticated page (ADR-013). Reads /me once per request
// (Next dedupes the fetch) to drive the nav: platform admins see the all-
// tenants admin + presets library; business users see only "My business" →
// their own tenant.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let me: Me | null = null;
  try {
    me = await api.me();
  } catch {
    // /me failed (no session, network, etc.) — render bare shell; the
    // individual page will surface the error.
  }

  const isAdmin = me?.user.isPlatformAdmin ?? false;
  const mySlug = me?.memberships[0]?.tenant.slug ?? null;

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-brand-ink/10 bg-white px-6">
        <div className="flex items-center gap-6">
          <Link
            href={
              isAdmin ? "/tenants" : mySlug ? `/tenants/${mySlug}` : "/onboarding"
            }
            className="font-display text-lg font-semibold text-brand-deep"
          >
            Lidh.al
            {isAdmin ? (
              <span className="ml-2 rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-blue">
                admin
              </span>
            ) : null}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-brand-ink/70">
            {isAdmin ? (
              <>
                <Link href="/tenants" className="hover:text-brand-deep">
                  <T al="Bizneset" en="Tenants" />
                </Link>
                <Link href="/persona-presets" className="hover:text-brand-deep">
                  <T al="Personalitete" en="Persona presets" />
                </Link>
              </>
            ) : mySlug ? (
              <Link
                href={`/tenants/${mySlug}`}
                className="hover:text-brand-deep"
              >
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
