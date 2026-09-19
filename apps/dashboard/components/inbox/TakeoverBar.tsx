"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Responder } from "@/lib/api-core";
import { useTypingReporter } from "@/components/inbox/ThreadPresence";

/**
 * Footer of a conversation: who answers this thread, and the reply box.
 *
 * Three states, driven by the resolved responder (ADR-020):
 *   - a human answers → reply box + "let the assistant answer" link
 *   - the assistant answers → "take over" button
 *   - either, with a manual override set → an extra "back to business default"
 *     link, so an operator can hand a thread back to the schedule.
 * Human is the default for new businesses; the assistant is opt-in.
 */
export function TakeoverBar({
  conversationId,
  aiOverride,
  aiEffective,
  aiDefault,
}: {
  conversationId: string;
  aiOverride: Responder | null;
  aiEffective: Responder;
  aiDefault: Responder;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<Responder | null>(aiOverride);
  const [effective, setEffective] = useState<Responder>(aiEffective);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const reportTyping = useTypingReporter();

  const t = useT({
    al: {
      takeover: "Merr përsipër bisedën",
      youAnswer: "Përgjigjesh ti",
      youAnswerOverride: "Përgjigjesh ti — asistenti është ndalur për këtë bisedë",
      aiAnswers: "Asistenti po përgjigjet",
      letAi: "Lëre asistentin të përgjigjet",
      backToDefault: aiDefault === "ai" ? "Kthe te parazgjedhja (asistenti)" : "Kthe te parazgjedhja (ekipi)",
      placeholder: "Shkruaj përgjigjen…",
      send: "Dërgo",
    },
    en: {
      takeover: "Take over the conversation",
      youAnswer: "You're answering",
      youAnswerOverride: "You're answering — the assistant is off for this thread",
      aiAnswers: "The assistant is answering",
      letAi: "Let the assistant answer",
      backToDefault: aiDefault === "ai" ? "Back to business default (assistant)" : "Back to business default (team)",
      placeholder: "Type your reply…",
      send: "Send",
    },
  });

  async function choose(mode: Responder | "inherit") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.setConversationResponder(conversationId, mode);
      setOverride(r.aiOverride);
      setEffective(r.aiEffective);
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

  const backToDefault =
    override !== null ? (
      <button
        onClick={() => choose("inherit")}
        disabled={busy}
        className="text-[12px] font-medium text-slate-500 hover:underline disabled:opacity-50"
      >
        {t.backToDefault}
      </button>
    ) : null;

  if (effective === "ai") {
    return (
      <div className="flex-none border-t border-slate-200 bg-white px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t.aiAnswers}
          </span>
          {backToDefault}
        </div>
        <button
          onClick={() => choose("human")}
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
          {override === "human" ? t.youAnswerOverride : t.youAnswer}
        </span>
        <span className="flex items-center gap-3">
          {backToDefault}
          <button
            onClick={() => choose("ai")}
            disabled={busy}
            className="text-[12px] font-semibold text-brand-blue hover:underline disabled:opacity-50"
          >
            {t.letAi}
          </button>
        </span>
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
          onChange={(e) => {
            setText(e.target.value);
            reportTyping();
          }}
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
