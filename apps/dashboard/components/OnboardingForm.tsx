"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type PersonaPreset } from "@/lib/api";

// Self-serve business signup form (ADR-013). Auto-slugifies the name on the
// fly until the user edits the slug. POSTs to /v1/onboarding/business which
// creates Tenant + Agent + Persona + Channel + Membership(owner) atomically.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingForm({ presets }: { presets: PersonaPreset[] }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [businessFacts, setFacts] = useState("");
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");
  const [customPersona, setCustomPersona] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = presets.find((p) => p.id === presetId) ?? null;
  const previewAl = selected
    ? (selected.personas.al ?? "").replaceAll(
        "{business}",
        name.trim() || "your business",
      )
    : "";

  function onName(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  const personaOk = presetId !== "" || customPersona.trim().length >= 10;
  const canSubmit =
    name.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && personaOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const t = await api.onboardBusiness({
        name: name.trim(),
        slug,
        defaultLocale: "al",
        businessFacts: businessFacts.trim() || undefined,
        presetId: presetId || undefined,
        customAlbanianPersona: presetId
          ? undefined
          : customPersona.trim() || undefined,
        isDemo: false,
      });
      router.push(`/tenants/${t.slug}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not create business");
      setBusy(false);
    }
  }

  const card = "space-y-3 rounded-xl border border-brand-ink/10 bg-white p-5";
  const input =
    "w-full rounded border border-brand-ink/15 px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className={card}>
        <h2 className="font-display font-semibold text-brand-deep">
          Business
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">Name *</span>
            <input
              required
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Bar Roma"
              className={input}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">
              Slug * (lowercase-hyphen)
            </span>
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="bar-roma"
              className={input}
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-xs text-brand-ink/60">
            Business facts (optional) — hours, contact, policies; injected
            into every prompt
          </span>
          <textarea
            value={businessFacts}
            onChange={(e) => setFacts(e.target.value)}
            rows={2}
            className={input}
          />
        </label>
      </section>

      <section className={card}>
        <h2 className="font-display font-semibold text-brand-deep">Persona</h2>
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className={input}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.description}
            </option>
          ))}
          <option value="">Custom (write your own, Albanian)</option>
        </select>
        {selected ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-fog/50 p-3">
            <p className="text-xs text-brand-ink/55">
              Albanian preview:
            </p>
            <p className="mt-1 text-sm text-brand-ink/80">{previewAl}</p>
          </div>
        ) : (
          <textarea
            required
            value={customPersona}
            onChange={(e) => setCustomPersona(e.target.value)}
            rows={4}
            placeholder="Agent persona (Albanian) — tone, what it helps with, rules"
            className={input}
          />
        )}
      </section>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex items-center gap-3">
        <button
          disabled={!canSubmit || busy}
          className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create my business"}
        </button>
      </div>
    </form>
  );
}
