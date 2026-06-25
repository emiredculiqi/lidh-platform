import { TestChat } from "@/components/TestChat";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-500">
        <T
          al="Provoje asistentin si një vizitor — pa u shfaqur te Bisedat apo te raportet."
          en="Try the assistant as a visitor — it won't show in your inbox or reports."
        />
      </p>
      <TestChat tenantSlug={slug} />
    </div>
  );
}
