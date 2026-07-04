"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Post-login router. Runs CLIENT-SIDE on purpose: right after Clerk sign-in the
// server-side session isn't reliably settled for the first RSC render, so a
// server redirect() here would "stick" on /tenants until a manual refresh.
// Resolving on the client (after mount, when the Clerk cookie is set) and using
// router.replace() redirects reliably on the first load.
//   platform admin        → /admin/businesses
//   business owner         → /tenants/<their-slug>
//   brand-new (no tenant)  → /onboarding
export default function TenantsRouter() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me.user.isPlatformAdmin) {
          router.replace("/admin/businesses");
          return;
        }
        const slug = me.memberships[0]?.tenant?.slug;
        router.replace(slug ? `/tenants/${slug}` : "/onboarding");
      })
      .catch(() => {
        if (!cancelled) router.replace("/sign-in");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" />
    </div>
  );
}
