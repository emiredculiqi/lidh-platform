"use client";

import { useState } from "react";
import { api, type Agent } from "@/lib/api";
import { useT } from "@/lib/i18n";

// Keep in sync with @lidh/core SELECTABLE_MODELS (ADR-011). null/haiku =
// platform default.
const MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku",
    note: "fast & low-cost · default",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet",
    note: "higher quality · higher cost",
  },
] as const;

// Edit a persona per language + add a new language. Saving takes effect on
// the next chat message (the runtime reads the persona fresh per request).
export function AgentEditor({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: Agent;
}) {
  const t = useT({
    al: {
      modelHaikuNote: "i shpejtë & me kosto të ulët · parazgjedhur",
      modelSonnetNote: "cilësi më e lartë · kosto më e lartë",
      agentLabel: "Agjenti:",
      defaultLocaleLabel: "gjuha kryesore:",
      toolsLabel: "veglat:",
      none: "asnjë",
      modelHeading: "Modeli",
      modelHelp:
        "Cilin model Claude përdor ky biznes. Aplikohet në mesazhin tjetër.",
      personaHeading: "Personaliteti · ",
      saving: "Duke ruajtur…",
      save: "Ruaj",
      addLanguage: "Shto një gjuhë",
      localePlaceholder: "kodi (p.sh. en, it, de)",
      personaPlaceholder: "Teksti i personalitetit për këtë gjuhë…",
      addLanguageBtn: "Shto gjuhën",
      modelSetMsg: (label: string) =>
        `Modeli u caktua në ${label} — efektiv në mesazhin tjetër.`,
      savedMsg: (locale: string) =>
        `U ruajt “${locale}” — efektiv në mesazhin tjetër.`,
      saveFailed: "ruajtja dështoi",
    },
    en: {
      modelHaikuNote: "fast & low-cost · default",
      modelSonnetNote: "higher quality · higher cost",
      agentLabel: "Agent:",
      defaultLocaleLabel: "default locale:",
      toolsLabel: "tools:",
      none: "none",
      modelHeading: "Model",
      modelHelp:
        "Which Claude model answers for this tenant. Applies on the next message.",
      personaHeading: "Persona · ",
      saving: "Saving…",
      save: "Save",
      addLanguage: "Add a language",
      localePlaceholder: "locale (e.g. en, it, de)",
      personaPlaceholder: "Persona text for this language…",
      addLanguageBtn: "Add language",
      modelSetMsg: (label: string) =>
        `Model set to ${label} — effective on the next message.`,
      savedMsg: (locale: string) =>
        `Saved "${locale}" — effective on the next message.`,
      saveFailed: "save failed",
    },
  });

  const [agent, setAgent] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.personas.map((p) => [p.locale, p.content])),
  );
  const [savingLocale, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [newLocale, setNewLocale] = useState("");
  const [newContent, setNewContent] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  // null override ⇒ platform default, which is Haiku.
  const currentModel = agent.modelOverride ?? "claude-haiku-4-5";

  async function saveModel(model: string) {
    if (model === currentModel || savingModel) return;
    setSavingModel(true);
    setMsg(null);
    try {
      const updated = await api.setAgentModel(tenantSlug, model);
      setAgent(updated);
      const label = MODELS.find((m) => m.id === model)?.label ?? model;
      setMsg(t.modelSetMsg(label));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSavingModel(false);
    }
  }

  async function save(locale: string, content: string) {
    setSaving(locale);
    setMsg(null);
    try {
      const updated = await api.upsertPersona({
        tenantSlug,
        locale,
        content,
      });
      setAgent(updated);
      setDrafts(
        Object.fromEntries(updated.personas.map((p) => [p.locale, p.content])),
      );
      setMsg(t.savedMsg(locale));
      setNewLocale("");
      setNewContent("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <p>
          <span className="text-slate-500">{t.agentLabel}</span>{" "}
          <span className="font-medium">{agent.name}</span> ·{" "}
          <span className="text-slate-500">{t.defaultLocaleLabel}</span>{" "}
          {agent.defaultLocale} ·{" "}
          <span className="text-slate-500">{t.toolsLabel}</span>{" "}
          {Object.entries(agent.toolsEnabled)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ") || t.none}
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h3 className="font-display font-semibold text-brand-deep">
            {t.modelHeading}
          </h3>
          <p className="text-sm text-slate-500">{t.modelHelp}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => {
            const selected = currentModel === m.id;
            const note =
              m.id === "claude-haiku-4-5" ? t.modelHaikuNote : t.modelSonnetNote;
            return (
              <button
                key={m.id}
                disabled={savingModel}
                onClick={() => saveModel(m.id)}
                className={`rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
                  selected
                    ? "border-brand-blue bg-brand-blue/10 font-medium text-brand-blue"
                    : "border-slate-200 text-brand-ink/70 hover:bg-slate-50"
                }`}
              >
                {m.label}
                <span className="ml-1 text-xs text-slate-400">({note})</span>
                {selected ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {msg ? (
        <p className="rounded bg-brand-mint/20 px-3 py-2 text-sm text-brand-deep">
          {msg}
        </p>
      ) : null}

      {agent.personas.map((p) => (
        <div
          key={p.locale}
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-brand-deep">
              {t.personaHeading}
              {p.locale}
            </h3>
            <button
              onClick={() => save(p.locale, drafts[p.locale] ?? "")}
              disabled={savingLocale === p.locale}
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingLocale === p.locale ? t.saving : t.save}
            </button>
          </div>
          <textarea
            value={drafts[p.locale] ?? ""}
            onChange={(e) =>
              setDrafts((d) => ({ ...d, [p.locale]: e.target.value }))
            }
            rows={8}
            className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </div>
      ))}

      <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-white p-5">
        <h3 className="font-display font-semibold text-brand-deep">
          {t.addLanguage}
        </h3>
        <input
          placeholder={t.localePlaceholder}
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value)}
          className="w-40 rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <textarea
          placeholder={t.personaPlaceholder}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={6}
          className="w-full rounded border border-slate-200 px-3 py-2 font-mono text-xs"
        />
        <button
          onClick={() => save(newLocale.trim(), newContent)}
          disabled={
            !newLocale.trim() ||
            newContent.trim().length < 10 ||
            savingLocale === newLocale.trim()
          }
          className="rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.addLanguageBtn}
        </button>
      </div>
    </div>
  );
}
