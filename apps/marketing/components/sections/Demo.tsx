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
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Send,
  Sparkles,
} from "lucide-react";
import { Container } from "../ui/Container";
import { Reveal } from "../animations/Reveal";
import { AssistantMarkdown } from "../Chat/AssistantMarkdown";
import { siteContent } from "@/content/site";
import { useLocale, useT } from "@/lib/i18n";

type Stage =
  | "form"
  | "preparing"
  | "chat"
  | "alreadyUsed"
  | "manualPrep";

const USED_STORAGE_KEY = "lidh.demo.used";
type Status = "idle" | "streaming" | "error";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type FormFields = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  websiteUrl: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const MAX_PROMPTS = 3;

export function Demo() {
  const t = useT(siteContent);
  const { locale } = useLocale();

  const [stage, setStage] = useState<Stage>("form");
  const [demoId, setDemoId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatStatus, setChatStatus] = useState<Status>("idle");
  const [promptsUsed, setPromptsUsed] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(USED_STORAGE_KEY)) {
        setStage("alreadyUsed");
      }
    } catch {}
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatStatus]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft, stage]);

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    const welcomeText = t.demo.welcome.replace(
      "{company}",
      companyName || t.demo.fields.company.toLowerCase(),
    );
    return [
      {
        id: "welcome",
        role: "assistant" as const,
        content: welcomeText,
      },
    ];
  }, [messages, t.demo.welcome, t.demo.fields.company, companyName]);

  function validate(data: FormFields): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.firstName.trim()) errs.firstName = t.demo.errors.required;
    if (!data.lastName.trim()) errs.lastName = t.demo.errors.required;
    if (!data.company.trim()) errs.company = t.demo.errors.required;
    if (!data.email.trim()) errs.email = t.demo.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
      errs.email = t.demo.errors.emailInvalid;
    if (!data.phone.trim()) errs.phone = t.demo.errors.required;
    if (!data.websiteUrl.trim()) errs.websiteUrl = t.demo.errors.required;
    else if (!isLikelyUrl(data.websiteUrl.trim()))
      errs.websiteUrl = t.demo.errors.urlInvalid;
    return errs;
  }

  function isLikelyUrl(input: string): boolean {
    const raw = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      const host = u.hostname.toLowerCase();
      if (!host.includes(".")) return false;
      if (host === "localhost" || host.endsWith(".local")) return false;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
      return true;
    } catch {
      return false;
    }
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const data: FormFields = {
      firstName: String(fd.get("firstName") ?? "").trim(),
      lastName: String(fd.get("lastName") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      websiteUrl: String(fd.get("websiteUrl") ?? "").trim(),
    };

    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      const el = form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      el?.focus();
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);
    setStage("preparing");

    try {
      const res = await fetch("/api/demo/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locale }),
      });

      if (res.status === 409) {
        try {
          window.localStorage.setItem(
            USED_STORAGE_KEY,
            JSON.stringify({ at: Date.now() }),
          );
        } catch {}
        setStage("alreadyUsed");
        return;
      }
      if (res.status === 429) {
        setSubmitError(t.demo.errors.rateLimited);
        setStage("form");
        return;
      }
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (body?.error === "invalid_url") {
          setFieldErrors({ websiteUrl: t.demo.errors.urlInvalid });
          setStage("form");
          return;
        }
      }
      if (!res.ok) {
        try {
          window.localStorage.setItem(
            USED_STORAGE_KEY,
            JSON.stringify({ at: Date.now(), email: data.email }),
          );
        } catch {}
        setStage("manualPrep");
        return;
      }

      const body = (await res.json()) as {
        demoId: string;
        status: "ready" | "manual";
      };
      try {
        window.localStorage.setItem(
          USED_STORAGE_KEY,
          JSON.stringify({ at: Date.now(), email: data.email }),
        );
      } catch {}

      if (body.status === "manual") {
        setStage("manualPrep");
        return;
      }

      setDemoId(body.demoId);
      setCompanyName(data.company);
      setMessages([]);
      setPromptsUsed(0);
      setStage("chat");
    } catch {
      setStage("manualPrep");
    } finally {
      setSubmitting(false);
    }
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatStatus === "streaming" || !demoId) return;
      if (promptsUsed >= MAX_PROMPTS) return;

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
      setChatStatus("streaming");

      try {
        const res = await fetch("/api/demo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demoId,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            locale,
          }),
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
            } else if (parsed.event === "usage") {
              const used = Number(parsed.data?.promptsUsed ?? 0);
              setPromptsUsed(used);
            } else if (parsed.event === "error") {
              throw new Error("chat_failed");
            }
          }
        }

        setChatStatus("idle");
      } catch {
        setChatStatus("error");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) next.pop();
          return next;
        });
      }
    },
    [chatStatus, demoId, locale, messages, promptsUsed],
  );

  const remaining = Math.max(0, MAX_PROMPTS - promptsUsed);

  return (
    <section id="demo" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-fog/40 to-transparent" />
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-brand-blue">
            {t.demo.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
            {t.demo.title}
          </h2>
          <p className="mt-4 text-brand-deep/70">{t.demo.subtitle}</p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-orange/10 px-3 py-1 text-xs font-semibold text-accent-orange">
            {t.demo.intro}
          </p>
        </Reveal>

        <div className="mx-auto mt-12 max-w-2xl">
          {stage === "form" && (
            <Reveal>
              <form
                onSubmit={handleRegister}
                className="card-surface grid gap-4"
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="firstName"
                    label={t.demo.fields.firstName}
                    error={fieldErrors.firstName}
                  />
                  <Field
                    name="lastName"
                    label={t.demo.fields.lastName}
                    error={fieldErrors.lastName}
                  />
                </div>
                <Field
                  name="company"
                  label={t.demo.fields.company}
                  error={fieldErrors.company}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="email"
                    type="email"
                    label={t.demo.fields.email}
                    error={fieldErrors.email}
                  />
                  <Field
                    name="phone"
                    type="tel"
                    label={t.demo.fields.phone}
                    error={fieldErrors.phone}
                  />
                </div>
                <Field
                  name="websiteUrl"
                  label={t.demo.fields.websiteUrl}
                  placeholder={t.demo.fields.websiteUrlPlaceholder}
                  icon={Globe}
                  error={fieldErrors.websiteUrl}
                />

                {Object.keys(fieldErrors).length > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    {t.demo.errors.summary}
                  </p>
                )}
                {submitError && (
                  <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {t.demo.submit}
                  <Sparkles className="h-4 w-4" />
                </button>
                <p className="text-xs text-brand-deep/50">{t.demo.consent}</p>
              </form>
            </Reveal>
          )}

          {stage === "preparing" && (
            <div className="card-surface flex flex-col items-center gap-4 py-16 text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-brand-blue/30 border-t-brand-blue"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                />
                <Globe className="h-6 w-6" />
              </span>
              <h3 className="font-display text-xl font-bold text-brand-deep">
                {t.demo.preparing}
              </h3>
              <p className="max-w-sm text-sm text-brand-deep/60">
                {t.demo.preparingHint}
              </p>
            </div>
          )}

          {stage === "chat" && (
            <div className="card-surface flex flex-col gap-3 p-0">
              <header className="flex items-center justify-between gap-3 rounded-t-2xl bg-brand-gradient px-4 py-3 text-white">
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold leading-tight">
                    {t.demo.chatTitle}
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] opacity-80">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {t.demo.chatSubtitle}
                  </p>
                </div>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                  {remaining === 1
                    ? t.demo.promptsLeftSingular
                    : t.demo.promptsLeft.replace("{n}", String(remaining))}
                </span>
              </header>

              <div
                ref={scrollRef}
                className="max-h-[420px] min-h-[280px] flex-1 space-y-3 overflow-y-auto bg-brand-fog/40 px-4 py-4"
              >
                {visibleMessages.map((m) => (
                  <Bubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    streaming={
                      chatStatus === "streaming" &&
                      m === visibleMessages[visibleMessages.length - 1] &&
                      m.role === "assistant"
                    }
                  />
                ))}
                {chatStatus === "error" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {t.demo.errors.generic}
                  </div>
                )}
              </div>

              {remaining === 0 && chatStatus !== "streaming" ? (
                <div className="border-t border-brand-deep/10 bg-gradient-to-b from-brand-fog/40 to-white px-5 py-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <h4 className="font-display text-base font-bold text-brand-deep">
                      {t.demo.limitReachedTitle}
                    </h4>
                    <p className="max-w-md text-xs text-brand-deep/70">
                      {t.demo.limitReachedBody}
                    </p>
                    <ul className="mt-1 grid w-full max-w-sm gap-1.5 text-left">
                      {t.demo.limitReachedFeatures.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-xs text-brand-deep/80"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-blue" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <a href="#contact" className="btn-primary mt-2">
                      {t.demo.limitReachedCta}
                      <Send className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border-t border-brand-deep/10 bg-white px-3 pb-3 pt-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send(draft);
                    }}
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
                      placeholder={t.demo.placeholder}
                      disabled={chatStatus === "streaming"}
                      className="max-h-32 min-h-[2.5rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base text-brand-deep outline-none placeholder:text-brand-deep/40 disabled:opacity-60 sm:text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || chatStatus === "streaming"}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-gradient text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t.demo.send}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {stage === "alreadyUsed" && (
            <div className="card-surface flex flex-col items-center gap-5 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h3 className="font-display text-2xl font-bold text-brand-deep">
                {t.demo.alreadyUsedTitle}
              </h3>
              <p className="max-w-md text-sm text-brand-deep/70">
                {t.demo.alreadyUsedBody}
              </p>
              <a href="#contact" className="btn-primary">
                {t.demo.limitReachedCta}
                <Send className="h-4 w-4" />
              </a>
            </div>
          )}

          {stage === "manualPrep" && (
            <div className="card-surface flex flex-col items-center gap-5 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                <Sparkles className="h-7 w-7" />
              </span>
              <h3 className="font-display text-2xl font-bold text-brand-deep">
                {t.demo.manualPrep.title}
              </h3>
              <p className="max-w-md text-sm text-brand-deep/70">
                {t.demo.manualPrep.body}
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  icon: Icon,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: typeof Globe;
  error?: string;
}) {
  const base =
    "mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-brand-deep outline-none transition placeholder:text-brand-deep/40 focus:ring-2";
  const stateClasses = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
    : "border-brand-deep/15 focus:border-brand-blue focus:ring-brand-blue/20";

  return (
    <label className="block text-sm font-medium text-brand-deep">
      {label}
      <span className="ml-0.5 text-accent-orange">*</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          required
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={`${base} ${stateClasses} ${Icon ? "pl-10" : ""}`}
        />
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-deep/40" />
        )}
      </div>
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
}) {
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
        {isUser
          ? content || (streaming ? "…" : "")
          : content
            ? <AssistantMarkdown content={content} />
            : streaming
              ? "…"
              : ""}
      </div>
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
