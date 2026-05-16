import { api } from "@/lib/api";
import { TenantNav } from "@/components/TenantNav";
import { AddKnowledge } from "@/components/AddKnowledge";

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
  const [tenant, sources] = await Promise.all([
    api.getTenant(slug),
    api.listKnowledge(slug),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-brand-deep">
          {tenant.name}
        </h1>
        <p className="text-sm text-brand-ink/55">
          {tenant.slug} · {tenant.isDemo ? "demo" : "paid"} · default locale{" "}
          {tenant.defaultLocale}
        </p>
      </div>

      <TenantNav slug={slug} active="overview" />

      {tenant.demoUrl ? (
        <section className="rounded-xl border border-accent-orange/30 bg-accent-orange/5 p-4">
          <p className="text-sm font-medium text-brand-deep">Demo link</p>
          <code className="mt-1 block break-all text-sm">
            {tenant.demoUrl}
          </code>
          {tenant.demoExpiresAt ? (
            <p className="mt-1 text-xs text-brand-ink/55">
              Expires {new Date(tenant.demoExpiresAt).toLocaleString()}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-deep">
          Knowledge
        </h2>
        <AddKnowledge tenantSlug={slug} />
        {sources.length === 0 ? (
          <p className="text-sm text-brand-ink/55">
            No sources yet. Add the customer&apos;s website above — it gets
            crawled, chunked and embedded automatically.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-brand-fog text-left text-brand-ink/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Chunks</th>
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
                            <strong>Couldn&apos;t process this source.</strong>{" "}
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
              Refresh the page to update ingestion status.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
