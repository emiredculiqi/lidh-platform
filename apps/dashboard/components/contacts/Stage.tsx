"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CONTACT_STAGES, type ContactStage } from "@/lib/api-core";

// One colour per stage, shared by the pill and the selector so a contact looks
// the same in the inbox list, the thread header, the right panel and the
// contacts page.
const TONE: Record<ContactStage, string> = {
  new: "bg-slate-100 text-slate-600 ring-slate-200",
  lead: "bg-amber-50 text-amber-700 ring-amber-200",
  client: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  not_a_fit: "bg-rose-50 text-rose-700 ring-rose-200",
};

function useStageLabels(): Record<ContactStage, string> {
  return useT({
    al: { new: "I ri", lead: "Potencial", client: "Ekzistues", not_a_fit: "Jo i përshtatshëm" },
    en: { new: "New", lead: "Lead", client: "Client", not_a_fit: "Not a fit" },
  });
}

/** Read-only stage badge. */
export function StagePill({ stage }: { stage: ContactStage }) {
  const labels = useStageLabels();
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE[stage] ?? TONE.new}`}
    >
      {labels[stage] ?? stage}
    </span>
  );
}

/**
 * One-click stage selector. Optimistic: the chosen pill highlights at once,
 * then the server-rendered pages around it refresh so lists agree.
 */
export function StageSelect({
  contactId,
  stage,
}: {
  contactId: string;
  stage: ContactStage;
}) {
  const router = useRouter();
  const labels = useStageLabels();
  const [current, setCurrent] = useState<ContactStage>(stage);
  const [busy, setBusy] = useState(false);

  async function choose(next: ContactStage) {
    if (busy || next === current) return;
    const prev = current;
    setCurrent(next);
    setBusy(true);
    try {
      await api.setContactStage(contactId, next);
      router.refresh();
    } catch {
      setCurrent(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {CONTACT_STAGES.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={busy}
            onClick={() => choose(s)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset transition ${
              active
                ? TONE[s]
                : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600 hover:ring-slate-300"
            } disabled:opacity-60`}
          >
            {labels[s]}
          </button>
        );
      })}
    </div>
  );
}
