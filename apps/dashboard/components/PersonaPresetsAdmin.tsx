"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type PersonaPreset } from "@/lib/api";
import { useT } from "@/lib/i18n";

// Edit / add / deactivate persona presets (ADR-010). Presets are copied into
// a tenant at create time, so edits here only affect FUTURE tenants — never
// existing ones. al is required; en/it/fr/de optional.
const LOCALES = ["al", "en", "it", "fr", "de"] as const;
const EMPTY = { al: "", en: "", it: "", fr: "", de: "" };

export function PersonaPresetsAdmin({
  initial,
}: {
  initial: PersonaPreset[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const t = useT({
    al: {
      close: "Mbyll",
      newPreset: "+ Personalitet i ri",
      inactive: "joaktiv",
      edit: "Ndrysho",
      deactivate: "Çaktivizo",
      reactivate: "Riaktivizo",
      created: (label: string) => `U krijua “${label}”.`,
      deactivated: (label: string) => `U çaktivizua “${label}”.`,
      reactivated: (label: string) => `U riaktivizua “${label}”.`,
      saved: (label: string) => `U ruajt “${label}”.`,
      defaultErr: "dështoi",
    },
    en: {
      close: "Close",
      newPreset: "+ New preset",
      inactive: "inactive",
      edit: "Edit",
      deactivate: "Deactivate",
      reactivate: "Reactivate",
      created: (label: string) => `Created "${label}".`,
      deactivated: (label: string) => `Deactivated "${label}".`,
      reactivated: (label: string) => `Reactivated "${label}".`,
      saved: (label: string) => `Saved "${label}".`,
      defaultErr: "failed",
    },
  });

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.defaultErr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="rounded bg-brand-mint/20 px-3 py-2 text-sm text-brand-deep">
          {msg}
        </p>
      ) : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex justify-end">
        <button
          onClick={() => {
            setAdding((v) => !v);
            setOpenId(null);
          }}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90"
        >
          {adding ? t.close : t.newPreset}
        </button>
      </div>

      {adding ? (
        <PresetForm
          busy={busy}
          onCancel={() => setAdding(false)}
          onSubmit={(v) =>
            run(async () => {
              await api.createPersonaPreset(v);
              setAdding(false);
            }, t.created(v.label))
          }
        />
      ) : null}

      {initial.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-brand-ink/10 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-brand-deep">
                {p.label}{" "}
                <span className="text-xs font-normal text-brand-ink/45">
                  ({p.id})
                </span>
                {!p.active ? (
                  <span className="ml-2 rounded bg-brand-ink/10 px-2 py-0.5 text-xs text-brand-ink/60">
                    {t.inactive}
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-brand-ink/55">{p.description}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() =>
                  setOpenId((id) => (id === p.id ? null : p.id))
                }
                className="rounded-lg border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-fog"
              >
                {openId === p.id ? t.close : t.edit}
              </button>
              {p.active ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.deletePersonaPreset(p.id),
                      t.deactivated(p.label),
                    )
                  }
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {t.deactivate}
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.updatePersonaPreset(p.id, { active: true }),
                      t.reactivated(p.label),
                    )
                  }
                  className="rounded-lg border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-fog disabled:opacity-50"
                >
                  {t.reactivate}
                </button>
              )}
            </div>
          </div>

          {openId === p.id ? (
            <div className="mt-4 border-t border-brand-ink/10 pt-4">
              <PresetForm
                busy={busy}
                initial={{
                  label: p.label,
                  description: p.description,
                  personas: { ...EMPTY, ...p.personas },
                }}
                onCancel={() => setOpenId(null)}
                onSubmit={(v) =>
                  run(async () => {
                    await api.updatePersonaPreset(p.id, v);
                    setOpenId(null);
                  }, t.saved(v.label))
                }
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PresetForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: {
    label: string;
    description: string;
    personas: Record<string, string>;
  };
  busy: boolean;
  onSubmit: (v: {
    label: string;
    description: string;
    personas: Record<string, string>;
  }) => void;
  onCancel: () => void;
}) {
  const t = useT({
    al: {
      labelPlaceholder: "Emërtimi (p.sh. Restorant, kafe & bar)",
      descPlaceholder: "Përshkrim i shkurtër",
      helperBefore: "Përdor ",
      helperAfter:
        " aty ku duhet të shfaqet emri i biznesit. ",
      helperRequired: "al",
      helperRest: " është i detyrueshëm; të tjerët opsionalë.",
      requiredPrimary: " (i detyrueshëm, kryesor)",
      cancel: "Anulo",
      save: "Ruaj",
      saving: "Duke ruajtur…",
    },
    en: {
      labelPlaceholder: "Label (e.g. Restaurant, café & bar)",
      descPlaceholder: "Short description",
      helperBefore: "Use ",
      helperAfter: " where the tenant's name should appear. ",
      helperRequired: "al",
      helperRest: " is required; others optional.",
      requiredPrimary: " (required, primary)",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving…",
    },
  });

  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [personas, setPersonas] = useState<Record<string, string>>(
    initial?.personas ?? { ...EMPTY },
  );

  const alOk = (personas.al ?? "").trim().length >= 10;
  const ok = label.trim() && description.trim() && alOk;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder={t.labelPlaceholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded border border-brand-ink/15 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.descPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border border-brand-ink/15 px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-brand-ink/55">
        {t.helperBefore}
        <code>{"{business}"}</code>
        {t.helperAfter}
        <strong>{t.helperRequired}</strong>
        {t.helperRest}
      </p>
      {LOCALES.map((loc) => (
        <div key={loc} className="space-y-1">
          <label className="text-xs font-medium text-brand-ink/60">
            {loc}
            {loc === "al" ? t.requiredPrimary : ""}
          </label>
          <textarea
            value={personas[loc] ?? ""}
            onChange={(e) =>
              setPersonas((p) => ({ ...p, [loc]: e.target.value }))
            }
            rows={loc === "al" ? 4 : 3}
            className="w-full rounded border border-brand-ink/15 px-3 py-2 font-mono text-xs"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          disabled={!ok || busy}
          onClick={() =>
            onSubmit({
              label: label.trim(),
              description: description.trim(),
              personas,
            })
          }
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? t.saving : t.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-brand-ink/60"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
