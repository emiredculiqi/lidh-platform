import { api } from "@/lib/api-server";
import { AgentEditor } from "@/components/AgentEditor";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await api.getAgent(slug);

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-500">
        <T
          al="Ndrysho personalitetin sipas gjuhës dhe modelin. Ndryshimet aplikohen në mesazhin tjetër — provoji te skeda Testo agjentin."
          en="Edit the persona per language and the model. Changes apply on the next message — try them in the Test agent tab."
        />
      </p>
      <AgentEditor tenantSlug={slug} initial={agent} />
    </div>
  );
}
