import { api } from "@/lib/api-server";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { LiveProvider } from "@/components/shell/LiveProvider";

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
  try {
    const [tenant, me] = await Promise.all([api.getTenant(slug), api.me()]);
    tenantName = tenant.name;
    userLabel = me.user.name || me.user.email || "";
    if (tenant.trialEndsAt && !tenant.planId) {
      const ms = new Date(tenant.trialEndsAt).getTime() - Date.now();
      trialDays = ms > 0 ? Math.ceil(ms / 86_400_000) : null;
    }
  } catch {
    // tenant/me failed — render the shell with fallbacks; the page errors.
  }

  return (
    <LiveProvider slug={slug}>
      <div className="flex min-h-screen bg-brand-fog">
        <Sidebar
          slug={slug}
          tenantName={tenantName}
          userLabel={userLabel}
          trialDays={trialDays}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar slug={slug} />
          <div className="flex-1 p-7">{children}</div>
        </main>
      </div>
    </LiveProvider>
  );
}
