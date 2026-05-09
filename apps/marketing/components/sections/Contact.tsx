"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Instagram,
  Linkedin,
} from "lucide-react";
import { Container } from "../ui/Container";
import { Reveal } from "../animations/Reveal";
import { siteContent } from "@/content/site";
import { useT } from "@/lib/i18n";

type Status = "idle" | "submitting" | "success" | "error";
type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "message", string>
>;

export function Contact() {
  const t = useT(siteContent);
  const [status, setStatus] = useState<Status>("idle");
  const [minTime, setMinTime] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setMinTime(minDateTime());
  }, []);

  function validate(data: Record<string, string>): FieldErrors {
    const errs: FieldErrors = {};
    const name = (data.name || "").trim();
    const email = (data.email || "").trim();
    const phone = (data.phone || "").trim();
    const message = (data.message || "").trim();

    if (!name) errs.name = t.contact.errors.required;
    else if (name.length < 2) errs.name = t.contact.errors.nameMin;

    if (!email) errs.email = t.contact.errors.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = t.contact.errors.emailInvalid;

    if (!phone) errs.phone = t.contact.errors.required;

    if (!message) errs.message = t.contact.errors.required;

    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const data = Object.fromEntries(
      new FormData(form).entries(),
    ) as Record<string, string>;

    const errs = validate(data);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setStatus("idle");
      const firstKey = Object.keys(errs)[0];
      const el = form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
      el?.focus();
      return;
    }

    setFieldErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  function clearFieldError(name: string) {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name as keyof FieldErrors];
      return next;
    });
  }

  return (
    <section id="contact" className="relative py-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-brand-blue/5" />
      <Container className="grid gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-blue">
            {t.contact.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-deep sm:text-4xl">
            {t.contact.title}
          </h2>
          <p className="mt-4 max-w-md text-brand-deep/70">
            {t.contact.subtitle}
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <ContactItem
              icon={Mail}
              label="Email"
              value="info@lidh.al"
              href="mailto:info@lidh.al"
            />
            <ContactItem
              icon={Phone}
              label="Phone"
              value="+355 69 520 1250"
              href="tel:+355695201250"
            />
            <ContactItem
              icon={Linkedin}
              label="LinkedIn"
              value="lidh-al"
              href="https://www.linkedin.com/company/lidh-al/"
              external
            />
            <ContactItem
              icon={Instagram}
              label="Instagram"
              value="@lidh.al"
              href="https://instagram.com/lidh.al"
              external
            />
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          {status === "success" ? (
            <div className="card-surface flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h3 className="font-display text-2xl font-bold text-brand-deep">
                {t.contact.success}
              </h3>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="btn-secondary mt-2"
              >
                {t.contact.submit}
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="card-surface grid gap-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="name"
                  label={t.contact.fields.name}
                  required
                  maxLength={120}
                  error={fieldErrors.name}
                  onClearError={clearFieldError}
                />
                <Field
                  name="email"
                  type="email"
                  label={t.contact.fields.email}
                  required
                  error={fieldErrors.email}
                  onClearError={clearFieldError}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="phone"
                  type="tel"
                  label={t.contact.fields.phone}
                  required
                  error={fieldErrors.phone}
                  onClearError={clearFieldError}
                />
                <Field name="business" label={t.contact.fields.business} />
              </div>
              <Field
                name="preferredTime"
                type="datetime-local"
                label={t.contact.fields.preferredTime}
                min={minTime}
                step={60}
              />
              <Field
                name="message"
                label={t.contact.fields.message}
                required
                textarea
                maxLength={4000}
                error={fieldErrors.message}
                onClearError={clearFieldError}
              />

              {Object.keys(fieldErrors).length > 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  {t.contact.errors.summary}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {status === "submitting" ? t.contact.sending : t.contact.submit}
                <Send className="h-4 w-4" />
              </button>

              {status === "error" && (
                <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {t.contact.error}
                </p>
              )}

              <p className="text-xs text-brand-deep/50">{t.contact.consent}</p>
            </form>
          )}
        </Reveal>
      </Container>
    </section>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        className="group flex items-center gap-3 rounded-xl text-brand-deep transition hover:text-brand-blue"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-deep/5 text-brand-deep transition group-hover:bg-brand-gradient group-hover:text-white">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-deep/50">
            {label}
          </span>
          <span className="font-medium">{value}</span>
        </span>
      </a>
    </li>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  textarea = false,
  min,
  step,
  minLength,
  maxLength,
  error,
  onClearError,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  min?: string;
  step?: number | string;
  minLength?: number;
  maxLength?: number;
  error?: string;
  onClearError?: (name: string) => void;
}) {
  const base =
    "mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-brand-deep outline-none transition placeholder:text-brand-deep/40 focus:ring-2";
  const stateClasses = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
    : "border-brand-deep/15 focus:border-brand-blue focus:ring-brand-blue/20";
  const errorId = error ? `${name}-error` : undefined;
  const handleInput = onClearError ? () => onClearError(name) : undefined;

  return (
    <label className="block text-sm font-medium text-brand-deep">
      {label}
      {required && <span className="ml-0.5 text-accent-orange">*</span>}
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={4}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onInput={handleInput}
          className={`${base} ${stateClasses}`}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          min={min}
          step={step}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onInput={handleInput}
          className={`${base} ${stateClasses}`}
        />
      )}
      {error && (
        <span
          id={errorId}
          className="mt-1 block text-xs font-medium text-red-600"
        >
          {error}
        </span>
      )}
    </label>
  );
}

function minDateTime(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}
