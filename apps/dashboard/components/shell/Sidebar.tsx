"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useLocale } from "@/lib/i18n";
import { useLive } from "./LiveProvider";

import { NAV, TEAM_ITEM } from "./nav";

export function Sidebar({
  slug,
  tenantName,
  userLabel,
  trialDays,
  canManageTeam,
}: {
  slug: string;
  tenantName: string;
  userLabel: string;
  trialDays: number | null;
  canManageTeam: boolean;
}) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const { unreadTotal } = useLive();
  const base = `/tenants/${slug}`;
  const al = locale === "al";
  const nav = canManageTeam ? [...NAV, TEAM_ITEM] : NAV;

  return (
    <aside className="hidden h-full w-[244px] flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 md:flex">
      <Link href={base} className="flex items-center gap-2.5 px-2 pb-6">
        <span className="font-display text-[19px] font-extrabold tracking-tight text-brand-deep">
          Lidh<span className="text-brand-sky">.al</span>
        </span>
      </Link>

      <div className="px-2.5 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {al ? "Menu" : "Menu"}
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => {
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
              {n.id === "inbox" && unreadTotal > 0 ? (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {unreadTotal}
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
                style={{ width: `${Math.min(100, (trialDays / 30) * 100)}%` }}
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
