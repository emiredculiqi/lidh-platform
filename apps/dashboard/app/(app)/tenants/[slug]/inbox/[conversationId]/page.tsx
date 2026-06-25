import Link from "next/link";
import { api } from "@/lib/api-server";
import { Markdown } from "@/components/Markdown";
import { T } from "@/components/T";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { ContactPanel } from "@/components/inbox/ContactPanel";
import { TakeoverBar } from "@/components/inbox/TakeoverBar";
import { formatTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>;
}) {
  const { slug, conversationId } = await params;
  const thread = await api.getThread(conversationId);
  const name = thread.contactName || thread.contactPhone;

  return (
    <div className="flex min-w-0 flex-1">
      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-3 border-b border-slate-200 px-5 py-3">
          <Link
            href={`/tenants/${slug}/inbox`}
            className="text-slate-500 lg:hidden"
            aria-label="Back"
          >
            ←
          </Link>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
            {(name ?? "·").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-brand-deep">
              {name || <T al="Vizitor anonim" en="Anonymous visitor" />}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <ChannelBadge kind={thread.channelKind} />
              <StatusPill status={thread.status} />
              {thread.aiPaused ? (
                <span className="text-[11px] font-medium text-amber-600">
                  <T al="AI i pezulluar" en="AI paused" />
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-brand-fog px-5 py-5">
          {thread.messages.map((m, i) => {
            if (m.role === "tool") {
              return (
                <div key={i} className="text-center text-[11px] text-slate-400">
                  <T al="— veglë: " en="— tool: " />
                  {m.toolName} —
                </div>
              );
            }
            const isCustomer = m.role === "user";
            return (
              <div
                key={i}
                className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm ${
                    isCustomer
                      ? "rounded-2xl rounded-bl-sm border border-slate-200 bg-white text-brand-ink"
                      : "rounded-2xl rounded-br-sm bg-brand-blue text-white"
                  }`}
                >
                  {isCustomer ? (
                    <p className="whitespace-pre-wrap">{m.contentText}</p>
                  ) : (
                    <Markdown content={m.contentText ?? ""} />
                  )}
                  <p
                    className={`mt-1 text-[10px] ${
                      isCustomer ? "text-slate-400" : "text-white/60"
                    }`}
                  >
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <TakeoverBar conversationId={thread.id} aiPaused={thread.aiPaused} />
      </div>

      <ContactPanel slug={slug} thread={thread} />
    </div>
  );
}
