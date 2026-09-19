"use client";

import { useRef, useState } from "react";
import { apiBase } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Markdown } from "./Markdown";
import { useAuth } from "@clerk/nextjs";

type Msg = { role: "user" | "assistant"; text: string };

// Preview/test chat. Streams from POST /v1/chat/preview (SSE) — EventSource
// only does GET, so we fetch + manually parse the event/data stream. The route
// is Clerk-guarded and creates kind=preview conversations: no intake gate,
// never in the inbox, never counted in usage (ADR-021).
export function TestChat({ tenantSlug }: { tenantSlug: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(`dash-test-${Math.random().toString(36).slice(2)}`);
  // The preview route is Clerk-guarded (not @Public): preview conversations
  // skip the intake gate and never reach the business's inbox or usage.
  const { getToken } = useAuth();

  const t = useT({
    al: {
      empty:
        "Testo agjentin si do ta bënte një vizitor. Provo të pyesësh për oraret, shërbimet ose çmimet.",
      placeholder: "Shkruaj një mesazh…",
      send: "Dërgo",
    },
    en: {
      empty:
        "Test the agent as a visitor would. Try asking about the business's hours, services, or pricing.",
      placeholder: "Type a message…",
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

    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/v1/chat/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tenantSlug,
          message,
          sessionRef: sessionRef.current,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const ev = /event: (.+)/.exec(evt)?.[1];
          const dataM = /data: (.+)/.exec(evt)?.[1];
          if (!ev || !dataM) continue;
          const data = JSON.parse(dataM);
          if (ev === "text") {
            assistant += data.delta;
            setMsgs((m) => {
              const c = [...m];
              c[c.length - 1] = { role: "assistant", text: assistant };
              return c;
            });
          } else if (ev === "effect") {
            assistant += `\n\n— ${data.type} —`;
            setMsgs((m) => {
              const c = [...m];
              c[c.length - 1] = { role: "assistant", text: assistant };
              return c;
            });
          } else if (ev === "error") {
            assistant += `\n[error: ${data.message}]`;
            setMsgs((m) => {
              const c = [...m];
              c[c.length - 1] = { role: "assistant", text: assistant };
              return c;
            });
          }
        }
      }
    } catch (err) {
      setMsgs((m) => {
        const c = [...m];
        c[c.length - 1] = {
          role: "assistant",
          text: `[failed: ${err instanceof Error ? err.message : "error"}]`,
        };
        return c;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl border border-brand-ink/10 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 ? (
          <p className="text-sm text-brand-ink/45">{t.empty}</p>
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
          placeholder={t.placeholder}
          className="flex-1 rounded border border-brand-ink/15 px-3 py-2 text-sm"
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
