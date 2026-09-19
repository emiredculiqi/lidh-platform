import Link from "next/link";
import { api } from "@/lib/api-server";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { formatDateTime } from "@/lib/datetime";
import { StagePill } from "@/components/contacts/Stage";
import { ContactsFilters } from "@/components/contacts/ContactsFilters";
import type { ContactListParams, ContactStage } from "@/lib/api-core";

export const dynamic = "force-dynamic";

const STAGES = new Set(["new", "lead", "client", "not_a_fit"]);

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) || undefined;

  // Filters live in the URL (see ContactsFilters); validate loosely here —
  // the API validates strictly and rejects anything else.
  const query: ContactListParams = {
    q: one("q"),
    stage: STAGES.has(one("stage") ?? "") ? (one("stage") as ContactStage) : undefined,
    has: one("has") === "phone" || one("has") === "email" ? (one("has") as "phone" | "email") : undefined,
    sort: one("sort") === "recent" ? "recent" : undefined,
  };
  const filtering = Boolean(query.q || query.stage || query.has);
  const contacts = await api.listContacts(slug, query);

  return (
    <div className="space-y-4">
      <ContactsFilters />
      {contacts.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-slate-400">
            {filtering ? (
              <T al="Asnjë kontakt nuk përputhet me filtrat." en="No contacts match these filters." />
            ) : (
              <T
                al="Ende asnjë kontakt. Kontaktet shfaqen këtu sapo klientët fillojnë të bisedojnë."
                en="No contacts yet. They appear here as soon as customers start chatting."
              />
            )}
          </p>
        </Card>
      ) : (
    <Card padded={false}>
      <div className="divide-y divide-slate-100">
        {contacts.map((c) => {
          const name = c.name || c.phone || c.email;
          return (
            <Link
              key={c.id}
              href={`/tenants/${slug}/contacts/${c.id}`}
              className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-blue/10 text-[12.5px] font-bold text-brand-blue">
                {(name ?? "·").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold text-brand-deep">
                    {name || <T al="Vizitor anonim" en="Anonymous visitor" />}
                  </span>
                  <StagePill stage={c.stage} />
                  {c.source ? <ChannelBadge kind={c.source} /> : null}
                </div>
                <div className="truncate text-[12.5px] text-slate-400">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="hidden flex-none text-right sm:block">
                <div className="text-[12.5px] font-medium text-slate-600">
                  {c.conversationCount}{" "}
                  <T al="biseda" en="convos" /> · {c.leadCount}{" "}
                  <T al="lead" en="leads" />
                </div>
                <div className="text-[11px] text-slate-400">
                  {formatDateTime(c.lastSeenAt)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
      )}
    </div>
  );
}
