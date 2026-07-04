"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n";

const TABS = [
  { suffix: "", al: "Përmbledhje", en: "Overview" },
  { suffix: "/assistant", al: "Asistenti", en: "Assistant" },
  { suffix: "/knowledge", al: "Njohuritë", en: "Knowledge" },
  { suffix: "/channels", al: "Kanalet", en: "Channels" },
  { suffix: "/test", al: "Testo", en: "Test" },
];

export function ConsoleTabs({ slug }: { slug: string }) {
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const al = locale === "al";
  const base = `/admin/businesses/${slug}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const href = base + t.suffix;
        const active =
          t.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.suffix}
            href={href}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] font-semibold transition ${
              active
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-brand-deep"
            }`}
          >
            {al ? t.al : t.en}
          </Link>
        );
      })}
    </nav>
  );
}
