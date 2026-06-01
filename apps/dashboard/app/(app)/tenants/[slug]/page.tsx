import { api } from "@/lib/api-server";
import { TenantNav } from "@/components/TenantNav";
import { AddKnowledge } from "@/components/AddKnowledge";
import { TenantLifecycle } from "@/components/TenantLifecycle";
import { FunnelPanel } from "@/components/FunnelPanel";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  ready: "text-brand-deep bg-brand-mint/20",
  processing: "text-brand-blue bg-brand-blue/10",
  pending: "text-brand-ink/60 bg-brand-ink/5",
  failed: "text-red-600 bg-red-50",
};

export default async function TenantOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tenant, sources, me] = await Promise.all([
    api.getTenant(slug),
    api.listKnowledge(slug),
    api.me(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          {tenant.name}
        </h1>
        <p className="text-sm text-brand-ink/55">
          {tenant.slug} ·{" "}
          <span
            className={
              tenant.status === "archived"
                ? "font-medium text-accent-orange"
                : "text-brand-ink/55"
            }
          >
            {tenant.status === "archived" ? (
              <T al="arkivuar" en="archived" />
            ) : (
              <T al="aktiv" en="active" />
            )}
          </span>{" "}
          ·{" "}
          <T
            al={`gjuha kryesore ${tenant.defaultLocale}`}
            en={`default locale ${tenant.defaultLocale}`}
          />
        </p>
      </div>

      <TenantNav slug={slug} active="overview" />

      <FunnelPanel tenant={tenant} isPlatformAdmin={me.user.isPlatformAdmin} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-deep">
          <T al="Njohuria" en="Knowledge" />
        </h2>
        <AddKnowledge tenantSlug={slug} />
        {sources.length === 0 ? (
          <p className="text-sm text-brand-ink/55">
            <T
              al="Asnjë burim deri tani. Shto faqen e klientit lart — bëhet crawl, ndahet dhe embed-ohet automatikisht."
              en="No sources yet. Add the customer's website above — it gets crawled, chunked and embedded automatically."
            />
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-brand-fog text-left text-brand-ink/60">
                <tr>
                  <th className="px-4 py-2 font-medium">
                    <T al="Burimi" en="Source" />
                  </th>
                  <th className="px-4 py-2 font-medium">
                    <T al="Statusi" en="Status" />
                  </th>
                  <th className="px-4 py-2 font-medium">
                    <T al="Pjesë" en="Chunks" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-t border-brand-ink/5">
                    <td className="px-4 py-2">
                      <span className="text-brand-ink/50">{s.kind}</span>{" "}
                      <span className="break-all">{s.uri}</span>
                      {s.status === "failed" && s.error ? (
                        <div className="mt-1 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <span aria-hidden>⚠️</span>
                          <span>
                            <strong>
                              <T
                                al="Burimi nuk u përpunua."
                                en="Couldn't process this source."
                              />
                            </strong>{" "}
                            {s.error}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLOR[s.status] ?? ""
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-brand-ink/70">
                      {s._count?.chunks ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-brand-ink/45">
              <T
                al="Rifresko faqen për të parë statusin më të fundit."
                en="Refresh the page to update ingestion status."
              />
            </p>
          </div>
        )}
      </section>

      <TenantLifecycle
        id={tenant.id}
        slug={tenant.slug}
        status={tenant.status}
      />
    </div>
  );
}
