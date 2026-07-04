import { api } from "@/lib/api-server";
import { AgentEditor } from "@/components/AgentEditor";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

// Assistant tab: persona per language + model. (Tools, business facts and
// default-locale setters exist in the API and can be surfaced here next.)
export default async function AssistantTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await api.getAgent(slug);
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-[13px] text-slate-500">
        <T
          al="Personaliteti dhe modeli i asistentit. Ndryshimet aplikohen në mesazhin tjetër."
          en="The assistant's persona and model. Changes apply on the next message."
        />
      </p>
      <AgentEditor tenantSlug={slug} initial={agent} />
    </div>
  );
}
