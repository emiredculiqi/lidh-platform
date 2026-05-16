import { TenantNav } from "@/components/TenantNav";
import { TestChat } from "@/components/TestChat";

export const dynamic = "force-dynamic";

export default async function TestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        Test agent
      </h1>
      <TenantNav slug={slug} active="/test" />
      <TestChat tenantSlug={slug} />
    </div>
  );
}
