import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { sendRawEmail } from "@/lib/mailer";
import type { DemoSession } from "./store";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SUMMARY_MODEL = "claude-sonnet-4-6";

type Locale = "al" | "en";

type Copy = {
  subject: (company: string) => string;
  greeting: (name: string) => string;
  intro: (company: string) => string;
  summaryHeader: string;
  fallbackSummary: string;
  featuresHeader: string;
  features: string[];
  cta: string;
  ctaUrl: string;
  transcriptHeader: string;
  visitorLabel: string;
  assistantLabel: string;
  closing: string;
  signature: string;
  langName: string;
};

const COPY: Record<Locale, Copy> = {
  al: {
    subject: (c) => `Përmbledhja e demos suaj me Lidh.al — ${c}`,
    greeting: (n) => `Përshëndetje ${n},`,
    intro: (c) =>
      `Faleminderit që e provove demon e Lidh.al për ${c}. Ja një përmbledhje e shkurtër e bisedës që pate me asistentin.`,
    summaryHeader: "Përmbledhje",
    fallbackSummary:
      "Vizitori shqyrtoi kapacitetet e asistentit për biznesin e tij dhe shkëmbeu disa pyetje me të.",
    featuresHeader: "Çfarë merr me versionin e plotë",
    features: [
      "Pyetje pa kufi nga klientët, 24 orë në ditë",
      "Lexon dokumentet, FAQ-të dhe materialet e brendshme të biznesit",
      "Integrohet me website-in dhe WhatsApp",
      "Kap çdo mundësi automatikisht dhe e dërgon te ekipi yt",
    ],
    cta: "Cakto një takim",
    ctaUrl: "https://lidh.al/#contact",
    transcriptHeader: "Bisedimi i plotë",
    visitorLabel: "Ti",
    assistantLabel: "Asistenti",
    closing: "Presim të flasim së shpejti!",
    signature: "Ekipi i Lidh.al",
    langName: "Albanian",
  },
  en: {
    subject: (c) => `Your Lidh.al demo summary — ${c}`,
    greeting: (n) => `Hi ${n},`,
    intro: (c) =>
      `Thanks for trying the Lidh.al demo for ${c}. Here's a quick summary of the conversation you had with the assistant.`,
    summaryHeader: "Summary",
    fallbackSummary:
      "The visitor explored what the demo assistant could do for their business and exchanged a few questions with it.",
    featuresHeader: "What you get with the full version",
    features: [
      "Unlimited customer questions, 24/7",
      "Reads your business documents, FAQs and internal materials",
      "Integrates with your website and WhatsApp",
      "Captures every lead automatically and sends them to your team",
    ],
    cta: "Book a meeting",
    ctaUrl: "https://lidh.al/#contact",
    transcriptHeader: "Full conversation",
    visitorLabel: "You",
    assistantLabel: "Assistant",
    closing: "We look forward to talking soon!",
    signature: "The Lidh.al team",
    langName: "English",
  },
};

async function generateSummary(
  session: DemoSession,
  copy: Copy,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return copy.fallbackSummary;
  if (session.messages.length === 0) return copy.fallbackSummary;

  const transcript = session.messages
    .map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`)
    .join("\n");

  try {
    const res = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: `Below is a chat between a website visitor and a demo assistant for the business "${session.lead.company}". Write a brief 1–2 sentence summary in ${copy.langName} describing what the visitor wanted to know and what the assistant covered. Be neutral, factual, and natural. Do not use markdown, bullet points, or quotes. Plain prose only.

CONVERSATION:
${transcript}`,
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || copy.fallbackSummary;
  } catch (err) {
    console.error("[demo/summary] generation failed", err);
    return copy.fallbackSummary;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(args: {
  copy: Copy;
  firstName: string;
  company: string;
  summary: string;
  messages: DemoSession["messages"];
}): { html: string; text: string } {
  const { copy, firstName, company, summary, messages } = args;

  const transcriptText = messages
    .map(
      (m) =>
        `${m.role === "user" ? copy.visitorLabel : copy.assistantLabel}: ${m.content}`,
    )
    .join("\n\n");

  const transcriptHtml = messages
    .map(
      (m) => `
        <div style="margin-bottom:14px">
          <div style="font-size:11px;color:#5b6478;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">${escapeHtml(
            m.role === "user" ? copy.visitorLabel : copy.assistantLabel,
          )}</div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;color:#0A0A23;margin-top:4px">${escapeHtml(
            m.content,
          )}</div>
        </div>`,
    )
    .join("");

  const featuresHtml = copy.features
    .map(
      (f) =>
        `<li style="margin-bottom:8px;line-height:1.55">${escapeHtml(f)}</li>`,
    )
    .join("");

  const text = [
    copy.greeting(firstName),
    "",
    copy.intro(company),
    "",
    `${copy.summaryHeader}:`,
    summary,
    "",
    `${copy.featuresHeader}:`,
    ...copy.features.map((f) => `- ${f}`),
    "",
    `${copy.cta}: ${copy.ctaUrl}`,
    "",
    `--- ${copy.transcriptHeader} ---`,
    transcriptText,
    "",
    copy.closing,
    copy.signature,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f6fb;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0A0A23">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
    <div style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(11,42,107,0.08)">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#0B2A6B 0%,#3a7fe6 100%);color:#fff">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em">Lidh<span style="color:#ff8a3d">.</span>al</div>
      </div>
      <div style="padding:28px">
        <p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(
          copy.greeting(firstName),
        )}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 22px;color:#28304a">${escapeHtml(
          copy.intro(company),
        )}</p>

        <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin:18px 0 8px;font-weight:700">${escapeHtml(
          copy.summaryHeader,
        )}</h3>
        <p style="font-size:14.5px;line-height:1.65;margin:0 0 24px;color:#0A0A23">${escapeHtml(
          summary,
        )}</p>

        <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6478;margin:0 0 10px;font-weight:700">${escapeHtml(
          copy.featuresHeader,
        )}</h3>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:14.5px;color:#0A0A23">
          ${featuresHtml}
        </ul>

        <div style="text-align:center;margin:30px 0">
          <a href="${
            copy.ctaUrl
          }" style="display:inline-block;background:linear-gradient(135deg,#0B2A6B 0%,#3a7fe6 100%);color:#fff;text-decoration:none;font-weight:600;padding:14px 30px;border-radius:10px;font-size:15px">${escapeHtml(
            copy.cta,
          )} →</a>
        </div>

        <details style="margin-top:24px;border-top:1px solid #e6e9f2;padding-top:18px">
          <summary style="cursor:pointer;font-size:11px;color:#5b6478;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;outline:none">${escapeHtml(
            copy.transcriptHeader,
          )}</summary>
          <div style="margin-top:14px;padding:16px;background:#f4f6fb;border-radius:10px">${transcriptHtml}</div>
        </details>

        <p style="margin:30px 0 0;font-size:14px;color:#28304a;line-height:1.6">${escapeHtml(
          copy.closing,
        )}<br/><strong>${escapeHtml(copy.signature)}</strong></p>
      </div>
      <div style="padding:14px 28px;background:#f4f6fb;font-size:11px;color:#5b6478;text-align:center">
        Lidh.al • <a href="mailto:info@lidh.al" style="color:#5b6478;text-decoration:none">info@lidh.al</a> • <a href="https://lidh.al" style="color:#5b6478;text-decoration:none">https://lidh.al</a>
      </div>
    </div>
  </div>
</body></html>`;

  return { html, text };
}

export async function sendDemoSummary(session: DemoSession): Promise<void> {
  const copy = COPY[session.locale];
  const summary = await generateSummary(session, copy);
  const { html, text } = renderEmail({
    copy,
    firstName: session.lead.firstName,
    company: session.lead.company,
    summary,
    messages: session.messages,
  });

  await sendRawEmail({
    to: session.lead.email,
    replyTo: "info@lidh.al",
    subject: copy.subject(session.lead.company),
    text,
    html,
  });
}
