"use client";

import { useEffect, useState } from "react";
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
  // What the server currently holds — for the "unsaved changes" signal.
  const [persisted, setPersisted] = useState<ResponderSettings>(initial);

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
      saving: "Po ruhet…",
      unsaved: "Ndryshime të paruajtura — shtyp Ruaj që të hyjnë në fuqi.",
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
      saving: "Saving…",
      unsaved: "Unsaved changes — press Save to apply them.",
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

  /**
   * Persist. `nextMode` is passed by the radio click because state updates
   * are async; a plain mode change sends the last VALID windows, so a
   * half-edited schedule can never block switching to human or assistant.
   */
  async function save(nextMode?: ResponderMode): Promise<boolean> {
    if (busy) return false;
    const m = nextMode ?? mode;
    setBusy(true);
    setState("idle");
    try {
      const r = await api.setResponder(slug, {
        mode: m,
        timezone: (m === "schedule" ? timezone : persisted.timezone).trim() || "Europe/Tirane",
        windows: m === "schedule" ? windows : persisted.windows,
      });
      setPersisted(r);
      setState("saved");
      router.refresh();
      return true;
    } catch {
      setState("error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // The mode is one field, so it saves on click — the Save button below is
  // only for the schedule, which needs hours before it can apply. Reverts
  // the radio if the server refused.
  function pick(value: ResponderMode) {
    if (busy || value === mode) return;
    const prev = mode;
    setMode(value);
    if (value === "schedule") {
      setState("idle");
      return;
    }
    void save(value).then((ok) => {
      if (!ok) setMode(prev);
    });
  }

  const dirty =
    mode === "schedule" &&
    (persisted.mode !== "schedule" ||
      persisted.timezone !== timezone.trim() ||
      JSON.stringify(persisted.windows) !== JSON.stringify(windows));

  // A closed tab must not lose an edited schedule silently.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const status =
    busy ? (
      <span className="text-[12.5px] text-slate-500">{t.saving}</span>
    ) : dirty ? (
      <span className="text-[12.5px] font-medium text-amber-700">{t.unsaved}</span>
    ) : state === "saved" ? (
      <span className="text-[12.5px] text-emerald-600">{t.saved}</span>
    ) : state === "error" ? (
      <span className="text-[12.5px] text-rose-600">{t.error}</span>
    ) : null;


  return (
    <div className="space-y-5">
      <div className="grid gap-3">
        <Option value="human" label={t.human} help={t.humanHelp} mode={mode} onPick={pick} disabled={busy} />
        <Option value="ai" label={t.ai} help={t.aiHelp} mode={mode} onPick={pick} disabled={busy} />
        <Option value="schedule" label={t.schedule} help={t.scheduleHelp} mode={mode} onPick={pick} disabled={busy} />
      </div>
      {mode !== "schedule" ? <div aria-live="polite">{status}</div> : null}

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

      {mode === "schedule" ? (
        <div className="flex flex-wrap items-center gap-3" aria-live="polite">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !dirty}
            className="rounded-xl bg-brand-blue px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {t.save}
          </button>
          {status}
        </div>
      ) : null}
    </div>
  );
}

/** One radio card. Top-level on purpose: a component defined inside the
 *  form's render would be a new type every render and remount its input. */
function Option({
  value,
  label,
  help,
  mode,
  onPick,
  disabled,
}: {
  value: ResponderMode;
  label: string;
  help: string;
  mode: ResponderMode;
  onPick: (m: ResponderMode) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex gap-3 rounded-xl border px-4 py-3 transition ${
        disabled ? "cursor-wait opacity-70" : "cursor-pointer"
      } ${
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
        disabled={disabled}
        onChange={() => onPick(value)}
        className="mt-1"
      />
      <span>
        <span className="block text-[13.5px] font-semibold text-brand-deep">{label}</span>
        <span className="block text-[12.5px] text-slate-500">{help}</span>
      </span>
    </label>
  );
}
