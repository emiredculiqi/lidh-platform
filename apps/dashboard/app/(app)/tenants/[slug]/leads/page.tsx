import { api } from "@/lib/api-server";
import { TenantNav } from "@/components/TenantNav";
import { T } from "@/components/T";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

function field(p: Record<string, unknown>, k: string): string {
  const v = p?.[k];
  return typeof v === "string" && v.trim() ? v : "—";
}

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const leads = await api.listLeads(slug);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        <T al="Klientë potencialë" en="Leads" />
      </h1>
      <TenantNav slug={slug} active="leads" />

      {leads.length === 0 ? (
        <p className="text-sm text-brand-ink/55">
          <T
            al="Ende asnjë lead i kapur. Agjenti ruan një lead kur një vizitor tregon interes të qartë."
            en="No leads captured yet. The agent saves a lead when a visitor shows clear interest."
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
                  <T al="Telefoni / Email" en="Phone / Email" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="Shënime" en="Notes" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="Statusi" en="Status" />
                </th>
                <th className="px-4 py-2 font-medium">
                  <T al="Kapur më" en="Captured" />
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const p = (l.payload ?? {}) as Record<string, unknown>;
                return (
                  <tr key={l.id} className="border-t border-brand-ink/5">
                    <td className="px-4 py-2">
                      {l.contactName || field(p, "name")}
                    </td>
                    <td className="px-4 py-2 text-brand-ink/70">
                      {l.contactPhone || field(p, "phone")}
                      <br />
                      {field(p, "email")}
                    </td>
                    <td className="px-4 py-2 text-brand-ink/70">
                      {field(p, "notes")}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-brand-ink/55">
                      {formatDateTime(l.capturedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
