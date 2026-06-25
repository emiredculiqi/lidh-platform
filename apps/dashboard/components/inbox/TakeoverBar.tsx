"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

/** Footer of a conversation: take over (pause AI), reply as a human, or hand
 *  back to the AI. */
export function TakeoverBar({
  conversationId,
  aiPaused,
}: {
  conversationId: string;
  aiPaused: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(aiPaused);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const t = useT({
    al: {
      takeover: "Merr përsipër bisedën",
      replying: "Po përgjigjesh ti — AI është në pauzë",
      giveBack: "Kthe te AI",
      placeholder: "Shkruaj përgjigjen…",
      send: "Dërgo",
    },
    en: {
      takeover: "Take over the conversation",
      replying: "You're replying — AI is paused",
      giveBack: "Hand back to AI",
      placeholder: "Type your reply…",
      send: "Send",
    },
  });

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await api.setConversationAi(conversationId, next);
      setPaused(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await api.replyToConversation(conversationId, v);
      setText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!paused) {
    return (
      <div className="flex-none border-t border-slate-200 bg-white px-5 py-3">
        <button
          onClick={() => toggle(true)}
          disabled={busy}
          className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t.takeover}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-none border-t border-slate-200 bg-white px-5 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {t.replying}
        </span>
        <button
          onClick={() => toggle(false)}
          disabled={busy}
          className="text-[12px] font-semibold text-brand-blue hover:underline disabled:opacity-50"
        >
          {t.giveBack}
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={t.placeholder}
          className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] text-brand-ink outline-none focus:border-brand-blue"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-xl bg-brand-blue px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
