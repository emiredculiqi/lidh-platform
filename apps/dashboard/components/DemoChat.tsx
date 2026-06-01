"use client";

import { useRef, useState } from "react";
import { apiBase } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Markdown } from "./Markdown";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * Public, branded demo chat (the prospect-facing experience). Same SSE
 * contract as the dashboard Test chat, standalone styling, no admin chrome.
 */
export function DemoChat({
  tenantSlug,
  businessName,
}: {
  tenantSlug: string;
  businessName: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(
    `demo-${Math.random().toString(36).slice(2)}`,
  );

  const t = useT({
    al: {
      poweredBy: "Mundësuar nga Lidh.al",
      askAnything: (business: string) =>
        `Pyetni çfarëdo për ${business} — orare, shërbime, çmime…`,
      messagePlaceholder: "Shkruani një mesazh…",
      send: "Dërgo",
    },
    en: {
      poweredBy: "Powered by Lidh.al",
      askAnything: (business: string) =>
        `Ask anything about ${business} — hours, services, prices…`,
      messagePlaceholder: "Write a message…",
      send: "Send",
    },
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    let assistant = "";
    setMsgs((m) => [...m, { role: "assistant", text: "" }]);

    const bump = () =>
      setMsgs((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", text: assistant };
        return c;
      });

    try {
      const res = await fetch(`${apiBase}/v1/chat/web`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          message,
          sessionRef: sessionRef.current,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ev = /event: (.+)/.exec(p)?.[1];
          const d = /data: (.+)/.exec(p)?.[1];
          if (!ev || !d) continue;
          const data = JSON.parse(d);
          if (ev === "text") {
            assistant += data.delta;
            bump();
          } else if (ev === "error") {
            assistant += `\n[error: ${data.message}]`;
            bump();
          }
        }
      }
    } catch (err) {
      assistant += `\n[failed: ${err instanceof Error ? err.message : "error"}]`;
      bump();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-ink/10 bg-white shadow-glow">
      <div className="bg-brand-gradient px-5 py-4 text-white">
        <p className="text-sm opacity-80">{t.poweredBy}</p>
        <p className="font-display text-lg font-semibold">{businessName}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {msgs.length === 0 ? (
          <p className="text-sm text-brand-ink/45">{t.askAnything(businessName)}</p>
        ) : null}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "whitespace-pre-wrap bg-brand-blue text-white"
                  : "border border-brand-ink/10 bg-brand-fog text-brand-ink"
              }`}
            >
              {m.role === "assistant" ? (
                m.text ? (
                  <Markdown content={m.text} />
                ) : (
                  busy && "…"
                )
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={send}
        className="flex gap-2 border-t border-brand-ink/10 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.messagePlaceholder}
          className="flex-1 rounded-lg border border-brand-ink/15 px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : t.send}
        </button>
      </form>
    </div>
  );
}
