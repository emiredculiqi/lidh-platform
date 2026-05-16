"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function AddKnowledge({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.addKnowledge({ tenantSlug, kind: "url", uri });
      setUri("");
      router.refresh(); // status shows as processing → poll by refreshing
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        required
        placeholder="https://customer-website.com"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        className="flex-1 rounded border border-brand-ink/15 px-3 py-2 text-sm"
      />
      <button
        disabled={busy}
        className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Adding…" : "Crawl + ingest"}
      </button>
      {err ? <span className="self-center text-sm text-red-600">{err}</span> : null}
    </form>
  );
}
