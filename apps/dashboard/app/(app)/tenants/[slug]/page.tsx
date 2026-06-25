import Link from "next/link";
import { api } from "@/lib/api-server";
import type { ConversationListItem, Tenant, Usage } from "@/lib/api-core";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { KpiStat } from "@/components/ui/KpiStat";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let usage: Usage | null = null;
  let conversations: ConversationListItem[] = [];
  let tenant: Tenant | null = null;
  try {
    [usage, conversations, tenant] = await Promise.all([
      api.getUsage(slug),
      api.listConversations(slug),
      api.getTenant(slug),
    ]);
  } catch {
    // fall through — render what we have
  }

  const convCount = usage?.conversations ?? 0;
  const aiHandled =
    convCount > 0
      ? Math.round(((convCount - (usage?.handoffs ?? 0)) / convCount) * 100)
      : 100;
  const messages = (usage?.messagesIn ?? 0) + (usage?.messagesOut ?? 0);

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
          value={(usage?.leads ?? 0).toLocaleString()}
          sub={<T al="kapur automatikisht" en="captured automatically" />}
        />
        <KpiStat
          label={<T al="Trajtuar nga AI" en="Handled by AI" />}
          value={`${aiHandled}%`}
          sub={<T al="pa ndërhyrje njeriu" en="without human help" />}
        />
        <KpiStat
          label={<T al="Mesazhe" en="Messages" />}
          value={messages.toLocaleString()}
          sub={<T al="dërguar & marrë" en="sent & received" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent conversations */}
        <Card className="lg:col-span-2" padded={false}>
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
                    {(c.contactName ?? "·").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-brand-deep">
                        {c.contactName ?? (
                          <T al="Vizitor anonim" en="Anonymous visitor" />
                        )}
                      </span>
                      <ChannelBadge kind={c.channelKind} />
                    </div>
                    <div className="truncate text-[12.5px] text-slate-400">
                      {c.lastMessagePreview}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <StatusPill status={c.status} />
                    <span className="text-[11px] text-slate-400">
                      {formatDateTime(c.lastMsgAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Share / funnel + quick links */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-brand-deep to-[#071E4F] text-white">
            <div className="text-[12px] font-semibold text-brand-sky">
              <T al="✦ FAQJA JOTE" en="✦ YOUR PAGE" />
            </div>
            <p className="mt-2 text-[13px] text-[#CADBF5]">
              <T
                al="Ndaje këtë lidhje ose ngjit widget-in në faqen tënde."
                en="Share this link or embed the widget on your site."
              />
            </p>
            {tenant?.funnelUrl ? (
              <a
                href={tenant.funnelUrl}
                target="_blank"
                rel="noopener"
                className="mt-3 block break-all rounded-lg bg-white/10 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-white/15"
              >
                {tenant.funnelUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            <Link
              href={`/tenants/${slug}/developer`}
              className="mt-3 inline-block text-[12.5px] font-semibold text-brand-sky hover:underline"
            >
              <T al="Merr kodin e widget-it →" en="Get the widget code →" />
            </Link>
          </Card>

          <Card>
            <h3 className="text-[15px] font-bold text-brand-deep">
              <T al="Veprime të shpejta" en="Quick actions" />
            </h3>
            <div className="mt-3 flex flex-col gap-2 text-[13.5px] font-medium text-slate-600">
              <Link href={`/tenants/${slug}/agent`} className="hover:text-brand-blue">
                <T al="Konfiguro asistentin →" en="Configure assistant →" />
              </Link>
              <Link href={`/tenants/${slug}/leads`} className="hover:text-brand-blue">
                <T al="Shiko klientët potencialë →" en="View leads →" />
              </Link>
              <Link href={`/tenants/${slug}/test`} className="hover:text-brand-blue">
                <T al="Testo asistentin →" en="Test the assistant →" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
