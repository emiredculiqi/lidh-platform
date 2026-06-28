"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "./LiveProvider";
import { useLocale } from "@/lib/i18n";
import type { Notification } from "@/lib/api-core";

function label(n: Notification, al: boolean): string {
  const who = n.contactName ? `: ${n.contactName}` : "";
  switch (n.kind) {
    case "conversation_started":
      return al ? "Bisedë e re" : "New conversation";
    case "contact_registered":
      return (al ? "Kontakt i ri" : "New contact") + who;
    case "lead_captured":
      return (al ? "Lead i ri" : "New lead") + who;
    default:
      return al ? "Aktivitet" : "Activity";
  }
}

// Short relative time. Client-only (the dropdown isn't rendered during SSR),
// so Date.now() here is safe from hydration mismatches.
function relTime(iso: string, al: boolean): string {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return al ? "tani" : "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const dotColor: Record<string, string> = {
  lead_captured: "bg-brand-mint",
  contact_registered: "bg-brand-sky",
  conversation_started: "bg-brand-blue",
};

export function NotificationBell({ slug }: { slug: string }) {
  const { notifications, unseenCount, markNotificationsSeen } = useLive();
  const { locale } = useLocale();
  const al = locale === "al";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (!o) markNotificationsSeen();
      return !o;
    });
  }

  function openItem(n: Notification) {
    setOpen(false);
    if (n.conversationId) {
      router.push(`/tenants/${slug}/inbox/${n.conversationId}`);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-[10px] border border-slate-200 p-2 text-slate-500 transition hover:text-brand-deep"
        aria-label="Notifications"
        type="button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unseenCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-30 w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2.5 text-[12.5px] font-bold text-brand-deep">
            {al ? "Njoftime" : "Notifications"}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">
              {al ? "Asnjë aktivitet ende." : "No activity yet."}
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={`h-2 w-2 flex-none rounded-full ${
                      dotColor[n.kind] ?? "bg-slate-300"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-brand-ink">
                    {label(n, al)}
                  </span>
                  <span className="flex-none text-[11px] text-slate-400">
                    {relTime(n.createdAt, al)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
