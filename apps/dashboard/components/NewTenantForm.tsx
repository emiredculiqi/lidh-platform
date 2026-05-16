"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Minimal create-tenant wizard. One persona (al) to start; more languages
// are added later via the agent page (post-M2.4).
export function NewTenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ demoUrl: string | null } | null>(
    null,
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [businessFacts, setFacts] = useState("");
  const [persona, setPersona] = useState("");
  const [isDemo, setIsDemo] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const t = await api.createTenant({
        name,
        slug,
        defaultLocale: "al",
        businessFacts: businessFacts || undefined,
        isDemo,
        personas: [{ locale: "al", content: persona }],
      });
      setCreated({ demoUrl: t.demoUrl });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90"
      >
        + New tenant
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-ink/10 bg-white p-5">
      {created ? (
        <div className="space-y-3">
          <p className="font-medium text-brand-deep">Tenant created ✓</p>
          {created.demoUrl ? (
            <div>
              <p className="text-sm text-brand-ink/70">Demo link:</p>
              <code className="mt-1 block break-all rounded bg-brand-fog px-3 py-2 text-sm">
                {created.demoUrl}
              </code>
            </div>
          ) : null}
          <button
            onClick={() => {
              setCreated(null);
              setOpen(false);
            }}
            className="text-sm text-brand-blue underline"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Business name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-brand-ink/15 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="slug (lowercase-hyphen)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded border border-brand-ink/15 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Business facts (hours, contact, policies) — injected into every prompt"
            value={businessFacts}
            onChange={(e) => setFacts(e.target.value)}
            rows={2}
            className="w-full rounded border border-brand-ink/15 px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="Agent persona (Albanian) — tone, what it helps with, rules"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={4}
            className="w-full rounded border border-brand-ink/15 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-brand-ink/80">
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(e) => setIsDemo(e.target.checked)}
            />
            Create as a demo (generates an expiring link)
          </label>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create tenant"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-brand-ink/60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
