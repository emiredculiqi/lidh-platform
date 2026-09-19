"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * Settings sub-navigation. URL-based tabs (/settings/<tab>) so each tab is
 * its own server page and deep links work; this component only highlights
 * the active one.
 */
export function SettingsTabs({ slug }: { slug: string }) {
  const pathname = usePathname() || "";
  const base = `/tenants/${slug}/settings`;
  const t = useT({
    al: { responder: "Kush përgjigjet", channels: "Kanalet", widget: "Widget & faqja" },
    en: { responder: "Who answers", channels: "Channels", widget: "Widget & page" },
  });
  const tabs = [
    { key: "responder", label: t.responder },
    { key: "channels", label: t.channels },
    { key: "widget", label: t.widget },
  ] as const;

  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Settings">
      {tabs.map((tab) => {
        const href = `${base}/${tab.key}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.key}
            href={href}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition ${
              active
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-brand-deep"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
