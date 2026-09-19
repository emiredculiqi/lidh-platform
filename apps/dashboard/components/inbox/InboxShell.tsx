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
import { formatDateTime } from "@/lib/datetime";
import { contactDisplayName, contactInitials } from "@/lib/contact-name";

// Filter by where the customer wrote from, plus the one that matters most:
// who is waiting on us. (The old AI/Human split went with ADR-018 — the inbox
// is organised around channels and work, not around who answered.)
type Tab = "all" | "web" | "whatsapp" | "unanswered" | "favorites";

/**
 * Inbox list + filters. Filter state lives in the URL (?tab=&q=&stage=) so a
 * view survives reloads, the back button works, and thread links keep the
 * filters. The server does the filtering: the layout hands us the unfiltered
 * first page; as soon as any filter is set we fetch the filtered list here,
 * and re-fetch on every live event (the layout's router.refresh can't see
 * the query string).
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

  const tab = (sp.get("tab") as Tab | null) ?? "all";
  const q = sp.get("q") ?? "";
  const stage = (sp.get("stage") as ContactStage | null) ?? null;
  const filtered = tab !== "all" || Boolean(q) || stage !== null;
  const qs = sp.toString();
  const withQuery = (href: string) => (qs ? `${href}?${qs}` : href);

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const [list, setList] = useState<ConversationList>(initial);
  const [loading, setLoading] = useState(false);
  const me = list.viewerUserId;

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
    if (tab === "web" || tab === "whatsapp") params.channel = tab;
    if (tab === "unanswered") params.only = "unanswered";
    if (tab === "favorites") params.only = "favorites";
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
  }, [slug, filtered, q, tab, stage, tick]);

  const t = useT({
    al: {
      all: "Të gjitha",
      unanswered: "Pa përgjigje",
      favorites: "Të preferuarat",
      search: "Kërko emër, telefon, email ose mesazh…",
      allStages: "Çdo status",
      stages: { new: "I ri", lead: "Potencial", client: "Ekzistues", not_a_fit: "Jo i përshtatshëm" } as Record<ContactStage, string>,
      empty: "Asnjë bisedë.",
      noMatch: "Asnjë bisedë nuk përputhet me filtrat.",
      clear: "Pastro filtrat",
      anonymous: "Vizitor anonim",
      you: "Ti",
      colleague: "Koleg",
    },
    en: {
      all: "All",
      unanswered: "Unanswered",
      favorites: "Favorites",
      search: "Search name, phone, email or message…",
      allStages: "Any stage",
      stages: { new: "New", lead: "Lead", client: "Client", not_a_fit: "Not a fit" } as Record<ContactStage, string>,
      empty: "No conversations.",
      noMatch: "No conversations match these filters.",
      clear: "Clear filters",
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

  // Debounce the search box so we don't re-query on every keystroke.
  useEffect(() => {
    if (text === q) return;
    const id = setTimeout(() => apply({ q: text.trim() || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t.all },
    { key: "web", label: "Web" },
    { key: "whatsapp", label: "WhatsApp" },
    {
      key: "unanswered",
      label: t.unanswered + (list.awaitingCount ? ` · ${list.awaitingCount}` : ""),
    },
    { key: "favorites", label: "★ " + t.favorites },
  ];

  // A star flips locally and the list re-orders at once (starred first,
  // newest first within each group) — the server's order, mirrored.
  function onStar(id: string, starred: boolean) {
    setList((cur) => {
      const items = cur.items
        .map((c) => (c.id === id ? { ...c, starred } : c))
        .filter((c) => tab !== "favorites" || c.starred)
        .sort((a, b) => {
          if (a.starred !== b.starred) return a.starred ? -1 : 1;
          return Date.parse(b.lastMsgAt) - Date.parse(a.lastMsgAt);
        });
      return { ...cur, items };
    });
  }

  const shown: ConversationListItem[] = list.items;

  return (
    <div className="flex h-[calc(100vh-118px)] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Left: conversation list */}
      <div
        className={`${
          detailOpen ? "hidden lg:flex" : "flex"
        } w-full flex-col border-slate-200 lg:w-[340px] lg:border-r`}
      >
        <div className="flex-none space-y-2 border-b border-slate-200 px-3 py-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-blue focus:bg-white"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {tabs.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => apply({ tab: x.key === "all" ? null : x.key })}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                  tab === x.key
                    ? "bg-brand-blue text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {x.label}
              </button>
            ))}
            <select
              value={stage ?? ""}
              onChange={(e) => apply({ stage: e.target.value || null })}
              aria-label={t.allStages}
              className={`ml-auto max-w-[140px] rounded-full border px-2 py-1 text-[12px] font-semibold outline-none ${
                stage
                  ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <option value="">{t.allStages}</option>
              {CONTACT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t.stages[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
        >
          {shown.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              <p>{filtered ? t.noMatch : t.empty}</p>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    router.replace(pathname, { scroll: false });
                  }}
                  className="mt-2 text-[12.5px] font-semibold text-brand-blue hover:underline"
                >
                  {t.clear}
                </button>
              ) : null}
            </div>
          ) : (
            shown.map((c) => {
              const active = pathname === `${base}/${c.id}`;
              // The conversation you're viewing is, by definition, read — don't
              // badge or bold it (MarkRead keeps the server's read state synced).
              const unread = c.unreadCount > 0 && !active;
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
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
                    {contactInitials({
                      name: c.contactName,
                      phone: c.contactPhone,
                      email: c.contactEmail,
                    })}
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
                      <span
                        className={`flex-none text-[11px] ${
                          unread ? "font-semibold text-brand-blue" : "text-slate-400"
                        }`}
                      >
                        {formatDateTime(c.lastMsgAt)}
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
                      <span className="flex items-center gap-1">
                        {unread ? (
                          <span className="flex-none rounded-full bg-brand-blue px-2 py-0.5 text-[11px] font-bold leading-none text-white">
                            {c.unreadCount}
                          </span>
                        ) : null}
                        <StarButton
                          conversationId={c.id}
                          starred={c.starred}
                          size={15}
                          onChange={(v) => onStar(c.id, v)}
                          className={c.starred ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
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
