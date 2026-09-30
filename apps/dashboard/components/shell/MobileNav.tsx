"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { useLive } from "./LiveProvider";
import { NAV, TEAM_ITEM } from "./nav";

/**
 * Bottom tab bar for phones (below md), where the sidebar is hidden. Same
 * items, same active rule and the same unread badge as the sidebar; sits
 * above the home indicator on iPhones via the safe-area inset. The workspace
 * pads its content by the bar's height so nothing hides under it.
 */
export function MobileNav({
  slug,
  canManageTeam,
}: {
  slug: string;
  canManageTeam: boolean;
}) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const { unreadTotal } = useLive();
  const base = `/tenants/${slug}`;
  const al = locale === "al";
  const nav = canManageTeam ? [...NAV, TEAM_ITEM] : NAV;

  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <div className="flex h-14 items-stretch">
        {nav.map((n) => {
          const href = base + n.suffix;
          const active =
            n.suffix === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={n.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                active ? "text-brand-blue" : "text-slate-500"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={n.icon} />
              </svg>
              <span className="max-w-full truncate px-1">{al ? n.al : n.en}</span>
              {n.id === "inbox" && unreadTotal > 0 ? (
                <span className="absolute left-1/2 top-1 ml-1 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold leading-4 text-white">
                  {unreadTotal}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
