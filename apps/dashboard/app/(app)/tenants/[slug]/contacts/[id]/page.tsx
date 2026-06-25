import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "@/lib/api-server";
import { T } from "@/components/T";
import { Card } from "@/components/ui/Card";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const LANG: Record<string, string> = {
  al: "Shqip",
  en: "English",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
};

function field(p: Record<string, unknown>, k: string): string {
  const v = p?.[k];
  return typeof v === "string" && v.trim() ? v : "";
}

function Info({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-[13.5px] text-brand-deep">
        {children}
      </div>
    </div>
  );
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const c = await api.getContact(id);
  const name = c.name || c.phone || c.email;

  return (
    <div className="space-y-5">
      <Link
        href={`/tenants/${slug}/contacts`}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue hover:underline"
      >
        ← <T al="Kontaktet" en="Contacts" />
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Identity */}
        <Card>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/10 text-[20px] font-bold text-brand-blue">
              {(name ?? "·").slice(0, 2).toUpperCase()}
            </div>
            <div className="mt-3 text-[16px] font-bold text-brand-deep">
              {name || <T al="Vizitor anonim" en="Anonymous visitor" />}
            </div>
            {c.source ? (
              <div className="mt-1">
                <ChannelBadge kind={c.source} />
              </div>
            ) : null}
          </div>
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
            <Info label={<T al="Telefon" en="Phone" />}>{c.phone || "—"}</Info>
            <Info label="Email">{c.email || "—"}</Info>
            <Info label={<T al="Gjuha" en="Language" />}>
              {c.locale ? LANG[c.locale] ?? c.locale : "—"}
            </Info>
            <Info label={<T al="Parë së pari" en="First seen" />}>
              {formatDateTime(c.firstSeenAt)}
            </Info>
            <Info label={<T al="Parë së fundi" en="Last seen" />}>
              {formatDateTime(c.lastSeenAt)}
            </Info>
          </div>
        </Card>

        {/* History */}
        <div className="space-y-6 lg:col-span-2">
          <Card padded={false}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-[15px] font-bold text-brand-deep">
                <T al="Bisedat" en="Conversations" /> ({c.conversations.length})
              </h3>
            </div>
            {c.conversations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                <T al="Asnjë bisedë." en="No conversations." />
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {c.conversations.map((cv) => (
                  <Link
                    key={cv.id}
                    href={`/tenants/${slug}/inbox/${cv.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ChannelBadge kind={cv.channelKind} />
                        <StatusPill status={cv.status} />
                      </div>
                      <p className="mt-1 truncate text-[13px] text-slate-500">
                        {cv.lastMessagePreview || "—"}
                      </p>
                    </div>
                    <div className="flex-none text-right text-[11px] text-slate-400">
                      <div>
                        {cv.messageCount} <T al="mesazhe" en="msgs" />
                      </div>
                      <div>{formatDateTime(cv.lastMsgAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {c.leads.length > 0 ? (
            <Card padded={false}>
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-[15px] font-bold text-brand-deep">
                  <T al="Si klient potencial" en="As a lead" /> ({c.leads.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {c.leads.map((l) => {
                  const p = (l.payload ?? {}) as Record<string, unknown>;
                  return (
                    <div key={l.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold uppercase text-brand-blue">
                          {l.status === "new_" ? "new" : l.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(l.capturedAt)}
                        </span>
                      </div>
                      {field(p, "notes") ? (
                        <p className="mt-1 text-[13px] text-slate-600">
                          {field(p, "notes")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
