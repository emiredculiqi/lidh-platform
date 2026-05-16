import Link from "next/link";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/agent", label: "Agent" },
  { href: "/inbox", label: "Inbox" },
  { href: "/leads", label: "Leads" },
  { href: "/test", label: "Test agent" },
];

export function TenantNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  return (
    <nav className="flex gap-1 border-b border-brand-ink/10">
      {TABS.map((t) => {
        const isActive = active === (t.href || "overview");
        return (
          <Link
            key={t.label}
            href={`/tenants/${slug}${t.href}`}
            className={`px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-b-2 border-brand-blue text-brand-deep"
                : "text-brand-ink/55 hover:text-brand-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
