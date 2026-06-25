"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Markdown } from "./Markdown";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * Public, branded funnel chat — the customer-facing front door rendered on the
 * permanent /b/<slug> page (ADR-014). Same SSE contract as the dashboard Test
 * chat, standalone styling, no admin chrome.
 *
 * Also opens a receive-stream (/v1/live/widget) once a conversation exists, so
 * replies a human agent sends during a takeover appear here live.
 */
export function FunnelChat({
  tenantSlug,
  businessName,
}: {
  tenantSlug: string;
  businessName: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef(`funnel-${Math.random().toString(36).slice(2)}`);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const convIdRef = useRef<string | null>(null);
  const agentStreamRef = useRef(false);
  const closedRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Stop the receive-stream when the chat unmounts (graceful cancel, no
  // AbortError surfacing in the dev overlay).
  useEffect(
    () => () => {
      closedRef.current = true;
      readerRef.current?.cancel().catch(() => {});
    },
    [],
  );

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  const t = useT({
    al: {
      poweredBy: "Mundësuar nga Lidh.al",
      askAnything: (business: string) =>
        `Pyetni çfarëdo për ${business} — orare, shërbime, çmime…`,
      messagePlaceholder: "Shkruani një mesazh…",
      send: "Dërgo",
      connecting: "Po ju lidhim me një person…",
      failed: "Diçka shkoi keq. Provoni përsëri.",
    },
    en: {
      poweredBy: "Powered by Lidh.al",
      askAnything: (business: string) =>
        `Ask anything about ${business} — hours, services, prices…`,
      messagePlaceholder: "Write a message…",
      send: "Send",
      connecting: "Connecting you to a person…",
      failed: "Something went wrong. Please try again.",
    },
  });

  // Listen for human/agent messages pushed during a takeover.
  async function openAgentStream(convId: string) {
    if (agentStreamRef.current) return;
    agentStreamRef.current = true;
    while (!closedRef.current) {
      try {
        const res = await fetch(
          `${apiBase}/v1/live/widget?conversationId=${encodeURIComponent(convId)}`,
        );
        if (closedRef.current) return;
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        readerRef.current = reader;
        const dec = new TextDecoder();
        let buf = "";
        while (!closedRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            const ev = /event: (.+)/.exec(p)?.[1];
            const d = /data: (.+)/.exec(p)?.[1];
            if (ev !== "agent" || !d) continue;
            try {
              const data = JSON.parse(d);
              if (data.type === "agent_message" && data.text) {
                setMsgs((m) => [...m, { role: "assistant", text: data.text }]);
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* network drop */
      }
      if (closedRef.current) return;
      await new Promise((r) => setTimeout(r, 5000)); // reconnect
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submitMessage();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage();
    }
  }

  async function submitMessage() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    let assistant = "";
    let sawEffect = false;
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
          conversationId: convIdRef.current ?? undefined,
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
          if (ev === "meta" && data.conversationId) {
            convIdRef.current = data.conversationId;
            void openAgentStream(data.conversationId);
          } else if (ev === "text") {
            assistant += data.delta;
            bump();
          } else if (ev === "effect") {
            sawEffect = true;
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
      // No assistant text? Either the AI is paused (human will reply via the
      // receive-stream) or a genuine empty reply. Replace the placeholder.
      if (!assistant) {
        setMsgs((m) => {
          const c = [...m];
          if (c[c.length - 1]?.role === "assistant" && !c[c.length - 1].text) {
            // Handoff → "connecting you to a person"; the human's reply then
            // arrives below via the receive-stream. Otherwise a soft error.
            c[c.length - 1] = {
              role: "assistant",
              text: sawEffect ? t.connecting : t.failed,
            };
          }
          return c;
        });
      }
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
        className="flex items-end gap-2 border-t border-brand-ink/10 p-3"
      >
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t.messagePlaceholder}
          className="flex-1 resize-none rounded-lg border border-brand-ink/15 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
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
