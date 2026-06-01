import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api-server";
import type { Tenant } from "@/lib/api-core";
import { TenantDeleteButton } from "@/components/TenantDeleteButton";
import { T } from "@/components/T";

/** One-glance lifecycle badge. Order matters: archived wins over plan/trial. */
function PlanBadge({ tenant }: { tenant: Tenant }) {
  if (tenant.status === "archived") {
    return (
      <span className="rounded bg-brand-ink/10 px-2 py-0.5 text-xs font-medium text-brand-ink/60">
        <T al="arkivuar" en="archived" />
      </span>
    );
  }
  if (tenant.planId) {
    return (
      <span className="rounded bg-brand-mint/20 px-2 py-0.5 text-xs font-medium text-brand-deep">
        <T al="me pagesë" en="paid" />
      </span>
    );
  }
  if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()) {
    const days = Math.max(
      0,
      Math.ceil(
        (new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000,
      ),
    );
    return (
      <span className="rounded bg-accent-orange/15 px-2 py-0.5 text-xs font-medium text-accent-orange">
        <T al={`provë · ${days}d`} en={`trial · ${days}d`} />
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <T al="joaktiv" en="inactive" />
    </span>
  );
}

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
        <p className="font-medium">
          <T
            al="Bizneset nuk u ngarkuan."
            en="Couldn't load tenants."
          />
        </p>
        <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs">
          {msg}
        </pre>
        <p className="text-xs text-brand-ink/60">
          <T
            al="401 = nuk je i kyçur / token nuk arriti te proxy · 403 = i kyçur por email-i yt nuk është në PLATFORM_ADMIN_EMAILS · NETWORK = API nuk arrihet."
            en="401 = not signed in / no token reached the proxy · 403 = signed in but your email isn't in PLATFORM_ADMIN_EMAILS · NETWORK = API unreachable."
          />
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          <T al="Bizneset" en="Tenants" />
        </h1>
        <Link
          href="/tenants/new"
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90"
        >
          <T al="+ Biznes i ri" en="+ New tenant" />
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="text-brand-ink/60">
          <T
            al="Ende asnjë biznes. Krijo një dhe URL-ja e funelit gjenerohet automatikisht."
            en="No tenants yet. Create one and its funnel URL is generated automatically."
          />
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-fog text-left text-brand-ink/60">
              <tr>
                <th className="px-4 py-2 font-medium">
                  <T al="Emri" en="Name" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="Slug" en="Slug" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="Plani" en="Plan" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="URL e funelit" en="Funnel URL" />
                </th>
                <th className="px-4 py-2 font-medium text-right">
                  <T al="Veprime" en="Actions" />
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="border-t border-brand-ink/5 hover:bg-brand-fog/50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/tenants/${tenant.slug}`}
                      className="font-medium text-brand-blue hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-brand-ink/70">{tenant.slug}</td>
                  <td className="px-4 py-2">
                    <PlanBadge tenant={tenant} />
                  </td>
                  <td className="px-4 py-2 text-brand-ink/60">
                    <code className="break-all text-xs">{tenant.funnelUrl}</code>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <TenantDeleteButton id={tenant.id} name={tenant.name} />
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
