import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "@/lib/api-server";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

function field(p: Record<string, unknown>, k: string): string {
  const v = p?.[k];
  return typeof v === "string" && v.trim() ? v : "—";
}

const LEAD_STATUS: Record<string, { al: string; en: string; cls: string }> = {
  new_: { al: "I ri", en: "New", cls: "bg-blue-50 text-brand-blue" },
  new: { al: "I ri", en: "New", cls: "bg-blue-50 text-brand-blue" },
  contacted: { al: "Kontaktuar", en: "Contacted", cls: "bg-amber-50 text-amber-600" },
  won: { al: "Fituar", en: "Won", cls: "bg-emerald-50 text-emerald-600" },
  lost: { al: "Humbur", en: "Lost", cls: "bg-slate-100 text-slate-500" },
};

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const leads = await api.listLeads(slug);

  if (leads.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sm text-slate-400">
          <T
            al="Ende asnjë kontakt i kapur. Asistenti ruan një kontakt kur një vizitor tregon interes të qartë."
            en="No leads captured yet. The assistant saves a lead when a visitor shows clear interest."
          />
        </p>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="divide-y divide-slate-100">
        {leads.map((l) => {
          const p = (l.payload ?? {}) as Record<string, unknown>;
          const st = LEAD_STATUS[l.status] ?? {
            al: l.status,
            en: l.status,
            cls: "bg-slate-100 text-slate-500",
          };
          const name = l.contactName || field(p, "name");
          const inner: ReactNode = (
            <>
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12.5px] font-bold text-brand-blue">
                {(name === "—" ? "·" : name).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold text-brand-deep">
                    {name}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}
                  >
                    <T al={st.al} en={st.en} />
                  </span>
                </div>
                <div className="truncate text-[12.5px] text-slate-400">
                  {[l.contactPhone || field(p, "phone"), field(p, "email")]
                    .filter((x) => x && x !== "—")
                    .join(" · ") || "—"}
                </div>
                {field(p, "notes") !== "—" ? (
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] text-slate-500">
                    {field(p, "notes")}
                  </p>
                ) : null}
              </div>
              <div className="flex-none text-right text-[11px] text-slate-400">
                {formatDateTime(l.capturedAt)}
              </div>
            </>
          );
          return l.contactId ? (
            <Link
              key={l.id}
              href={`/tenants/${slug}/contacts/${l.contactId}`}
              className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
            >
              {inner}
            </Link>
          ) : (
            <div key={l.id} className="flex items-center gap-3 px-5 py-3.5">
              {inner}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
