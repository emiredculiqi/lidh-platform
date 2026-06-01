"use client";

import { useState } from "react";
import { api, type Agent } from "@/lib/api";

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
      setMsg(
        `Model set to ${
          MODELS.find((m) => m.id === model)?.label ?? model
        } — effective on the next message.`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
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
      setMsg(`Saved "${locale}" — effective on the next message.`);
      setNewLocale("");
      setNewContent("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-ink/10 bg-white p-4 text-sm">
        <p>
          <span className="text-brand-ink/55">Agent:</span>{" "}
          <span className="font-medium">{agent.name}</span> ·{" "}
          <span className="text-brand-ink/55">default locale:</span>{" "}
          {agent.defaultLocale} ·{" "}
          <span className="text-brand-ink/55">tools:</span>{" "}
          {Object.entries(agent.toolsEnabled)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ") || "none"}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-brand-ink/10 bg-white p-4">
        <div>
          <h3 className="font-display font-semibold text-brand-deep">
            Model
          </h3>
          <p className="text-sm text-brand-ink/55">
            Which Claude model answers for this tenant. Applies on the next
            message.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => {
            const selected = currentModel === m.id;
            return (
              <button
                key={m.id}
                disabled={savingModel}
                onClick={() => saveModel(m.id)}
                className={`rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
                  selected
                    ? "border-brand-blue bg-brand-blue/10 font-medium text-brand-blue"
                    : "border-brand-ink/15 text-brand-ink/70 hover:bg-brand-fog"
                }`}
              >
                {m.label}
                <span className="ml-1 text-xs text-brand-ink/45">
                  ({m.note})
                </span>
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
          className="space-y-2 rounded-xl border border-brand-ink/10 bg-white p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-brand-deep">
              Persona · {p.locale}
            </h3>
            <button
              onClick={() => save(p.locale, drafts[p.locale] ?? "")}
              disabled={savingLocale === p.locale}
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingLocale === p.locale ? "Saving…" : "Save"}
            </button>
          </div>
          <textarea
            value={drafts[p.locale] ?? ""}
            onChange={(e) =>
              setDrafts((d) => ({ ...d, [p.locale]: e.target.value }))
            }
            rows={8}
            className="w-full rounded border border-brand-ink/15 px-3 py-2 font-mono text-xs"
          />
        </div>
      ))}

      <div className="space-y-2 rounded-xl border border-dashed border-brand-ink/20 bg-white p-4">
        <h3 className="font-display font-semibold text-brand-deep">
          Add a language
        </h3>
        <input
          placeholder="locale (e.g. en, it, de)"
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value)}
          className="w-40 rounded border border-brand-ink/15 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Persona text for this language…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={6}
          className="w-full rounded border border-brand-ink/15 px-3 py-2 font-mono text-xs"
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
          Add language
        </button>
      </div>
    </div>
  );
}
