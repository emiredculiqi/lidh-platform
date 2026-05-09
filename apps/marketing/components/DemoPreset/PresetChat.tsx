"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { AssistantMarkdown } from "@/components/Chat/AssistantMarkdown";
import { useLocale, useT } from "@/lib/i18n";

type Role = "user" | "assistant";
type ChatMessage = { id: string; role: Role; content: string };
type Status = "idle" | "streaming" | "error" | "rateLimited";

type Props = {
  slug: string;
  company: string;
  welcome: { al: string; en: string };
};

const SESSION_LIMIT = 30;
const SESSION_RESET_HOURS = 24;

const STRINGS = {
  al: {
    onlineNow: "Online tani",
    placeholder: (c: string) => `Pyet asistentin e ${c}…`,
    error: "Diçka shkoi keq. Provo përsëri.",
    rateLimited:
      "Kemi mbërritur kufirin e kërkesave për sot. Të lutem provo përsëri më vonë.",
    promptsLeft: (n: number) => `${n} pyetje të mbetura`,
    promptsLeftSingular: "1 pyetje e mbetur",
    limitTitle: "Demoja u përfundua 🎉",
    limitBody: (c: string) =>
      `Provove asistentin e ${c} ${SESSION_LIMIT} herë. Nëse ju duket i përshtatshëm, ekipi i Lidh.al është gati ta vendosë në website-in tuaj me konfigurimin tuaj real.`,
    limitCta: "Bisedo me ekipin",
    resetCta: "Rifillo demonë",
  },
  en: {
    onlineNow: "Online now",
    placeholder: (c: string) => `Ask the ${c} assistant…`,
    error: "Something went wrong. Please try again.",
    rateLimited: "Daily request limit reached. Please try again later.",
    promptsLeft: (n: number) => `${n} prompts left`,
    promptsLeftSingular: "1 prompt left",
    limitTitle: "Demo complete 🎉",
    limitBody: (c: string) =>
      `You've tried the ${c} assistant ${SESSION_LIMIT} times. If it feels like a fit, the Lidh.al team is ready to deploy it on your website with your real configuration.`,
    limitCta: "Talk to the team",
    resetCta: "Restart demo",
  },
};

type Usage = { count: number; day: string };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUsage(slug: string): Usage {
  if (typeof window === "undefined") return { count: 0, day: todayKey() };
  try {
    const raw = window.localStorage.getItem(`lidh.demo.${slug}.used`);
    if (!raw) return { count: 0, day: todayKey() };
    const parsed = JSON.parse(raw) as Partial<Usage>;
    const today = todayKey();
    if (parsed.day !== today) return { count: 0, day: today };
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      day: today,
    };
  } catch {
    return { count: 0, day: todayKey() };
  }
}

function writeUsage(slug: string, usage: Usage) {
  try {
    window.localStorage.setItem(
      `lidh.demo.${slug}.used`,
      JSON.stringify(usage),
    );
  } catch {}
}

export function PresetChat({ slug, company, welcome }: Props) {
  const { locale } = useLocale();
  const t = useT(STRINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [usage, setUsage] = useState<Usage>({ count: 0, day: todayKey() });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setUsage(readUsage(slug));
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  const remaining = Math.max(0, SESSION_LIMIT - usage.count);
  const limitReached = remaining === 0;

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return [
      {
        id: "welcome",
        role: "assistant" as const,
        content: welcome[locale],
      },
    ];
  }, [messages, welcome, locale]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming" || limitReached) return;

      const userMsg: ChatMessage = {
        id: cryptoId(),
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: cryptoId(),
        role: "assistant",
        content: "",
      };
      const history = [...messages, userMsg];
      setMessages([...history, assistantMsg]);
      setDraft("");
      setStatus("streaming");

      try {
        const res = await fetch(`/api/demo/preset/${slug}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            locale,
          }),
        });

        if (res.status === 429) {
          setStatus("rateLimited");
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && !last.content) next.pop();
            return next;
          });
          return;
        }
        if (!res.ok || !res.body) throw new Error("chat_failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const parsed = parseSseEvent(raw);
            if (!parsed) continue;

            if (parsed.event === "text") {
              const delta = String(parsed.data?.delta ?? "");
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + delta,
                  };
                }
                return next;
              });
            } else if (parsed.event === "error") {
              throw new Error("chat_failed");
            }
          }
        }

        setStatus("idle");
        const next: Usage = { count: usage.count + 1, day: todayKey() };
        setUsage(next);
        writeUsage(slug, next);
      } catch {
        setStatus("error");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) next.pop();
          return next;
        });
      }
    },
    [status, messages, slug, locale, limitReached, usage.count],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(draft);
  }

  function resetDemo() {
    const fresh: Usage = { count: 0, day: todayKey() };
    setUsage(fresh);
    writeUsage(slug, fresh);
    setMessages([]);
    setStatus("idle");
  }

  const remainingLabel =
    remaining === 1 ? t.promptsLeftSingular : t.promptsLeft(remaining);

  return (
    <div className="card-surface flex flex-col p-0">
      <header className="flex items-center justify-between gap-3 rounded-t-2xl bg-brand-gradient px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold leading-tight">
            {company}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] opacity-80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {t.onlineNow}
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
          {remainingLabel}
        </span>
      </header>

      <div
        ref={scrollRef}
        className="max-h-[520px] min-h-[360px] flex-1 space-y-3 overflow-y-auto bg-brand-fog/40 px-4 py-4"
      >
        {visibleMessages.map((m) => (
          <Bubble
            key={m.id}
            role={m.role}
            content={m.content}
            streaming={
              status === "streaming" &&
              m === visibleMessages[visibleMessages.length - 1] &&
              m.role === "assistant"
            }
          />
        ))}
        {status === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {t.error}
          </div>
        )}
        {status === "rateLimited" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {t.rateLimited}
          </div>
        )}
      </div>

      {limitReached && status !== "streaming" ? (
        <div className="border-t border-brand-deep/10 bg-gradient-to-b from-brand-fog/40 to-white px-5 py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <h4 className="font-display text-base font-bold text-brand-deep">
              {t.limitTitle}
            </h4>
            <p className="max-w-md text-xs text-brand-deep/70">
              {t.limitBody(company)}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Link href="/#contact" className="btn-primary">
                {t.limitCta}
                <Send className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={resetDemo}
                className="btn-secondary"
              >
                {t.resetCta}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-brand-deep/10 bg-white px-3 pb-3 pt-2">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-xl border border-brand-deep/15 bg-white px-2 py-1.5 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={t.placeholder(company)}
              disabled={status === "streaming"}
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base text-brand-deep outline-none placeholder:text-brand-deep/40 disabled:opacity-60 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!draft.trim() || status === "streaming"}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-gradient text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: Role;
  content: string;
  streaming: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "whitespace-pre-wrap rounded-br-sm bg-brand-blue text-white"
            : "rounded-bl-sm bg-white text-brand-deep"
        }`}
      >
        {isUser ? (
          content || (streaming ? "…" : "")
        ) : content ? (
          <AssistantMarkdown content={content} />
        ) : streaming ? (
          "…"
        ) : (
          ""
        )}
      </motion.div>
    </div>
  );
}

function parseSseEvent(raw: string): { event: string; data: any } | null {
  let event = "message";
  let dataRaw = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataRaw += line.slice(6);
  }
  if (!dataRaw) return null;
  try {
    return { event, data: JSON.parse(dataRaw) };
  } catch {
    return null;
  }
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
