"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

/** Edit the chat widget's allowed origins for a tenant. One URL per line;
 *  empty = open to any site. */
export function WidgetOriginsEditor({
  slug,
  initial,
}: {
  slug: string;
  initial: string[];
}) {
  const [value, setValue] = useState(initial.join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useT({
    al: {
      help: "Një adresë për rresht (p.sh. https://faqja-ime.al). Bosh = lejohet çdo faqe. Faqet e Lidh.al lejohen gjithmonë.",
      save: "Ruaj origjinat",
      saving: "Duke ruajtur…",
      saved: "U ruajt ✓",
      placeholder: "https://faqja-ime.al",
    },
    en: {
      help: "One URL per line (e.g. https://mysite.com). Empty = any site allowed. Lidh.al pages are always allowed.",
      save: "Save origins",
      saving: "Saving…",
      saved: "Saved ✓",
      placeholder: "https://mysite.com",
    },
  });

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const origins = value
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.setWebOrigins(slug, origins);
      setValue(res.allowedOrigins.join("\n"));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder={t.placeholder}
        className="w-full rounded-xl border border-brand-ink/15 bg-white p-3 font-mono text-xs text-brand-ink/80 outline-none focus:border-brand-blue"
      />
      <p className="text-xs text-brand-ink/50">{t.help}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
        {saved ? <span className="text-sm text-green-600">{t.saved}</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
