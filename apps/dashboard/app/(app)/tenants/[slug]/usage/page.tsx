import { api } from "@/lib/api-server";
import { T } from "@/components/T";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function UsagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const u = await api.getUsage(slug);

  const cards: { label: React.ReactNode; value: number; hint?: React.ReactNode }[] =
    [
      {
        label: <T al="Biseda" en="Conversations" />,
        value: u.conversations,
        hint: <T al="aktive këtë muaj" en="active this month" />,
      },
      {
        label: <T al="Mesazhe nga vizitorët" en="Visitor messages" />,
        value: u.messagesIn,
      },
      {
        label: <T al="Përgjigje nga agjenti" en="Agent replies" />,
        value: u.messagesOut,
      },
      {
        label: <T al="Klientë potencialë" en="Leads" />,
        value: u.leads,
      },
      {
        label: <T al="Deligim Bisede tek Stafi" en="Handoffs to staff" />,
        value: u.handoffs,
      },
      {
        label: <T al="Përdorim AI" en="AI usage" />,
        value: u.tokensIn + u.tokensOut,
        hint: <T al="tokenë" en="tokens" />,
      },
    ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        <T al="Përdorimi" en="Usage" />
      </h1>

      <p className="text-sm text-brand-ink/55">
        <T al="Këtë muaj, që nga" en="This month, since" />{" "}
        {formatDate(u.monthStart)}.{" "}
        <T
          al="Bisedat e testimit nuk numërohen."
          en="Test conversations are not counted."
        />
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-xl border border-brand-ink/10 bg-white p-5"
          >
            <div className="font-display text-3xl font-semibold text-brand-deep">
              {c.value.toLocaleString()}
            </div>
            <div className="mt-1 text-sm font-medium text-brand-ink/70">
              {c.label}
            </div>
            {c.hint ? (
              <div className="text-xs text-brand-ink/45">{c.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
