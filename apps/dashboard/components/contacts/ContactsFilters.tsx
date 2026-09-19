"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { CONTACT_STAGES, type ContactStage } from "@/lib/api-core";

/**
 * Contacts search / filters / sort. State lives in the URL (?q=&stage=&has=&sort=)
 * so the server page does the querying, the back button works, and a
 * filtered view can be linked. Search is debounced; everything else applies
 * on click.
 */
export function ContactsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const stage = (sp.get("stage") as ContactStage | null) ?? null;
  const has = (sp.get("has") as "phone" | "email" | null) ?? null;
  const sort = (sp.get("sort") as "name" | "recent" | null) ?? "name";

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  const t = useT({
    al: {
      search: "Kërko emër, telefon ose email…",
      all: "Të gjithë",
      stages: { new: "I ri", lead: "Potencial", client: "Ekzistues", not_a_fit: "Jo i përshtatshëm" } as Record<ContactStage, string>,
      hasPhone: "Me telefon",
      hasEmail: "Me email",
      az: "A–Z",
      recent: "Të fundit",
      clear: "Pastro",
    },
    en: {
      search: "Search name, phone or email…",
      all: "All",
      stages: { new: "New", lead: "Lead", client: "Client", not_a_fit: "Not a fit" } as Record<ContactStage, string>,
      hasPhone: "Has phone",
      hasEmail: "Has email",
      az: "A–Z",
      recent: "Recent",
      clear: "Clear",
    },
  });

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Debounce the search box so we don't re-query on every keystroke.
  useEffect(() => {
    if (text === q) return;
    const id = setTimeout(() => apply({ q: text.trim() || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const active = Boolean(q || stage || has || sort !== "name");
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-[12.5px] font-semibold ring-1 ring-inset transition ${
      on
        ? "bg-brand-blue text-white ring-brand-blue"
        : "bg-white text-slate-500 ring-slate-200 hover:text-brand-deep hover:ring-slate-300"
    }`;

  return (
    <div className="space-y-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.search}
        aria-label={t.search}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-blue"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(stage === null)} onClick={() => apply({ stage: null })}>
          {t.all}
        </button>
        {CONTACT_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            className={chip(stage === s)}
            onClick={() => apply({ stage: stage === s ? null : s })}
          >
            {t.stages[s]}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
        <button type="button" className={chip(has === "phone")} onClick={() => apply({ has: has === "phone" ? null : "phone" })}>
          {t.hasPhone}
        </button>
        <button type="button" className={chip(has === "email")} onClick={() => apply({ has: has === "email" ? null : "email" })}>
          {t.hasEmail}
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
        <button type="button" className={chip(sort === "name")} onClick={() => apply({ sort: null })}>
          {t.az}
        </button>
        <button type="button" className={chip(sort === "recent")} onClick={() => apply({ sort: "recent" })}>
          {t.recent}
        </button>
        {active ? (
          <button
            type="button"
            onClick={() => { setText(""); router.replace(pathname, { scroll: false }); }}
            className="ml-auto text-[12.5px] font-medium text-slate-500 hover:underline"
          >
            {t.clear}
          </button>
        ) : null}
      </div>
    </div>
  );
}
