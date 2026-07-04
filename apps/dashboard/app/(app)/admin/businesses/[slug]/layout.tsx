import Link from "next/link";
import { api } from "@/lib/api-server";
import { T } from "@/components/T";
import { ConsoleTabs } from "@/components/admin/ConsoleTabs";

export const dynamic = "force-dynamic";

// Per-business config console. The parent /admin layout already gates to
// platform admins; this adds the "Editing: <Business>" context + tab nav.
export default async function BusinessConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await api.getTenant(slug).catch(() => null);
  const name = tenant?.name ?? slug;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/admin/businesses"
          className="text-[12.5px] font-medium text-slate-400 transition hover:text-brand-blue"
        >
          ← <T al="Bizneset" en="Businesses" />
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded bg-accent-orange/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-orange">
            <T al="Po konfiguron" en="Editing" />
          </span>
          <h1 className="text-[22px] font-bold tracking-tight text-brand-deep">
            {name}
          </h1>
          <code className="text-[12px] text-slate-400">{slug}</code>
        </div>
      </div>

      <ConsoleTabs slug={slug} />

      <div>{children}</div>
    </div>
  );
}
