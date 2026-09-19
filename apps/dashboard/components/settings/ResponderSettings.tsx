"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type {
  ResponderMode,
  ResponderSettings,
  ResponderWindow,
} from "@/lib/api-core";

// Pre-filled the first time a business switches to "schedule": weekday
// evenings and the whole weekend — the after-hours wedge (ADR-018/020).
const SUGGESTED_WINDOWS: ResponderWindow[] = [
  { days: [1, 2, 3, 4, 5], from: "18:00", to: "09:00" },
  { days: [6, 7], from: "00:00", to: "24:00" },
];

const DAY_KEYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function ResponderSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: ResponderSettings;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ResponderMode>(initial.mode);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [windows, setWindows] = useState<ResponderWindow[]>(
    initial.windows.length ? initial.windows : SUGGESTED_WINDOWS,
  );
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");

  const t = useT({
    al: {
      human: "Ekipi përgjigjet",
      humanHelp: "Asistenti nuk përgjigjet vetë. Çdo mesazh pret një person. (Parazgjedhja.)",
      ai: "Asistenti përgjigjet",
      aiHelp: "Asistenti u përgjigjet të gjitha bisedave të reja menjëherë. Aktivizim i menjëhershëm.",
      schedule: "Sipas orarit",
      scheduleHelp: "Asistenti përgjigjet vetëm brenda orëve më poshtë; jashtë tyre përgjigjet ekipi.",
      windowsTitle: "Orët kur përgjigjet asistenti",
      timezone: "Zona kohore",
      from: "Nga",
      to: "Deri",
      addWindow: "+ Shto orar",
      remove: "Hiq",
      wrapHint: 'Nëse "Deri" është më herët se "Nga", orari kalon mesnatën (p.sh. 18:00 → 09:00).',
      days: ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"],
      save: "Ruaj",
      saved: "U ruajt — vlen nga mesazhi i ardhshëm.",
      error: "Nuk u ruajt. Kontrollo orët dhe provo sërish.",
    },
    en: {
      human: "The team answers",
      humanHelp: "The assistant doesn't reply on its own. Every message waits for a person. (Default.)",
      ai: "The assistant answers",
      aiHelp: "The assistant replies to every new conversation immediately. Activates now.",
      schedule: "By schedule",
      scheduleHelp: "The assistant answers only inside the hours below; outside them the team does.",
      windowsTitle: "Hours when the assistant answers",
      timezone: "Timezone",
      from: "From",
      to: "To",
      addWindow: "+ Add hours",
      remove: "Remove",
      wrapHint: 'If "To" is earlier than "From", the window runs past midnight (e.g. 18:00 → 09:00).',
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      save: "Save",
      saved: "Saved — applies from the next message.",
      error: "Not saved. Check the hours and try again.",
    },
  });

  function updateWindow(i: number, patch: Partial<ResponderWindow>) {
    setWindows((ws) => ws.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  }
  function toggleDay(i: number, d: number) {
    setWindows((ws) =>
      ws.map((w, j) => {
        if (j !== i) return w;
        const days = w.days.includes(d)
          ? w.days.filter((x) => x !== d)
          : [...w.days, d].sort((a, b) => a - b);
        return { ...w, days };
      }),
    );
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setState("idle");
    try {
      await api.setResponder(slug, {
        mode,
        timezone: timezone.trim() || "Europe/Tirane",
        windows,
      });
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  function Option({
    value,
    label,
    help,
  }: {
    value: ResponderMode;
    label: string;
    help: string;
  }) {
    return (
      <label
        className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition ${
          mode === value
            ? "border-brand-blue bg-brand-blue/5"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <input
          type="radio"
          name="responder-mode"
          value={value}
          checked={mode === value}
          onChange={() => setMode(value)}
          className="mt-1"
        />
        <span>
          <span className="block text-[13.5px] font-semibold text-brand-deep">{label}</span>
          <span className="block text-[12.5px] text-slate-500">{help}</span>
        </span>
      </label>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3">
        <Option value="human" label={t.human} help={t.humanHelp} />
        <Option value="ai" label={t.ai} help={t.aiHelp} />
        <Option value="schedule" label={t.schedule} help={t.scheduleHelp} />
      </div>

      {mode === "schedule" ? (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[13.5px] font-semibold text-brand-deep">{t.windowsTitle}</h4>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-500">
              {t.timezone}
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-brand-ink outline-none focus:border-brand-blue"
              />
            </label>
          </div>

          {windows.map((w, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {DAY_KEYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i, d)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset transition ${
                      w.days.includes(d)
                        ? "bg-brand-blue text-white ring-brand-blue"
                        : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    {t.days[d - 1]}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-slate-600">
                <label className="flex items-center gap-1.5">
                  {t.from}
                  <input
                    type="time"
                    value={w.from}
                    onChange={(e) => updateWindow(i, { from: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-brand-ink outline-none focus:border-brand-blue"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  {t.to}
                  <input
                    type="time"
                    value={w.to === "24:00" ? "23:59" : w.to}
                    onChange={(e) =>
                      // The <time> input can't express 24:00; treat 23:59 as
                      // end-of-day so an all-day window round-trips.
                      updateWindow(i, { to: e.target.value === "23:59" ? "24:00" : e.target.value })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-brand-ink outline-none focus:border-brand-blue"
                  />
                </label>
                {windows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))}
                    className="ml-auto text-[12px] text-rose-600 hover:underline"
                  >
                    {t.remove}
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setWindows((ws) => [...ws, { days: [1, 2, 3, 4, 5], from: "18:00", to: "09:00" }])
              }
              className="text-[12.5px] font-semibold text-brand-blue hover:underline"
            >
              {t.addWindow}
            </button>
            <span className="text-[11.5px] text-slate-400">{t.wrapHint}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-xl bg-brand-blue px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t.save}
        </button>
        {state === "saved" ? (
          <span className="text-[12.5px] text-emerald-600">{t.saved}</span>
        ) : state === "error" ? (
          <span className="text-[12.5px] text-rose-600">{t.error}</span>
        ) : null}
      </div>
    </div>
  );
}
