"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ContactTask } from "@/lib/api-core";

/**
 * The customer's checklist (ADR-024 §4): what we agreed to do, ticked off as
 * it happens. Lives on the contact, so the thread's right panel and the
 * contact page show the same list. Optimistic; the server order (open first,
 * newest first) is mirrored locally.
 *
 * `compact` is the right-panel variant: tighter, no card chrome.
 */
export function ContactTasks({
  contactId,
  conversationId,
  tasks,
  compact = false,
}: {
  contactId: string;
  conversationId?: string;
  tasks: ContactTask[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ContactTask[]>(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const t = useT({
    al: {
      title: "Për t'u bërë",
      empty: "Asnjë detyrë. Shto çfarë keni rënë dakord me klientin.",
      placeholder: "p.sh. Dërgo ofertën për 12 persona",
      add: "Shto",
      showDone: (n: number) => `Shfaq ${n} të kryera`,
      hideDone: "Fshih të kryerat",
      remove: "Fshi",
    },
    en: {
      title: "To-do",
      empty: "No tasks. Add what you agreed with the customer.",
      placeholder: "e.g. Send the offer for 12 people",
      add: "Add",
      showDone: (n: number) => `Show ${n} done`,
      hideDone: "Hide done",
      remove: "Delete",
    },
  });

  const sort = (xs: ContactTask[]) =>
    [...xs].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });

  async function add() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const created = await api.addContactTask(contactId, { text: v, conversationId });
      setItems((cur) => sort([created, ...cur]));
      setText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: ContactTask) {
    const next = !task.done;
    setItems((cur) =>
      sort(cur.map((x) => (x.id === task.id ? { ...x, done: next } : x))),
    );
    try {
      const saved = await api.updateContactTask(contactId, task.id, { done: next });
      setItems((cur) => sort(cur.map((x) => (x.id === task.id ? saved : x))));
      router.refresh();
    } catch {
      setItems((cur) => sort(cur.map((x) => (x.id === task.id ? task : x))));
    }
  }

  async function remove(task: ContactTask) {
    setItems((cur) => cur.filter((x) => x.id !== task.id));
    try {
      await api.deleteContactTask(contactId, task.id);
      router.refresh();
    } catch {
      setItems((cur) => sort([...cur, task]));
    }
  }

  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  const shown = showDone ? items : open;

  const row = (task: ContactTask) => (
    <li key={task.id} className="group flex items-start gap-2.5 py-2">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => toggle(task)}
        aria-label={task.text}
        className="mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-slate-300 accent-brand-blue"
      />
      <span
        className={`min-w-0 flex-1 whitespace-pre-line text-[13px] ${
          task.done ? "text-slate-400 line-through" : "text-slate-700"
        }`}
      >
        {task.text}
      </span>
      <button
        type="button"
        onClick={() => remove(task)}
        aria-label={t.remove}
        title={t.remove}
        className="flex-none rounded p-0.5 text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100 focus:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </li>
  );

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="flex items-center gap-2"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="flex-none rounded-lg bg-brand-blue px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {t.add}
      </button>
    </form>
  );

  const doneToggle =
    done.length > 0 ? (
      <button
        type="button"
        onClick={() => setShowDone((v) => !v)}
        className="text-[12px] font-medium text-slate-500 hover:underline"
      >
        {showDone ? t.hideDone : t.showDone(done.length)}
      </button>
    ) : null;

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t.title}
            {open.length ? ` · ${open.length}` : ""}
          </div>
          {doneToggle}
        </div>
        <div className="mt-2">{form}</div>
        {shown.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-slate-400">{t.empty}</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">{shown.map(row)}</ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h3 className="text-[15px] font-bold text-brand-deep">
          {t.title} ({open.length})
        </h3>
        {doneToggle}
      </div>
      <div className="border-b border-slate-100 px-5 py-3">{form}</div>
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-5">{shown.map(row)}</ul>
      )}
    </div>
  );
}
