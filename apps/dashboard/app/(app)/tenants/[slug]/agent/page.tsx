import { api } from "@/lib/api-server";
import { TenantNav } from "@/components/TenantNav";
import { AgentEditor } from "@/components/AgentEditor";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await api.getAgent(slug);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        Agent
      </h1>
      <TenantNav slug={slug} active="/agent" />
      <p className="text-sm text-brand-ink/55">
        Edit the persona per language. Changes apply on the next message —
        iterate here, then check the Test agent tab.
      </p>
      <AgentEditor tenantSlug={slug} initial={agent} />
    </div>
  );
}
