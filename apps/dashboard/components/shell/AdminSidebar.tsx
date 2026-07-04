"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useLocale } from "@/lib/i18n";

type Item = { href: string; al: string; en: string; icon: string };

// Admin console nav. Global (not tenant-scoped) — the platform operator's tools.
const NAV: Item[] = [
  { href: "/admin/businesses", al: "Bizneset", en: "Businesses", icon: "M3 21h18M3 7v14M21 7v14M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16M9 9h.01M9 13h.01M15 9h.01M15 13h.01" },
  { href: "/admin/presets", al: "Personalitete", en: "Presets", icon: "M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" },
  { href: "/admin/plans", al: "Planet", en: "Plans", icon: "M3 5h18v4H3V5zm0 6h18v8H3v-8zm4 3h6" },
];

export function AdminSidebar({ userLabel }: { userLabel: string }) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const al = locale === "al";

  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] flex-shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
      <Link href="/admin/businesses" className="flex items-center gap-2 px-2 pb-6">
        <span className="font-display text-[19px] font-extrabold tracking-tight text-brand-deep">
          Lidh<span className="text-brand-sky">.al</span>
        </span>
        <span className="rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
          admin
        </span>
      </Link>

      <div className="px-2.5 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {al ? "Konsola" : "Console"}
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition ${
                active
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-slate-500 hover:bg-slate-50 hover:text-brand-deep"
              }`}
            >
              {active ? (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded bg-brand-blue" />
              ) : null}
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              <span className="flex-1">{al ? n.al : n.en}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-slate-100 px-2 pt-4">
        <UserButton />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold text-brand-deep">
            {userLabel}
          </div>
          <div className="text-[11px] text-slate-400">
            {al ? "Administrator platforme" : "Platform admin"}
          </div>
        </div>
      </div>
    </aside>
  );
}
