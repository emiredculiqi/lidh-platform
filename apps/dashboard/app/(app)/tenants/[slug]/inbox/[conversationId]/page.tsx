import Link from "next/link";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>;
}) {
  const { slug, conversationId } = await params;
  const thread = await api.getThread(conversationId);

  return (
    <div className="space-y-5">
      <Link
        href={`/tenants/${slug}/inbox`}
        className="text-sm text-brand-blue hover:underline"
      >
        ← Inbox
      </Link>

      <div>
        <h1 className="font-display text-xl font-semibold text-brand-deep">
          {thread.contactName || thread.contactPhone || "Anonymous visitor"}
        </h1>
        <p className="text-sm text-brand-ink/55">
          {thread.channelKind} · {thread.status}
          {thread.aiPaused ? " · AI paused" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {thread.messages.map((m, i) => {
          if (m.role === "tool") {
            return (
              <div
                key={i}
                className="text-center text-xs text-brand-ink/40"
              >
                — tool: {m.toolName} —
              </div>
            );
          }
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isUser
                    ? "bg-white border border-brand-ink/10 text-brand-ink"
                    : "bg-brand-blue text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.contentText}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    isUser ? "text-brand-ink/40" : "text-white/60"
                  }`}
                >
                  {new Date(m.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
