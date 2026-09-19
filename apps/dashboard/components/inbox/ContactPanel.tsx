import Link from "next/link";
import type { ReactNode } from "react";
import type { Thread } from "@/lib/api-core";
import { T } from "@/components/T";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StageSelect } from "@/components/contacts/Stage";
import { ContactTasks } from "@/components/contacts/ContactTasks";
import { contactDisplayName, contactInitials } from "@/lib/contact-name";

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
  const who = {
    name: thread.contactName,
    phone: thread.contactPhone,
    email: thread.contactEmail,
  };
  const name = contactDisplayName(who) ?? "Vizitor anonim";

  return (
    <aside className="hidden w-[290px] flex-none flex-col border-l border-slate-200 bg-white xl:flex">
      <div className="flex flex-col items-center border-b border-slate-200 px-5 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/10 text-[20px] font-bold text-brand-blue">
          {contactInitials(who)}
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
        <Field label={<T al="Statusi i klientit" en="Customer stage" />}>
          <StageSelect contactId={thread.contactId} stage={thread.contactStage} />
        </Field>
        <div className="border-t border-slate-200 pt-4">
          <ContactTasks
            contactId={thread.contactId}
            conversationId={thread.id}
            tasks={thread.tasks}
            compact
          />
        </div>
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
