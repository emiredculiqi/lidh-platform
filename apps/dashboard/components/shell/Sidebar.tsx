"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useLocale } from "@/lib/i18n";
import { useLive } from "./LiveProvider";

type Item = { id: string; suffix: string; al: string; en: string; icon: string };

// New IA (matches the redesign). Leads kept as a tab since it's core today;
// it folds into Bisedat later. Usage folds into the dashboard.
const NAV: Item[] = [
  { id: "dashboard", suffix: "", al: "Paneli", en: "Dashboard", icon: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" },
  { id: "inbox", suffix: "/inbox", al: "Bisedat", en: "Conversations", icon: "M4 4h16v12H7l-3 3V4z" },
  { id: "contacts", suffix: "/contacts", al: "Kontakte", en: "Contacts", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { id: "calendar", suffix: "/calendar", al: "Kalendari", en: "Calendar", icon: "M3 5h18v16H3V5zm0 5h18M8 3v4m8-4v4" },
  { id: "leads", suffix: "/leads", al: "Klientë", en: "Leads", icon: "M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0" },
  { id: "developer", suffix: "/developer", al: "Integrime", en: "Integrations", icon: "M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1m-2 6a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" },
  { id: "agent", suffix: "/agent", al: "Asistenti AI", en: "AI Assistant", icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h3m14 0h3M12 2v3m0 14v3" },
];

export function Sidebar({
  slug,
  tenantName,
  userLabel,
  trialDays,
}: {
  slug: string;
  tenantName: string;
  userLabel: string;
  trialDays: number | null;
}) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const { newConvCount } = useLive();
  const base = `/tenants/${slug}`;
  const al = locale === "al";

  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] flex-shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
      <Link href={base} className="flex items-center gap-2.5 px-2 pb-6">
        <span className="font-display text-[19px] font-extrabold tracking-tight text-brand-deep">
          Lidh<span className="text-brand-sky">.al</span>
        </span>
      </Link>

      <div className="px-2.5 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {al ? "Menu" : "Menu"}
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const href = base + n.suffix;
          const active =
            n.suffix === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={n.id}
              href={href}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition ${
                active
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-slate-500 hover:bg-slate-50 hover:text-brand-deep"
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded bg-brand-blue" />
              ) : null}
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={n.icon} />
              </svg>
              <span className="flex-1">{al ? n.al : n.en}</span>
              {n.id === "inbox" && newConvCount > 0 ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {newConvCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {trialDays != null && trialDays > 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold text-brand-deep">
              {al ? "Prova falas" : "Free trial"}
            </div>
            <div className="mb-2.5 mt-1 text-[11.5px] text-slate-500">
              {al ? `Mbarojnë ${trialDays} ditë` : `${trialDays} days left`}
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-slate-200">
              <div
                className="h-full rounded bg-gradient-to-r from-brand-sky to-brand-blue"
                style={{ width: `${Math.min(100, (trialDays / 15) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <UserButton />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-bold text-brand-deep">
              {userLabel}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {tenantName}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
