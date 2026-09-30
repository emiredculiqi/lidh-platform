import { api } from "@/lib/api-server";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileNav } from "@/components/shell/MobileNav";
import { Topbar } from "@/components/shell/Topbar";
import { LiveProvider } from "@/components/shell/LiveProvider";
import { ReadOnlyBanner } from "@/components/shell/ReadOnlyBanner";

export const dynamic = "force-dynamic";

// The business workspace shell (redesign): sidebar + topbar around every
// /tenants/<slug>/* page. Replaces the old per-page TenantNav tabs.
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let tenantName = slug;
  let trialDays: number | null = null;
  let userLabel = "";
  let canManageTeam = false;
  let dashboardMode = "full";
  try {
    const [tenant, me] = await Promise.all([api.getTenant(slug), api.me()]);
    tenantName = tenant.name;
    dashboardMode = tenant.dashboard ?? "full";
    userLabel = me.user.name || me.user.email || "";
    // Owner/admin (or platform admin) can manage the team — gates the nav item.
    canManageTeam =
      me.user.isPlatformAdmin ||
      me.memberships.some(
        (m) =>
          m.tenant.slug === slug &&
          (m.role === "owner" || m.role === "admin"),
      );
    if (tenant.trialEndsAt && !tenant.planId) {
      const ms = new Date(tenant.trialEndsAt).getTime() - Date.now();
      trialDays = ms > 0 ? Math.ceil(ms / 86_400_000) : null;
    }
  } catch {
    // tenant/me failed — render the shell with fallbacks; the page errors.
  }

  return (
    <LiveProvider slug={slug}>
      {/* App shell: the viewport is the frame and the content column scrolls,
          so the inbox can fill exactly the space under the top bar with no
          magic numbers, and the banner costs nothing to account for.
          h-screen is the fallback where dvh is unsupported. On phones the
          bottom tab bar replaces the sidebar; the content is padded by its
          height (3.5rem + the home-indicator inset) so nothing hides under it. */}
      <div className="flex h-screen h-dvh bg-brand-fog">
        <Sidebar
          slug={slug}
          tenantName={tenantName}
          userLabel={userLabel}
          trialDays={trialDays}
          canManageTeam={canManageTeam}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ReadOnlyBanner dashboard={dashboardMode} />
          <Topbar slug={slug} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:p-7">
            {children}
          </div>
        </main>
        <MobileNav slug={slug} canManageTeam={canManageTeam} />
      </div>
    </LiveProvider>
  );
}
