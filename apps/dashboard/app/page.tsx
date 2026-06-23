import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";

export const dynamic = "force-dynamic";

// Post-login router. Sends each user straight to the right home in ONE hop:
//   platform admin        → /tenants            (all-tenants list)
//   business owner        → /tenants/<their-slug>
//   brand-new (no tenant) → /onboarding
//
// Doing it here — instead of bouncing everyone through /tenants — stops a
// business user from transiting the admin-only page, which re-ran /me and
// re-redirected, causing a slow/stuck double redirect on first login.
export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let me = null;
  try {
    me = await api.me();
  } catch {
    // /me transiently failed (e.g. cold API). Fall back to /tenants, which
    // re-resolves and routes — better than hard-erroring the landing page.
    me = null;
  }
  if (!me) redirect("/tenants");

  if (me.user.isPlatformAdmin) redirect("/tenants");
  if (me.memberships.length === 0) redirect("/onboarding");
  redirect(`/tenants/${me.memberships[0].tenant.slug}`);
}
