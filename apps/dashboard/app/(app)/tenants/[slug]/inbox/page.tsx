import Link from "next/link";
import { api } from "@/lib/api-server";
import { TenantNav } from "@/components/TenantNav";
import { T } from "@/components/T";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convos = await api.listConversations(slug);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-brand-deep">
        <T al="Mesazhet" en="Inbox" />
      </h1>
      <TenantNav slug={slug} active="inbox" />

      {convos.length === 0 ? (
        <p className="text-sm text-brand-ink/55">
          <T
            al="Asnjë bisedë deri tani. Do të shfaqen këtu kur klientët të bisedojnë (web / WhatsApp)."
            en="No conversations yet. They appear here as customers chat (web / WhatsApp)."
          />
        </p>
      ) : (
        <div className="divide-y divide-brand-ink/5 overflow-hidden rounded-xl border border-brand-ink/10 bg-white">
          {convos.map((c) => (
            <Link
              key={c.id}
              href={`/tenants/${slug}/inbox/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-brand-fog/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-deep">
                  {c.contactName || c.contactPhone || (
                    <T al="Vizitor anonim" en="Anonymous visitor" />
                  )}
                  <span className="ml-2 rounded bg-brand-ink/5 px-1.5 py-0.5 text-[10px] uppercase text-brand-ink/55">
                    {c.channelKind}
                  </span>
                </p>
                <p className="truncate text-sm text-brand-ink/55">
                  {c.lastMessagePreview || "—"}
                </p>
              </div>
              <div className="ml-4 shrink-0 text-right text-xs text-brand-ink/45">
                <div>
                  {c.messageCount} <T al="mesazhe" en="msgs" />
                </div>
                <div>{new Date(c.lastMsgAt).toLocaleString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
