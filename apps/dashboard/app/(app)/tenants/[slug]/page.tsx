import Link from "next/link";
import { api } from "@/lib/api-server";
import type { ConversationListItem, Usage } from "@/lib/api-core";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { KpiStat } from "@/components/ui/KpiStat";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StagePill } from "@/components/contacts/Stage";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { contactDisplayName, contactInitials } from "@/lib/contact-name";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let usage: Usage | null = null;
  let conversations: ConversationListItem[] = [];
  try {
    const [u, list] = await Promise.all([
      api.getUsage(slug),
      api.listConversations(slug),
    ]);
    usage = u;
    conversations = list.items;
  } catch {
    // fall through — render what we have
  }

  const convCount = usage?.conversations ?? 0;
  const awaiting = usage?.awaitingReply ?? 0;
  const avgResponse = usage?.avgResponseSeconds ?? null;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiStat
          label={<T al="Biseda" en="Conversations" />}
          value={convCount.toLocaleString()}
          sub={<T al="këtë muaj" en="this month" />}
        />
        <KpiStat
          label={<T al="Kontakte të reja" en="New contacts" />}
          value={(usage?.newContacts ?? 0).toLocaleString()}
          sub={<T al="parë për herë të parë këtë muaj" en="first seen this month" />}
        />
        <KpiStat
          label={<T al="Në pritje të përgjigjes" en="Awaiting reply" />}
          value={awaiting.toLocaleString()}
          sub={<T al="klientë që presin tani" en="customers waiting right now" />}
        />
        <KpiStat
          label={<T al="Koha e përgjigjes" en="Response time" />}
          value={avgResponse == null ? "—" : formatDuration(avgResponse)}
          sub={<T al="mesatarisht këtë muaj" en="average this month" />}
        />
      </div>

      {/* Recent conversations — full width */}
    <Card padded={false}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-[15px] font-bold text-brand-deep">
            <T al="Bisedat e fundit" en="Recent conversations" />
          </h3>
          <Link
            href={`/tenants/${slug}/inbox`}
            className="text-[13px] font-semibold text-brand-blue hover:underline"
          >
            <T al="Shiko të gjitha" en="View all" />
          </Link>
        </div>
        {conversations.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            <T al="Ende asnjë bisedë." en="No conversations yet." />
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/tenants/${slug}/inbox/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
                  {contactInitials({
                    name: c.contactName,
                    phone: c.contactPhone,
                    email: c.contactEmail,
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-brand-deep">
                      {contactDisplayName({
                        name: c.contactName,
                        phone: c.contactPhone,
                        email: c.contactEmail,
                      }) ?? <T al="Vizitor anonim" en="Anonymous visitor" />}
                    </span>
                    <ChannelBadge kind={c.channelKind} />
                  </div>
                  <div className="truncate text-[12.5px] text-slate-400">
                    {c.lastMessagePreview}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <StagePill stage={c.contactStage} />
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(c.lastMsgAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}
