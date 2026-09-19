import { api } from "@/lib/api-server";
import type { ResponderSettings } from "@/lib/api-core";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { ResponderSettingsForm } from "@/components/settings/ResponderSettings";
import { TestAssistantButton } from "@/components/settings/TestAssistantModal";

export const dynamic = "force-dynamic";

/** Settings › Who answers (ADR-020), with the assistant test chat in a modal. */
export default async function ResponderSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let responder: ResponderSettings | null = null;
  try {
    responder = await api.getResponder(slug);
  } catch {
    responder = null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-[15px] font-bold text-brand-deep">
            <T al="Kush u përgjigjet klientëve" en="Who answers customers" />
          </h3>
          <TestAssistantButton slug={slug} />
        </div>
        <p className="mt-1 text-[13px] text-slate-500">
          <T
            al="Parazgjedhja për çdo bisedë të re. Brenda çdo bisede mund ta ndryshosh vetëm për atë bisedë."
            en="The default for every new conversation. Inside any conversation you can still change it for that thread alone."
          />
        </p>
        <div className="mt-5">
          {responder ? (
            <ResponderSettingsForm slug={slug} initial={responder} />
          ) : (
            <p className="text-sm text-slate-400">
              <T al="Nuk u ngarkuan cilësimet." en="Settings could not be loaded." />
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
