"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Mode = "url" | "upload" | "paste";
const MAX_FILE_BYTES = 14 * 1024 * 1024; // ~ Fastify 20MB limit ÷ base64 inflate

export function AddKnowledge({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [uri, setUri] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function done() {
    setUri("");
    setTitle("");
    setContent("");
    setFile(null);
    router.refresh(); // sources list re-fetches; status polled by refreshing
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () =>
        resolve(String(r.result).split(",")[1] ?? ""); // strip data: prefix
      r.onerror = () => reject(new Error("could not read file"));
      r.readAsDataURL(f);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "url") {
        await api.addKnowledge({ tenantSlug, kind: "url", uri });
      } else if (mode === "paste") {
        await api.addText({
          tenantSlug,
          title: title || undefined,
          content,
        });
      } else {
        if (!file) throw new Error("choose a file");
        if (file.size > MAX_FILE_BYTES)
          throw new Error("file too large (max ~14MB)");
        const contentBase64 = await fileToBase64(file);
        await api.uploadDoc({ tenantSlug, filename: file.name, contentBase64 });
      }
      done();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setErr(null);
      }}
      className={`rounded-t-lg px-3 py-1.5 text-sm font-medium ${
        mode === m
          ? "bg-white text-brand-deep border border-b-0 border-brand-ink/10"
          : "text-brand-ink/55 hover:text-brand-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex gap-1">
        {tab("url", "Crawl URL")}
        {tab("upload", "Upload file")}
        {tab("paste", "Paste text")}
      </div>
      <form
        onSubmit={submit}
        className="space-y-2 rounded-lg rounded-tl-none border border-brand-ink/10 bg-white p-3"
      >
        {mode === "url" && (
          <input
            required
            placeholder="https://customer-website.com"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            className="w-full rounded border border-brand-ink/15 px-3 py-2 text-sm"
          />
        )}

        {mode === "upload" && (
          <input
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-brand-ink/70 file:mr-3 file:rounded file:border-0 file:bg-brand-blue file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        )}

        {mode === "paste" && (
          <>
            <input
              placeholder="Title (optional) — e.g. Price list"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-brand-ink/15 px-3 py-2 text-sm"
            />
            <textarea
              required
              placeholder="Paste the content (hours, services, FAQ, prices…). Min 20 chars."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded border border-brand-ink/15 px-3 py-2 text-sm"
            />
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Adding…"
              : mode === "url"
                ? "Crawl + ingest"
                : mode === "upload"
                  ? "Upload + ingest"
                  : "Add text"}
          </button>
          {err ? (
            <span className="text-sm text-red-600">{err}</span>
          ) : (
            <span className="text-xs text-brand-ink/45">
              {mode === "url"
                ? "Crawls the site (auto-escalates to a real browser if needed)."
                : mode === "upload"
                  ? "PDF / DOCX / XLSX / TXT / MD / CSV."
                  : "Always works — no crawl, no file."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
