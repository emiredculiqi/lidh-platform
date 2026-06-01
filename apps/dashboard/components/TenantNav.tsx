"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

const TABS = [
  { href: "", key: "overview" as const },
  { href: "/agent", key: "agent" as const },
  { href: "/inbox", key: "inbox" as const },
  { href: "/leads", key: "leads" as const },
  { href: "/test", key: "test" as const },
];

export function TenantNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  const labels = useT({
    al: {
      overview: "Përmbledhje",
      agent: "Agjenti",
      inbox: "Mesazhet",
      leads: "Klientë potencialë",
      test: "Testo agjentin",
    },
    en: {
      overview: "Overview",
      agent: "Agent",
      inbox: "Inbox",
      leads: "Leads",
      test: "Test agent",
    },
  });

  return (
    <nav className="flex gap-1 border-b border-brand-ink/10">
      {TABS.map((t) => {
        const isActive = active === (t.href ? t.key : "overview");
        return (
          <Link
            key={t.key}
            href={`/tenants/${slug}${t.href}`}
            className={`px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-b-2 border-brand-blue text-brand-deep"
                : "text-brand-ink/55 hover:text-brand-ink"
            }`}
          >
            {labels[t.key]}
          </Link>
        );
      })}
    </nav>
  );
}
