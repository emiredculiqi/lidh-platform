import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";
import { TenantDeleteButton } from "@/components/TenantDeleteButton";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  // ADR-013: non-admins don't see the all-tenants list. Send them to their
  // own tenant overview (or to /onboarding if they haven't created one yet).
  const me = await api.me();
  if (!me.user.isPlatformAdmin) {
    if (me.memberships.length === 0) redirect("/onboarding");
    redirect(`/tenants/${me.memberships[0].tenant.slug}`);
  }

  let tenants;
  try {
    tenants = await api.listTenants();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="space-y-2 text-red-600">
        <p className="font-medium">Couldn&apos;t load tenants.</p>
        <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs">
          {msg}
        </pre>
        <p className="text-xs text-brand-ink/60">
          401 = not signed in / no token reached the proxy · 403 = signed in
          but your email isn&apos;t in PLATFORM_ADMIN_EMAILS · NETWORK = API
          unreachable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          Tenants
        </h1>
        <Link
          href="/tenants/new"
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90"
        >
          + New tenant
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="text-brand-ink/60">
          No tenants yet. Create one to generate a demo link.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-fog text-left text-brand-ink/60">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Demo link</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-brand-ink/5 hover:bg-brand-fog/50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/tenants/${t.slug}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-brand-ink/70">{t.slug}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {t.isDemo ? (
                        <span className="rounded bg-accent-orange/15 px-2 py-0.5 text-xs font-medium text-accent-orange">
                          demo
                        </span>
                      ) : (
                        <span className="rounded bg-brand-mint/20 px-2 py-0.5 text-xs font-medium text-brand-deep">
                          paid
                        </span>
                      )}
                      {t.status === "archived" ? (
                        <span className="rounded bg-brand-ink/10 px-2 py-0.5 text-xs font-medium text-brand-ink/60">
                          archived
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-brand-ink/60">
                    {t.demoUrl ? (
                      <code className="break-all text-xs">{t.demoUrl}</code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <TenantDeleteButton id={t.id} name={t.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
