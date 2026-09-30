import Link from "next/link";
import { api } from "@/lib/api-server";
import { Markdown } from "@/components/Markdown";
import { T } from "@/components/T";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StagePill } from "@/components/contacts/Stage";
import { ContactPanel } from "@/components/inbox/ContactPanel";
import { TakeoverBar } from "@/components/inbox/TakeoverBar";
import { MarkRead } from "@/components/inbox/MarkRead";
import { StarButton } from "@/components/inbox/StarButton";
import { ThreadPresence } from "@/components/inbox/ThreadPresence";
import { ThreadFrame } from "@/components/inbox/ThreadFrame";
import { ThreadScroll } from "@/components/inbox/ThreadScroll";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { contactDisplayName } from "@/lib/contact-name";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>;
}) {
  const { slug, conversationId } = await params;
  const thread = await api.getThread(conversationId);
  const name = contactDisplayName({
    name: thread.contactName,
    phone: thread.contactPhone,
    email: thread.contactEmail,
  });
  // Team awareness (ADR-024 §3): who holds the thread, or who answered last.
  const me = thread.viewerUserId;
  const holder = thread.assignedTo;
  const last = thread.lastHumanReplyBy;
  const who = (m: { userId: string; name: string | null }, al: boolean) =>
    m.userId === me ? (al ? "Ti" : "You") : m.name ?? (al ? "Një koleg" : "A colleague");

  // Reachable details shown right under the name, so they are visible even
  // where the contact panel is collapsed (narrow windows).
  const reach = [thread.contactEmail, thread.contactPhone]
    .filter((v): v is string => Boolean(v) && v !== name)
    .join(" · ");

  return (
    <ThreadFrame panel={<ContactPanel slug={slug} thread={thread} />}>
      <MarkRead conversationId={thread.id} signal={thread.messages.length} />
      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-3 border-b border-slate-200 px-5 py-3 pr-28 2xl:pr-5">
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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-[14px] font-bold text-brand-deep">
                {name || <T al="Vizitor anonim" en="Anonymous visitor" />}
              </span>
              <StarButton conversationId={thread.id} starred={thread.starred} size={16} />
            </div>
            {reach ? (
              <div className="truncate text-[12px] text-slate-500">{reach}</div>
            ) : null}
            <div className="mt-0.5 flex items-center gap-2">
              <ChannelBadge kind={thread.channelKind} />
              <StagePill stage={thread.contactStage} />
              <span
                className={`text-[11px] font-medium ${
                  thread.aiEffective === "ai" ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                {thread.aiEffective === "ai" ? (
                  <T al="Përgjigjet asistenti" en="Assistant answering" />
                ) : (
                  <T al="Përgjigjet ekipi" en="Team answering" />
                )}
              </span>
              {holder ? (
                <span className="truncate text-[11px] text-slate-500">
                  ·{" "}
                  <T
                    al={`${who(holder, true)} po e trajton`}
                    en={`${who(holder, false)} ${holder.userId === me ? "are" : "is"} handling this`}
                  />
                </span>
              ) : last && thread.lastHumanReplyAt ? (
                <span className="truncate text-[11px] text-slate-500">
                  ·{" "}
                  <T
                    al={`${who(last, true)} u përgjigj ${formatDateTime(thread.lastHumanReplyAt)}`}
                    en={`${who(last, false)} replied ${formatDateTime(thread.lastHumanReplyAt)}`}
                  />
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ThreadScroll
          key={thread.id}
          signal={thread.messages.length}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-brand-fog px-5 py-5"
        >
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
        </ThreadScroll>

        <ThreadPresence
          conversationId={thread.id}
          viewerUserId={thread.viewerUserId}
          initialViewers={thread.viewers}
          assignedTo={thread.assignedTo}
        >
          <TakeoverBar
            conversationId={thread.id}
            aiOverride={thread.aiOverride}
            aiEffective={thread.aiEffective}
            aiDefault={thread.aiDefault}
            canSuggest={thread.messages[thread.messages.length - 1]?.role === "user"}
          />
        </ThreadPresence>
      </div>
    </ThreadFrame>
  );
}
