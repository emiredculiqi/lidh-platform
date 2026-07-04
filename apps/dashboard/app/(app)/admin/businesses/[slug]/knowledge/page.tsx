import { api } from "@/lib/api-server";
import { AddKnowledge } from "@/components/AddKnowledge";
import { Card } from "@/components/ui/Card";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  ready: "bg-emerald-50 text-emerald-600",
  processing: "bg-amber-50 text-amber-600",
  pending: "bg-slate-100 text-slate-500",
  failed: "bg-red-50 text-red-600",
};

// Knowledge tab: existing sources (status + chunk count) + add new (url/text/file).
export default async function KnowledgeTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sources = await api.listKnowledge(slug).catch(() => []);

  return (
    <div className="space-y-5">
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-3 text-[13px] font-semibold text-brand-deep">
          <T al="Burimet e njohurive" en="Knowledge sources" /> ({sources.length})
        </div>
        {sources.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-slate-400">
            <T al="Asnjë burim ende." en="No sources yet." />
          </p>
        ) : (
          <div>
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border-b border-slate-50 px-5 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-brand-ink">
                    {s.uri}
                  </div>
                  <div className="text-[12px] text-slate-400">
                    {s.kind} · {s._count?.chunks ?? 0}{" "}
                    <T al="copë" en="chunks" />
                    {s.error ? ` · ${s.error}` : ""}
                  </div>
                </div>
                <span
                  className={`flex-none rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    STATUS_TONE[s.status] ?? "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddKnowledge tenantSlug={slug} />
    </div>
  );
}
