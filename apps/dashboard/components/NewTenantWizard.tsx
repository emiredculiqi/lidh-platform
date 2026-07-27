"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type PersonaPreset } from "@/lib/api";
import { useT } from "@/lib/i18n";

// Full-page tenant creation: business details, persona, widget settings
// and (optional) initial knowledge sources — all in one place. On submit
// the tenant is created first, then each queued knowledge source is
// ingested against the new tenant, then we land on its Overview.

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

  const t = useT({
    al: {
      business: "Biznesi",
      name: "Emri *",
      slug: "Slug * (shkronja të vogla me viza)",
      defaultLanguage: "Gjuha kryesore",
      agentName: "Emri i agjentit (opsional)",
      agentNamePlaceholder: "Si parazgjedhje “<emër> Assistant”",
      businessFacts:
        "Fakte për biznesin (opsionale) — oraret, kontakti, rregullat; futen në çdo prompt",
      ownerEmailLabel:
        "Email i pronarit (opsional) — nëse regjistrohen më vonë në app.lidh.al me këtë email, do të lidhen automatikisht si pronarë.",
      ownerEmailPlaceholder: "owner@business.al",
      persona: "Personaliteti",
      customOption: "I personalizuar (shkruaje vetë, në shqip)",
      previewExplainer: "Krijon personalitete në ",
      previewExplainer2: ". Pamje paraprake në shqip:",
      customPlaceholder:
        "Personaliteti i agjentit (në shqip) — toni, çfarë ndihmon, rregullat",
      widget: "Widget",
      funnelExplainer1: "Faqja e funelit në ",
      funnelExplainer2:
        " krijohet automatikisht. Çdo biznes i ri fillon me një provë 15-ditore.",
      originsLabel:
        "Origjinat e lejuara për widget (opsionale, ndarë me presje) — vetëm nëse SMB-ja e fut chat-in edhe në faqen e vet.",
      knowledge: "Njohuria (opsionale)",
      knowledgeDesc:
        "Shto faqen e klientit, dokumentet ose tekstin e ngjitur — futen menjëherë pas krijimit të biznesit. Mund ta bësh edhe më vonë.",
      remove: "hiq",
      crawlUrl: "Crawl URL",
      uploadFile: "Ngarko skedar",
      pasteText: "Ngjit tekst",
      pastedTextLabel: "Tekst i ngjitur",
      titlePlaceholder: "Titulli (opsional) — p.sh. Lista e çmimeve",
      contentPlaceholder:
        "Ngjit përmbajtjen (oraret, shërbimet, FAQ, çmimet…).",
      addToList: "+ Shto në listë",
      cancel: "Anulo",
      creating: "Duke krijuar…",
      createTenant: "Krijo biznesin",
      createTenantWith: (n: number) =>
        `Krijo biznesin + ${n} burim${n === 1 ? "" : "e"}`,
      tenantCreatedTitle:
        "Biznesi u krijua ✓ — por disa burime njohurish nuk u futën:",
      tenantCreatedRetry: "Riprovo këto në faqen Përmbledhje të biznesit.",
      continueToTenant: "Vazhdo te biznesi →",
      errEnterUrl: "vendos një URL",
      errPasteMin: "ngjit të paktën 20 karaktere",
      errChooseFile: "zgjidh një skedar",
      errFileTooLarge: "skedari shumë i madh (max ~14MB)",
      errFailed: "dështoi",
      errDefault: "biznesi nuk u krijua dot",
      errCouldNotRead: "skedari nuk u lexua dot",
    },
    en: {
      business: "Business",
      name: "Name *",
      slug: "Slug * (lowercase-hyphen)",
      defaultLanguage: "Default language",
      agentName: "Agent name (optional)",
      agentNamePlaceholder: "Defaults to “<name> Assistant”",
      businessFacts:
        "Business facts (optional) — hours, contact, policies; injected into every prompt",
      ownerEmailLabel:
        "Owner email (optional) — if they sign up later at app.lidh.al with this email, they'll be bound as owner automatically.",
      ownerEmailPlaceholder: "owner@business.al",
      persona: "Persona",
      customOption: "Custom (write your own, Albanian)",
      previewExplainer: "Creates personas in ",
      previewExplainer2: ". Albanian preview:",
      customPlaceholder:
        "Agent persona (Albanian) — tone, what it helps with, rules",
      widget: "Widget",
      funnelExplainer1: "The funnel page at ",
      funnelExplainer2:
        " is created automatically. Every new tenant starts on a 30-day trial.",
      originsLabel:
        "Allowed widget origins (optional, comma-separated) — only needed if the SMB also embeds the chat on their own website.",
      knowledge: "Knowledge (optional)",
      knowledgeDesc:
        "Add the customer's website, documents or pasted text — ingested right after the tenant is created. You can also do this later.",
      remove: "remove",
      crawlUrl: "Crawl URL",
      uploadFile: "Upload file",
      pasteText: "Paste text",
      pastedTextLabel: "Pasted text",
      titlePlaceholder: "Title (optional) — e.g. Price list",
      contentPlaceholder:
        "Paste the content (hours, services, FAQ, prices…).",
      addToList: "+ Add to list",
      cancel: "Cancel",
      creating: "Creating…",
      createTenant: "Create tenant",
      createTenantWith: (n: number) =>
        `Create tenant + ${n} source${n === 1 ? "" : "s"}`,
      tenantCreatedTitle:
        "Tenant created ✓ — but some knowledge sources didn't ingest:",
      tenantCreatedRetry:
        "Retry these on the tenant's Overview page.",
      continueToTenant: "Continue to tenant →",
      errEnterUrl: "enter a URL",
      errPasteMin: "paste at least 20 characters",
      errChooseFile: "choose a file",
      errFileTooLarge: "file too large (max ~14MB)",
      errFailed: "failed",
      errDefault: "could not create tenant",
      errCouldNotRead: "could not read file",
    },
  });

  // ── business ──
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [defaultLocale, setDefaultLocale] = useState("al");
  const [agentName, setAgentName] = useState("");
  const [businessFacts, setFacts] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

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
        if (!kUri.trim()) throw new Error(t.errEnterUrl);
        setSources((s) => [
          ...s,
          { kind: "url", label: kUri.trim(), uri: kUri.trim() },
        ]);
        setKUri("");
      } else if (kMode === "paste") {
        if (kContent.trim().length < 20) throw new Error(t.errPasteMin);
        setSources((s) => [
          ...s,
          {
            kind: "paste",
            label: kTitle.trim() || t.pastedTextLabel,
            title: kTitle.trim(),
            content: kContent,
          },
        ]);
        setKTitle("");
        setKContent("");
      } else {
        if (!kFile) throw new Error(t.errChooseFile);
        if (kFile.size > MAX_FILE_BYTES) throw new Error(t.errFileTooLarge);
        const base64 = await fileToBase64(kFile);
        setSources((s) => [
          ...s,
          { kind: "upload", label: kFile.name, filename: kFile.name, base64 },
        ]);
        setKFile(null);
      }
    } catch (e) {
      setKErr(e instanceof Error ? e.message : t.errFailed);
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
        ownerEmail: ownerEmail.trim() || undefined,
        webAllowedOrigins: origins
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      };
      const body = presetId
        ? { ...base, presetId }
        : { ...base, personas: [{ locale: "al", content: persona }] };
      const tenant = await api.createTenant(body);
      tenantSlug = tenant.slug;
      setCreatedSlug(tenant.slug);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errDefault);
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
          `${s.label} — ${e instanceof Error ? e.message : t.errFailed}`,
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

  if (createdSlug && sourceErrors.length > 0) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-ink/10 bg-white p-5">
        <p className="font-medium text-brand-deep">{t.tenantCreatedTitle}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
          {sourceErrors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <p className="text-sm text-brand-ink/55">{t.tenantCreatedRetry}</p>
        <Link
          href={`/tenants/${createdSlug}`}
          className="inline-block rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white"
        >
          {t.continueToTenant}
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
        <h2 className={heading}>{t.business}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">{t.name}</span>
            <input
              required
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Bar Roma"
              className={input}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-brand-ink/60">{t.slug}</span>
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
            <span className="text-xs text-brand-ink/60">
              {t.defaultLanguage}
            </span>
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
            <span className="text-xs text-brand-ink/60">{t.agentName}</span>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder={t.agentNamePlaceholder}
              className={input}
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-xs text-brand-ink/60">{t.businessFacts}</span>
          <textarea
            value={businessFacts}
            onChange={(e) => setFacts(e.target.value)}
            rows={2}
            className={input}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-brand-ink/60">{t.ownerEmailLabel}</span>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder={t.ownerEmailPlaceholder}
            className={input}
          />
        </label>
      </section>

      {/* Persona */}
      <section className={card}>
        <h2 className={heading}>{t.persona}</h2>
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
          <option value="">{t.customOption}</option>
        </select>
        {selectedPreset ? (
          <div className="rounded-lg border border-brand-ink/10 bg-brand-fog/50 p-3">
            <p className="text-xs text-brand-ink/55">
              {t.previewExplainer}
              <strong>al, en, it, fr, de</strong>
              {t.previewExplainer2}
            </p>
            <p className="mt-1 text-sm text-brand-ink/80">{previewAl}</p>
          </div>
        ) : (
          <textarea
            required
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={4}
            placeholder={t.customPlaceholder}
            className={input}
          />
        )}
      </section>

      {/* Widget origins */}
      <section className={card}>
        <h2 className={heading}>{t.widget}</h2>
        <p className="text-sm text-brand-ink/55">
          {t.funnelExplainer1}
          <code>app.lidh.al/b/{slug || "<slug>"}</code>
          {t.funnelExplainer2}
        </p>
        <label className="space-y-1">
          <span className="text-xs text-brand-ink/60">{t.originsLabel}</span>
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
        <h2 className={heading}>{t.knowledge}</h2>
        <p className="text-sm text-brand-ink/55">{t.knowledgeDesc}</p>

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
                  {t.remove}
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
              {m === "url" ? t.crawlUrl : m === "upload" ? t.uploadFile : t.pasteText}
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
                placeholder={t.titlePlaceholder}
                className={input}
              />
              <textarea
                value={kContent}
                onChange={(e) => setKContent(e.target.value)}
                rows={4}
                placeholder={t.contentPlaceholder}
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
              {t.addToList}
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
            ? t.creating
            : sources.length > 0
              ? t.createTenantWith(sources.length)
              : t.createTenant}
        </button>
        <Link
          href="/tenants"
          className="rounded-lg px-4 py-2 text-sm text-brand-ink/60 hover:text-brand-ink"
        >
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
