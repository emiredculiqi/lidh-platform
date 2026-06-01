"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type PersonaPreset } from "@/lib/api";

// Full-page tenant creation: business details, persona, demo/widget settings
// and (optional) initial knowledge sources — all in one place. On submit the
// tenant is created first, then each queued knowledge source is ingested
// against the new tenant, then we land on its Overview.

const LOCALES = ["al", "en", "it", "fr", "de"] as const;
const MAX_FILE_BYTES = 14 * 1024 * 1024; // ~ Fastify 20MB ÷ base64 inflate

type Queued =
  | { kind: "url"; label: string; uri: string }
  | { kind: "paste"; label: string; title: string; content: string }
  | { kind: "upload"; label: string; filename: string; base64: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("could not read file"));
    r.readAsDataURL(f);
  });
}

export function NewTenantWizard({ presets }: { presets: PersonaPreset[] }) {
  const router = useRouter();

  // ── business ──
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [defaultLocale, setDefaultLocale] = useState("al");
  const [agentName, setAgentName] = useState("");
  const [businessFacts, setFacts] = useState("");

  // ── persona ── "" = custom
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "");
  const [persona, setPersona] = useState("");

  // ── widget origins (web channel allowed origins) ──
  const [origins, setOrigins] = useState("");

  // ── knowledge queue ──
  const [sources, setSources] = useState<Queued[]>([]);
  const [kMode, setKMode] = useState<"url" | "upload" | "paste">("url");
  const [kUri, setKUri] = useState("");
  const [kTitle, setKTitle] = useState("");
  const [kContent, setKContent] = useState("");
  const [kFile, setKFile] = useState<File | null>(null);
  const [kErr, setKErr] = useState<string | null>(null);

  // ── submit state ──
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);

  const selectedPreset = presets.find((p) => p.id === presetId) ?? null;
  const previewAl = selectedPreset
    ? (selectedPreset.personas.al ?? "").replaceAll(
        "{business}",
        name.trim() || "your business",
      )
    : "";

  function onName(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function addSource() {
    setKErr(null);
    try {
      if (kMode === "url") {
        if (!kUri.trim()) throw new Error("enter a URL");
        setSources((s) => [
          ...s,
          { kind: "url", label: kUri.trim(), uri: kUri.trim() },
        ]);
        setKUri("");
      } else if (kMode === "paste") {
        if (kContent.trim().length < 20)
          throw new Error("paste at least 20 characters");
        setSources((s) => [
          ...s,
          {
            kind: "paste",
            label: kTitle.trim() || "Pasted text",
            title: kTitle.trim(),
            content: kContent,
          },
        ]);
        setKTitle("");
        setKContent("");
      } else {
        if (!kFile) throw new Error("choose a file");
        if (kFile.size > MAX_FILE_BYTES)
          throw new Error("file too large (max ~14MB)");
        const base64 = await fileToBase64(kFile);
        setSources((s) => [
          ...s,
          { kind: "upload", label: kFile.name, filename: kFile.name, base64 },
        ]);
        setKFile(null);
      }
    } catch (e) {
      setKErr(e instanceof Error ? e.message : "failed");
    }
  }

  const personaOk = presetId !== "" || persona.trim().length >= 10;
  const canSubmit =
    name.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && personaOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);
    setSourceErrors([]);

    // 1. create the tenant
    let tenantSlug: string;
    try {
      const base = {
        name: name.trim(),
        slug,
        defaultLocale,
        agentName: agentName.trim() || undefined,
        businessFacts: businessFacts.trim() || undefined,
        webAllowedOrigins: origins
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      };
      const body = presetId
        ? { ...base, presetId }
        : { ...base, personas: [{ locale: "al", content: persona }] };
      const t = await api.createTenant(body);
      tenantSlug = t.slug;
      setCreatedSlug(t.slug);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not create tenant");
      setBusy(false);
      return;
    }

    // 2. ingest queued knowledge (tenant already exists — failures are
    //    non-fatal; the operator can retry them on the Overview page).
    const failed: string[] = [];
    for (const s of sources) {
      try {
        if (s.kind === "url") {
          await api.addKnowledge({ tenantSlug, kind: "url", uri: s.uri });
        } else if (s.kind === "paste") {
          await api.addText({
            tenantSlug,
            title: s.title || undefined,
            content: s.content,
          });
        } else {
          await api.uploadDoc({
            tenantSlug,
            filename: s.filename,
            contentBase64: s.base64,
          });
        }
      } catch (e) {
        failed.push(
          `${s.label} — ${e instanceof Error ? e.message : "failed"}`,
        );
      }
    }

    if (failed.length === 0) {
      router.push(`/tenants/${tenantSlug}`);
      router.refresh();
    } else {
      setSourceErrors(failed);
      setBusy(false);
    }
  }

  // Tenant created but some knowledge failed — don't lose the tenant.
  if (createdSlug && sourceErrors.length > 0) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-ink/10 bg-white p-5">
        <p className="font-medium text-brand-deep">
          Tenant created ✓ — but some knowledge sources didn&apos;t ingest:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
          {sourceErrors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <p className="text-sm text-brand-ink/55">
          Retry these on the tenant&apos;s Overview page.
        </p>
        <Link
          href={`/tenants/${createdSlug}`}
          className="inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white"
        >
          Continue to tenant →
        </Link>
      </div>
    );
  }

  const card = "space-y-3 rounded-xl border border-brand-ink/10 bg-white p-5";
  const input =
    "w-full rounded border border-brand-ink/15 px-3 py-2 text-sm";
  const heading = "font-display font-semibold text-brand-deep";

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Business */}
      <section className={card}>
        <h2 className={heading}>Business</h2>
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
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">Default language</span>
            <select
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              className={input}
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">
              Agent name (optional)
            </span>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Defaults to “<name> Assistant”"
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

      {/* Persona */}
      <section className={card}>
        <h2 className={heading}>Persona</h2>
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
        {selectedPreset ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-fog/50 p-3">
            <p className="text-xs text-brand-ink/55">
              Creates personas in <strong>al, en, it, fr, de</strong>.
              Albanian preview:
            </p>
            <p className="mt-1 text-sm text-brand-ink/80">{previewAl}</p>
          </div>
        ) : (
          <textarea
            required
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={4}
            placeholder="Agent persona (Albanian) — tone, what it helps with, rules"
            className={input}
          />
        )}
      </section>

      {/* Widget origins */}
      <section className={card}>
        <h2 className={heading}>Widget</h2>
        <p className="text-sm text-brand-ink/55">
          The funnel page at <code>app.lidh.al/b/{slug || "&lt;slug&gt;"}</code>{" "}
          is created automatically. Every new tenant starts on a 15-day trial.
        </p>
        <label className="space-y-1">
          <span className="text-xs text-brand-ink/60">
            Allowed widget origins (optional, comma-separated) — only needed
            if the SMB also embeds the chat on their own website.
          </span>
          <input
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder="https://barroma.al, https://www.barroma.al"
            className={input}
          />
        </label>
      </section>

      {/* Knowledge */}
      <section className={card}>
        <h2 className={heading}>Knowledge (optional)</h2>
        <p className="text-sm text-brand-ink/55">
          Add the customer&apos;s website, documents or pasted text — ingested
          right after the tenant is created. You can also do this later.
        </p>

        {sources.length > 0 ? (
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded border border-brand-ink/10 px-3 py-1.5 text-sm"
              >
                <span>
                  <span className="text-brand-ink/45">{s.kind}</span>{" "}
                  <span className="break-all">{s.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSources((arr) => arr.filter((_, j) => j !== i))
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-1">
          {(["url", "upload", "paste"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setKMode(m);
                setKErr(null);
              }}
              className={`rounded-t-lg px-3 py-1.5 text-sm font-medium ${
                kMode === m
                  ? "border border-b-0 border-brand-ink/10 bg-white text-brand-deep"
                  : "text-brand-ink/55 hover:text-brand-ink"
              }`}
            >
              {m === "url"
                ? "Crawl URL"
                : m === "upload"
                  ? "Upload file"
                  : "Paste text"}
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-lg rounded-tl-none border border-brand-ink/10 p-3">
          {kMode === "url" && (
            <input
              value={kUri}
              onChange={(e) => setKUri(e.target.value)}
              placeholder="https://customer-website.com"
              className={input}
            />
          )}
          {kMode === "upload" && (
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
              onChange={(e) => setKFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-brand-ink/70 file:mr-3 file:rounded file:border-0 file:bg-brand-blue file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          )}
          {kMode === "paste" && (
            <>
              <input
                value={kTitle}
                onChange={(e) => setKTitle(e.target.value)}
                placeholder="Title (optional) — e.g. Price list"
                className={input}
              />
              <textarea
                value={kContent}
                onChange={(e) => setKContent(e.target.value)}
                rows={4}
                placeholder="Paste the content (hours, services, FAQ, prices…)."
                className={input}
              />
            </>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addSource}
              className="rounded-lg border border-brand-ink/15 px-3 py-1.5 text-sm font-medium hover:bg-brand-fog"
            >
              + Add to list
            </button>
            {kErr ? (
              <span className="text-sm text-red-600">{kErr}</span>
            ) : null}
          </div>
        </div>
      </section>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex items-center gap-3">
        <button
          disabled={!canSubmit || busy}
          className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
        >
          {busy
            ? "Creating…"
            : sources.length > 0
              ? `Create tenant + ${sources.length} source${sources.length > 1 ? "s" : ""}`
              : "Create tenant"}
        </button>
        <Link
          href="/tenants"
          className="rounded-lg px-4 py-2 text-sm text-brand-ink/60 hover:text-brand-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
