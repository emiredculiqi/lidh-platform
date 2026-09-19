"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/datetime";
import type { ContactNote } from "@/lib/api-core";

/**
 * Notes timeline on a contact (ADR-023): the assistant's intent notes ("wants
 * a group booking for 12 on Saturday") and manual notes by the team, newest
 * first, with a box to add one.
 */
export function ContactNotes({
  contactId,
  notes,
}: {
  contactId: string;
  notes: ContactNote[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT({
    al: {
      title: "Shënime",
      empty: "Ende asnjë shënim.",
      intent: "Asistenti",
      placeholder: "Shto një shënim — p.sh. \"Telefonuar, preferon paradite\"",
      add: "Shto",
    },
    en: {
      title: "Notes",
      empty: "No notes yet.",
      intent: "Assistant",
      placeholder: 'Add a note — e.g. "Called back, prefers mornings"',
      add: "Add",
    },
  });

  async function add() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await api.addContactNote(contactId, v);
      setText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-[15px] font-bold text-brand-deep">
          {t.title} ({notes.length})
        </h3>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex items-end gap-2 border-b border-slate-100 px-5 py-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={t.placeholder}
          className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] text-brand-ink outline-none focus:border-brand-blue"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-xl bg-brand-blue px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t.add}
        </button>
      </form>
      {notes.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">{t.empty}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {notes.map((n) => (
            <div key={n.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    n.kind === "intent" ? "text-brand-blue" : "text-slate-500"
                  }`}
                >
                  {n.kind === "intent" ? t.intent : n.authorName ?? "—"}
                </span>
                <span className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[13px] text-slate-700">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
