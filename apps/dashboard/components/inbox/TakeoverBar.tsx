"use client";

import { useEffect, useRef, useState } from "react";
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
  canSuggest,
}: {
  conversationId: string;
  aiOverride: Responder | null;
  aiEffective: Responder;
  aiDefault: Responder;
  /** The customer spoke last — there is something to draft an answer to. */
  canSuggest: boolean;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<Responder | null>(aiOverride);
  const [effective, setEffective] = useState<Responder>(aiEffective);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const reportTyping = useTypingReporter();
  // ADR-024 §5: the assistant drafts, a person sends. We remember the draft
  // so the sent reply can say whether it was used as-is or edited.
  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  // The box grows with its content (a three-line draft must not land in a
  // one-line box) and shrinks back after sending.
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

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
      suggest: "Sugjero një përgjigje",
      suggesting: "Po shkruan një draft…",
      nothingToAnswer: "Klienti nuk ka shkruar asgjë të re",
      draftReady: "Draft nga asistenti — rishikoje para se ta dërgosh",
      draftFailed: "Nuk u krijua dot një draft. Provo përsëri.",
      replaceTyped: "Të zëvendësohet teksti që ke shkruar me një draft nga asistenti?",
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
      suggest: "Suggest a reply",
      suggesting: "Drafting…",
      nothingToAnswer: "The customer hasn't said anything new",
      draftReady: "Draft by the assistant — review before sending",
      draftFailed: "Couldn't draft a reply. Try again.",
      replaceTyped: "Replace what you typed with a draft from the assistant?",
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
      const suggestion = draft === null ? undefined : v === draft.trim() ? "used" : "edited";
      await api.replyToConversation(conversationId, v, suggestion);
      setText("");
      setDraft(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    if (drafting || busy || !canSuggest) return;
    // Never silently discard what the person typed.
    const typed = text.trim();
    if (typed && typed !== (draft ?? "").trim() && !window.confirm(t.replaceTyped)) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const r = await api.suggestReply(conversationId);
      setText(r.text);
      setDraft(r.text);
    } catch {
      setDraftError(t.draftFailed);
    } finally {
      setDrafting(false);
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
      {draft !== null && !draftError ? (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-violet-700">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          {t.draftReady}
        </p>
      ) : null}
      {draftError ? (
        <p className="mb-1.5 text-[11.5px] font-medium text-rose-600">{draftError}</p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <button
          type="button"
          onClick={suggest}
          disabled={drafting || busy || !canSuggest}
          title={canSuggest ? t.suggest : t.nothingToAnswer}
          aria-label={t.suggest}
          className={`flex h-[38px] flex-none items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            drafting
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={drafting ? "animate-pulse" : ""}>
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
          </svg>
          <span className="hidden sm:inline">{drafting ? t.suggesting : t.suggest}</span>
        </button>
        <textarea
          ref={taRef}
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
          className="max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] text-brand-ink outline-none focus:border-brand-blue"
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
