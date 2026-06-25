"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ConversationListItem } from "@/lib/api-core";
import { useLocale } from "@/lib/i18n";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { formatDateTime } from "@/lib/datetime";

type Filter = "all" | "ai" | "human";

export function InboxShell({
  slug,
  conversations,
  children,
}: {
  slug: string;
  conversations: ConversationListItem[];
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const al = locale === "al";
  const base = `/tenants/${slug}/inbox`;
  const detailOpen = pathname !== base; // a conversation is selected
  const [filter, setFilter] = useState<Filter>("all");

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: al ? "Të gjitha" : "All" },
    { key: "ai", label: "AI" },
    { key: "human", label: al ? "Njeri" : "Human" },
  ];

  const shown = conversations.filter((c) =>
    filter === "all" ? true : filter === "human" ? c.aiPaused : !c.aiPaused,
  );

  return (
    <div className="flex h-[calc(100vh-118px)] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Left: conversation list */}
      <div
        className={`${
          detailOpen ? "hidden lg:flex" : "flex"
        } w-full flex-col border-slate-200 lg:w-[340px] lg:border-r`}
      >
        <div className="flex flex-none items-center gap-1.5 border-b border-slate-200 px-3 py-2.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${
                filter === t.key
                  ? "bg-brand-blue text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-400">
              {al ? "Asnjë bisedë." : "No conversations."}
            </p>
          ) : (
            shown.map((c) => {
              const active = pathname === `${base}/${c.id}`;
              return (
                <Link
                  key={c.id}
                  href={`${base}/${c.id}`}
                  className={`relative flex gap-3 border-b border-slate-100 px-4 py-3 transition ${
                    active ? "bg-brand-blue/5" : "hover:bg-slate-50"
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded bg-brand-blue" />
                  ) : null}
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
                    {(c.contactName ?? c.contactPhone ?? "·")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-brand-deep">
                        {c.contactName ||
                          c.contactPhone ||
                          (al ? "Vizitor anonim" : "Anonymous")}
                      </span>
                      <span className="flex-none text-[11px] text-slate-400">
                        {formatDateTime(c.lastMsgAt)}
                      </span>
                    </div>
                    <p className="truncate text-[12.5px] text-slate-400">
                      {c.lastMessagePreview || "—"}
                    </p>
                    <div className="mt-1">
                      <ChannelBadge kind={c.channelKind} />
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
