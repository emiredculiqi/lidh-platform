import { TestChat } from "@/components/TestChat";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

// Test tab: try the assistant as a visitor (won't show in the inbox or usage).
export default async function TestTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[13px] text-slate-500">
        <T
          al="Provoje asistentin si një vizitor — pa u shfaqur te Bisedat apo raportet."
          en="Try the assistant as a visitor — it won't show in the inbox or reports."
        />
      </p>
      <TestChat tenantSlug={slug} />
    </div>
  );
}
