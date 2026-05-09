"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send, CheckCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { siteContent } from "@/content/site";
import { useLocale, useT } from "@/lib/i18n";
import { AssistantMarkdown } from "./AssistantMarkdown";

type Role = "user" | "assistant";
type ChatMessage = { id: string; role: Role; content: string };
type Status = "idle" | "streaming" | "error";

const STORAGE_KEY = "lidh.chat.history";
const TEASER_DISMISSED_KEY = "lidh.chat.teaserDismissed";
const TEASER_DELAY_MS = 2500;

export function ChatWidget() {
  const pathname = usePathname();
  const t = useT(siteContent);
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [banner, setBanner] = useState<"lead" | "handoff" | null>(null);
  const [showTeaser, setShowTeaser] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-30));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-30)),
      );
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, status]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      panelRef.current?.style.setProperty("--vv-h", `${vv.height}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, [open]);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(TEASER_DISMISSED_KEY) === "1";
    } catch {}
    if (dismissed) return;
    const timer = window.setTimeout(() => setShowTeaser(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (open && showTeaser) setShowTeaser(false);
  }, [open, showTeaser]);

  function dismissTeaser() {
    setShowTeaser(false);
    try {
      window.sessionStorage.setItem(TEASER_DISMISSED_KEY, "1");
    } catch {}
  }

  if (pathname?.startsWith("/d/")) return null;

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return [
      {
        id: "welcome",
        role: "assistant" as const,
        content: t.chat.welcome,
      },
    ];
  }, [messages, t.chat.welcome]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;

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
      setBanner(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            locale,
          }),
          signal: controller.signal,
        });

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
            } else if (parsed.event === "effect") {
              if (parsed.data?.type === "lead_captured") setBanner("lead");
              else if (parsed.data?.type === "human_handoff")
                setBanner("handoff");
            } else if (parsed.event === "error") {
              throw new Error("chat_failed");
            }
          }
        }

        setStatus("idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        setStatus("error");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) {
            next.pop();
          }
          return next;
        });
      } finally {
        abortRef.current = null;
      }
    },
    [messages, locale, status],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ height: "var(--vv-h, 100dvh)" }}
            className="fixed inset-x-0 top-0 z-50 flex w-full flex-col overflow-hidden bg-white sm:inset-x-auto sm:top-auto sm:bottom-28 sm:right-6 sm:!h-[min(640px,calc(100dvh-7rem))] sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:border-brand-deep/10 sm:shadow-2xl"
            role="dialog"
            aria-label={t.chat.title}
          >
            <header className="flex items-center justify-between gap-3 bg-brand-gradient px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold leading-tight">
                  {t.chat.title}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] opacity-80">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {t.chat.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-brand-fog/40 px-4 py-4"
            >
              {visibleMessages.map((m) => (
                <Bubble key={m.id} role={m.role} content={m.content} />
              ))}
              {status === "streaming" &&
                visibleMessages[visibleMessages.length - 1]?.role ===
                  "assistant" &&
                !visibleMessages[visibleMessages.length - 1]?.content && (
                  <Typing />
                )}
              {banner && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    {banner === "lead"
                      ? t.chat.leadCaptured
                      : t.chat.humanHandoff}
                  </span>
                </div>
              )}
              {status === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {t.chat.error}
                </div>
              )}
            </div>

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
                  maxLength={4000}
                  placeholder={t.chat.placeholder}
                  className="max-h-40 min-h-[3rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base text-brand-deep outline-none placeholder:text-brand-deep/40 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || status === "streaming"}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-gradient text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t.chat.send}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-brand-deep/40">
                {t.chat.poweredBy}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTeaser && !open && (
          <Teaser
            text={t.chat.teaser}
            onClick={() => {
              dismissTeaser();
              setOpen(true);
            }}
            onDismiss={dismissTeaser}
          />
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          dismissTeaser();
          setOpen((v) => !v);
        }}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        aria-label={open ? "Close chat" : t.chat.bubbleLabel}
        aria-expanded={open}
      >
        {showTeaser && !open && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand-blue/40"
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </>
  );
}

function Teaser({
  text,
  onClick,
  onDismiss,
}: {
  text: string;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed bottom-7 right-20 z-50 flex max-w-[14rem] items-start gap-2 rounded-2xl rounded-br-sm bg-white px-3 py-2 shadow-2xl ring-1 ring-brand-deep/10 sm:bottom-9 sm:right-24"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <p className="pr-1 text-xs font-medium leading-snug text-brand-deep min-h-[1.25rem]">
        {shown}
        {shown.length < text.length && (
          <motion.span
            className="ml-0.5 inline-block h-3 w-px bg-brand-deep/60 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
          />
        )}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="-mr-1 -mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-brand-deep/40 transition hover:bg-brand-deep/5 hover:text-brand-deep"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

function Bubble({ role, content }: { role: Role; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "whitespace-pre-wrap rounded-br-sm bg-brand-blue text-white"
            : "rounded-bl-sm bg-white text-brand-deep"
        }`}
      >
        {isUser ? content || "…" : content ? <AssistantMarkdown content={content} /> : "…"}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm">
        <span className="inline-flex items-center gap-1">
          <Dot delay={0} />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="block h-1.5 w-1.5 rounded-full bg-brand-deep/40"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 0.8, repeat: Infinity, delay, ease: "easeInOut" }}
    />
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
