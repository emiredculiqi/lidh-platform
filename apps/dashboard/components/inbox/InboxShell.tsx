"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CONTACT_STAGES,
  type ContactStage,
  type ConversationList,
  type ConversationListItem,
  type ConversationListParams,
  type Viewer,
} from "@/lib/api-core";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useLive } from "@/components/shell/LiveProvider";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StarButton } from "@/components/inbox/StarButton";
import { StagePill } from "@/components/contacts/Stage";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { contactDisplayName, contactInitials } from "@/lib/contact-name";

type Channel = "web" | "whatsapp";
const FAV_OPEN_KEY = "lidh.inbox.favOpen";

/**
 * Inbox list. Three layers, from most to least used:
 *
 *   1. Search box, always visible.
 *   2. Two tabs: everything, or only the customers waiting on us — the one
 *      question an inbox has to answer at a glance. Waiting rows are also
 *      marked in the list itself, with how long they have waited.
 *   3. "Filters" (channel, customer stage) behind one button, with a count
 *      badge when any is active — useful, but not every day.
 *
 * Starred threads (ADR-024 §2) are not a filter: they are a collapsible
 * section at the top of the list, so the focus set is always in view.
 *
 * Filter state lives in the URL (?only=&channel=&stage=&q=) so a view
 * survives reloads and thread links keep it. The server does the filtering:
 * the layout hands us the unfiltered first page; as soon as any filter is
 * set we fetch the filtered list here, and re-fetch on every live event.
 */
export function InboxShell({
  slug,
  initial,
  children,
}: {
  slug: string;
  initial: ConversationList;
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const sp = useSearchParams();
  const { tick, subscribe } = useLive();
  const base = `/tenants/${slug}/inbox`;
  const detailOpen = pathname !== base; // a conversation is selected

  const only = sp.get("only") === "unanswered" ? "unanswered" : null;
  const channel = (sp.get("channel") as Channel | null) ?? null;
  const q = sp.get("q") ?? "";
  const stage = (sp.get("stage") as ContactStage | null) ?? null;
  const filtered = only !== null || channel !== null || Boolean(q) || stage !== null;
  const advancedCount = (channel ? 1 : 0) + (stage ? 1 : 0);
  const qs = sp.toString();
  const withQuery = (href: string) => (qs ? `${href}?${qs}` : href);

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [list, setList] = useState<ConversationList>(initial);
  const [loading, setLoading] = useState(false);
  const me = list.viewerUserId;

  // "now" is set after mount so server and client render the same HTML; the
  // waiting durations then tick once a minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Favorites section open/closed — a per-browser convenience.
  const [favOpen, setFavOpen] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(FAV_OPEN_KEY);
      if (v === "0") setFavOpen(false);
    } catch {
      /* private mode etc. */
    }
  }, []);
  function toggleFav() {
    setFavOpen((v) => {
      try {
        localStorage.setItem(FAV_OPEN_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  }

  // Who is on which thread: seeded by the list, updated by presence events
  // (which don't refresh the route — see LiveProvider).
  const [presence, setPresence] = useState<Record<string, Viewer[]>>({});
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === "presence" && e.conversationId && e.viewers) {
          const id = e.conversationId;
          const viewers = e.viewers;
          setPresence((p) => ({ ...p, [id]: viewers }));
        }
      }),
    [subscribe],
  );
  // Unfiltered: the layout's server-rendered list is the truth (it refreshes
  // via router.refresh on live events). Filtered: we fetch.
  useEffect(() => {
    if (!filtered) setList(initial);
  }, [filtered, initial]);
  useEffect(() => {
    if (!filtered) return;
    let cancelled = false;
    const params: ConversationListParams = {};
    if (q) params.q = q;
    if (channel) params.channel = channel;
    if (only) params.only = only;
    if (stage) params.stage = stage;
    setLoading(true);
    api
      .listConversations(slug, params)
      .then((r) => {
        if (!cancelled) setList(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, filtered, q, channel, only, stage, tick]);

  const t = useT({
    al: {
      all: "Të gjitha",
      unanswered: "Pa përgjigje",
      waiting: "Pret",
      favorites: "Të preferuarat",
      others: "Bisedat",
      search: "Kërko emër, telefon, email ose mesazh…",
      filters: "Filtra",
      channel: "Kanali",
      anyChannel: "Çdo kanal",
      stageLabel: "Statusi i klientit",
      anyStage: "Çdo status",
      stages: { new: "I ri", lead: "Potencial", client: "Ekzistues", not_a_fit: "Jo i përshtatshëm" } as Record<ContactStage, string>,
      empty: "Asnjë bisedë.",
      noMatch: "Asnjë bisedë nuk përputhet me filtrat.",
      clear: "Pastro filtrat",
      done: "Gati",
      anonymous: "Vizitor anonim",
      you: "Ti",
      colleague: "Koleg",
    },
    en: {
      all: "All",
      unanswered: "Unanswered",
      waiting: "Waiting",
      favorites: "Favorites",
      others: "Conversations",
      search: "Search name, phone, email or message…",
      filters: "Filters",
      channel: "Channel",
      anyChannel: "Any channel",
      stageLabel: "Customer stage",
      anyStage: "Any stage",
      stages: { new: "New", lead: "Lead", client: "Client", not_a_fit: "Not a fit" } as Record<ContactStage, string>,
      empty: "No conversations.",
      noMatch: "No conversations match these filters.",
      clear: "Clear filters",
      done: "Done",
      anonymous: "Anonymous visitor",
      you: "You",
      colleague: "Colleague",
    },
  });

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }
  function clearAll() {
    setText("");
    setFiltersOpen(false);
    router.replace(pathname, { scroll: false });
  }

  // Debounce the search box so we don't re-query on every keystroke.
  useEffect(() => {
    if (text === q) return;
    const id = setTimeout(() => apply({ q: text.trim() || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // A star flips locally and the list re-orders at once (starred first,
  // newest first within each group) — the server's order, mirrored.
  function onStar(id: string, starred: boolean) {
    setList((cur) => ({
      ...cur,
      items: cur.items
        .map((c) => (c.id === id ? { ...c, starred } : c))
        .sort((a, b) => {
          if (a.starred !== b.starred) return a.starred ? -1 : 1;
          return Date.parse(b.lastMsgAt) - Date.parse(a.lastMsgAt);
        }),
    }));
  }

  const starred = list.items.filter((c) => c.starred);
  const rest = list.items.filter((c) => !c.starred);

  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset transition ${
      on
        ? "bg-brand-blue text-white ring-brand-blue"
        : "bg-white text-slate-500 ring-slate-200 hover:text-brand-deep hover:ring-slate-300"
    }`;

  const row = (c: ConversationListItem) => {
    const active = pathname === `${base}/${c.id}`;
    // The conversation you're viewing is, by definition, read — don't badge
    // or bold it (MarkRead keeps the server's read state synced).
    const unread = c.unreadCount > 0 && !active;
    const waiting = c.lastMessageRole === "user";
    const waitedFor =
      waiting && now !== null
        ? formatDuration((now - Date.parse(c.lastMsgAt)) / 1000)
        : null;
    const others = (presence[c.id] ?? c.viewers).filter((v) => v.userId !== me);
    const by = c.lastReplyBy
      ? c.lastReplyBy.userId === me
        ? t.you
        : c.lastReplyBy.name ?? t.colleague
      : null;
    return (
      <Link
        key={c.id}
        href={withQuery(`${base}/${c.id}`)}
        className={`group relative flex gap-3 border-b border-slate-100 px-4 py-3 transition ${
          active ? "bg-brand-blue/5" : "hover:bg-slate-50"
        }`}
      >
        {active ? (
          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded bg-brand-blue" />
        ) : null}
        <div className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
          {contactInitials({
            name: c.contactName,
            phone: c.contactPhone,
            email: c.contactEmail,
          })}
          {waiting ? (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-semibold text-brand-deep">
              {contactDisplayName({
                name: c.contactName,
                phone: c.contactPhone,
                email: c.contactEmail,
              }) ?? t.anonymous}
            </span>
            <span className="flex flex-none items-center gap-0.5">
              <span
                className={`text-[11px] ${
                  unread ? "font-semibold text-brand-blue" : "text-slate-400"
                }`}
              >
                {formatDateTime(c.lastMsgAt)}
              </span>
              <StarButton
                conversationId={c.id}
                starred={c.starred}
                size={15}
                onChange={(v) => onStar(c.id, v)}
                className={`-mr-1 ${c.starred ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
              />
            </span>
          </div>
          <p
            className={`truncate text-[12.5px] ${
              unread ? "font-semibold text-brand-ink" : "text-slate-400"
            }`}
          >
            {by ? <span className="font-semibold">{by}: </span> : null}
            {c.lastMessagePreview || "—"}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ChannelBadge kind={c.channelKind} />
              <StagePill stage={c.contactStage} />
              {waiting ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  {t.waiting}
                  {waitedFor ? ` · ${waitedFor}` : ""}
                </span>
              ) : null}
              {others.map((v) => (
                <span
                  key={v.userId}
                  title={v.name ?? t.colleague}
                  className={`inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold ring-1 ring-inset ${
                    v.typing
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-slate-50 text-slate-500 ring-slate-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      v.typing ? "animate-pulse bg-amber-500" : "bg-slate-400"
                    }`}
                  />
                  {(v.name ?? "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              ))}
            </span>
            {unread ? (
              <span className="flex-none rounded-full bg-brand-blue px-2 py-0.5 text-[11px] font-bold leading-none text-white">
                {c.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-[calc(100vh-118px)] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Left: conversation list */}
      <div
        className={`${
          detailOpen ? "hidden lg:flex" : "flex"
        } w-full flex-col border-slate-200 lg:w-[340px] lg:border-r`}
      >
        <div className="relative flex-none space-y-2 border-b border-slate-200 px-3 py-2.5">
          {/* 1. Search + the filters button */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                className="pointer-events-none absolute left-2.5 top-2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4-4" />
              </svg>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.search}
                aria-label={t.search}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[13px] text-brand-ink outline-none focus:border-brand-blue focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              title={t.filters}
              className={`relative inline-flex h-[34px] flex-none items-center gap-1 rounded-lg border px-2.5 text-[12px] font-semibold transition ${
                advancedCount || filtersOpen
                  ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-brand-deep"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              {t.filters}
              {advancedCount ? (
                <span className="ml-0.5 rounded-full bg-brand-blue px-1.5 text-[10px] font-bold leading-4 text-white">
                  {advancedCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* 2. The one work filter */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => apply({ only: null })}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                only === null ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.all}
            </button>
            <button
              type="button"
              onClick={() => apply({ only: only ? null : "unanswered" })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                only === "unanswered" ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${only === "unanswered" ? "bg-white" : "bg-amber-500"}`} />
              {t.unanswered}
              {list.awaitingCount ? ` · ${list.awaitingCount}` : ""}
            </button>
            {filtered ? (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto text-[11.5px] font-medium text-slate-500 hover:underline"
              >
                {t.clear}
              </button>
            ) : null}
          </div>

          {/* 3. Filters popover */}
          {filtersOpen ? (
            <>
              <button
                type="button"
                aria-label={t.done}
                onClick={() => setFiltersOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <div className="absolute left-3 right-3 top-[46px] z-30 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t.channel}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={chip(channel === null)} onClick={() => apply({ channel: null })}>
                      {t.anyChannel}
                    </button>
                    <button type="button" className={chip(channel === "web")} onClick={() => apply({ channel: channel === "web" ? null : "web" })}>
                      Web
                    </button>
                    <button type="button" className={chip(channel === "whatsapp")} onClick={() => apply({ channel: channel === "whatsapp" ? null : "whatsapp" })}>
                      WhatsApp
                    </button>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t.stageLabel}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={chip(stage === null)} onClick={() => apply({ stage: null })}>
                      {t.anyStage}
                    </button>
                    {CONTACT_STAGES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={chip(stage === s)}
                        onClick={() => apply({ stage: stage === s ? null : s })}
                      >
                        {t.stages[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => apply({ channel: null, stage: null })}
                    className="text-[12px] font-medium text-slate-500 hover:underline"
                  >
                    {t.clear}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-lg bg-brand-blue px-3 py-1 text-[12px] font-semibold text-white"
                  >
                    {t.done}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          {list.items.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              <p>{filtered ? t.noMatch : t.empty}</p>
              {filtered ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-2 text-[12.5px] font-semibold text-brand-blue hover:underline"
                >
                  {t.clear}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {starred.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={toggleFav}
                    aria-expanded={favOpen}
                    className="flex w-full items-center gap-1.5 border-b border-slate-100 bg-amber-50/60 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-50"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${favOpen ? "rotate-90" : ""}`}
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    ★ {t.favorites} · {starred.length}
                  </button>
                  {favOpen ? starred.map(row) : null}
                  {rest.length > 0 ? (
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {t.others} · {rest.length}
                    </div>
                  ) : null}
                </>
              ) : null}
              {rest.map(row)}
            </>
          )}
        </div>
      </div>

      {/* Right: selected thread + contact panel (the /[id] route) */}
      <div
        className={`${
          detailOpen ? "flex" : "hidden lg:flex"
        } min-w-0 flex-1`}
      >
        {children}
      </div>
    </div>
  );
}
