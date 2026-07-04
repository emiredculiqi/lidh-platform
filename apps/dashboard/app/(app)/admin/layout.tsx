import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";
import { AdminSidebar } from "@/components/shell/AdminSidebar";
import { LanguageToggle } from "@/components/LanguageToggle";

export const dynamic = "force-dynamic";

// The platform-admin console shell. Reuses the business design system (light,
// brand tokens, sidebar pattern) but with admin-global nav. Gated: only
// platform admins reach it; everyone else is bounced to their own workspace.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await api.me().catch(() => null);
  if (!me) redirect("/sign-in");
  if (!me.user.isPlatformAdmin) {
    redirect(
      me.memberships[0]
        ? `/tenants/${me.memberships[0].tenant.slug}`
        : "/onboarding",
    );
  }
  const userLabel = me.user.name || me.user.email || "";

  return (
    <div className="flex min-h-screen bg-brand-fog">
      <AdminSidebar userLabel={userLabel} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 flex-none items-center justify-end gap-3 border-b border-slate-200 bg-white/85 px-7 backdrop-blur">
          <LanguageToggle />
        </header>
        <div className="flex-1 p-7">{children}</div>
      </main>
    </div>
  );
}
