import Link from "next/link";
import { api } from "@/lib/api-server";
import type { Tenant } from "@/lib/api-core";
import { T } from "@/components/T";
import { TenantDeleteButton } from "@/components/TenantDeleteButton";

/** One-glance lifecycle badge. Order: archived > paid > trial > inactive. */
function StatusBadge({ tenant }: { tenant: Tenant }) {
  if (tenant.status === "archived")
    return <Badge tone="slate" al="arkivuar" en="archived" />;
  if (tenant.planId) return <Badge tone="mint" al="me pagesë" en="paid" />;
  if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date()) {
    const days = Math.max(
      0,
      Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86_400_000),
    );
    return <Badge tone="orange" al={`provë · ${days}d`} en={`trial · ${days}d`} />;
  }
  return <Badge tone="red" al="joaktiv" en="inactive" />;
}

function Badge({
  tone,
  al,
  en,
}: {
  tone: "slate" | "mint" | "orange" | "red";
  al: string;
  en: string;
}) {
  const cls = {
    slate: "bg-slate-100 text-slate-600",
    mint: "bg-brand-mint/20 text-brand-deep",
    orange: "bg-accent-orange/15 text-accent-orange",
    red: "bg-red-100 text-red-700",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <T al={al} en={en} />
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage() {
  let tenants: Tenant[] = [];
  let error: string | null = null;
  try {
    tenants = await api.listTenants();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-brand-deep">
            <T al="Bizneset" en="Businesses" />
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            <T
              al="Konfiguro dhe mirëmbaj asistentin AI të çdo biznesi"
              en="Configure and maintain each business's AI assistant"
            />
          </p>
        </div>
        <Link
          href="/tenants/new"
          className="rounded-[10px] bg-brand-blue px-4 py-2 text-[13.5px] font-semibold text-white shadow-glow transition hover:opacity-90"
        >
          <T al="+ Biznes i ri" en="+ New business" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <T al="Bizneset nuk u ngarkuan." en="Couldn't load businesses." />
          <pre className="mt-2 overflow-x-auto text-[11px]">{error}</pre>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-brand-fog text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold"><T al="Emri" en="Name" /></th>
                <th className="px-4 py-2.5 font-semibold"><T al="Statusi" en="Status" /></th>
                <th className="px-4 py-2.5 font-semibold"><T al="Pronari" en="Owner" /></th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-slate-100 transition hover:bg-brand-fog/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/businesses/${t.slug}`}
                      className="font-semibold text-brand-deep hover:text-brand-blue"
                    >
                      {t.name}
                    </Link>
                    <div className="text-[12px] text-slate-400">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tenant={t} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.ownerEmail ?? (
                      t.pendingOwnerEmail ? (
                        <span className="text-amber-600">
                          {t.pendingOwnerEmail}{" "}
                          <T al="(në pritje)" en="(pending)" />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/businesses/${t.slug}`}
                        className="text-[12.5px] font-semibold text-brand-blue hover:underline"
                      >
                        <T al="Konfiguro →" en="Configure →" />
                      </Link>
                      <TenantDeleteButton id={t.id} name={t.name} />
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    <T al="Asnjë biznes ende." en="No businesses yet." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
