import Link from "next/link";
import type { ReactNode } from "react";
import type { Thread } from "@/lib/api-core";
import { T } from "@/components/T";
import { ChannelBadge } from "@/components/ui/ChannelBadge";

const LANG: Record<string, string> = {
  al: "Shqip",
  en: "English",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
};

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-[13.5px] text-brand-deep">{children}</div>
    </div>
  );
}

/** Right-hand contact panel inside a conversation. */
export function ContactPanel({ slug, thread }: { slug: string; thread: Thread }) {
  const name =
    thread.contactName || thread.contactPhone || "Vizitor anonim";

  return (
    <aside className="hidden w-[290px] flex-none flex-col border-l border-slate-200 bg-white xl:flex">
      <div className="flex flex-col items-center border-b border-slate-200 px-5 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/10 text-[20px] font-bold text-brand-blue">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="mt-3 text-[15px] font-bold text-brand-deep">{name}</div>
        <div className="mt-1">
          <ChannelBadge kind={thread.channelKind} />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <Field label={<T al="Telefon" en="Phone" />}>
          {thread.contactPhone || "—"}
        </Field>
        <Field label="Email">{thread.contactEmail || "—"}</Field>
        <Field label={<T al="Gjuha" en="Language" />}>
          {thread.locale ? LANG[thread.locale] ?? thread.locale : "—"}
        </Field>
        <Field label={<T al="Statusi i AI" en="AI status" />}>
          {thread.aiPaused ? (
            <span className="text-amber-600">
              <T al="I pezulluar" en="Paused" />
            </span>
          ) : (
            <span className="text-emerald-600">
              <T al="Aktiv" en="Active" />
            </span>
          )}
        </Field>
      </div>

      <div className="border-t border-slate-200 p-4">
        <Link
          href={`/tenants/${slug}/contacts/${thread.contactId}`}
          className="block rounded-lg bg-brand-blue px-4 py-2.5 text-center text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          <T al="Kontakti & historiku" en="Contact & history" />
        </Link>
      </div>
    </aside>
  );
}
