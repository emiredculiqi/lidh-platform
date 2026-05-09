import "server-only";
import { Resend } from "resend";

type ResendConfig = {
  apiKey: string;
  from: string;
  to: string;
};

let cachedClient: Resend | null = null;

function readConfig(): ResendConfig {
  const { RESEND_API_KEY, RESEND_FROM, CONTACT_TO_EMAIL } = process.env;

  const missing: string[] = [];
  if (!RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!RESEND_FROM) missing.push("RESEND_FROM");
  if (!CONTACT_TO_EMAIL) missing.push("CONTACT_TO_EMAIL");
  if (missing.length > 0) {
    throw new Error(`Missing Resend env vars: ${missing.join(", ")}`);
  }

  return {
    apiKey: RESEND_API_KEY!,
    from: RESEND_FROM!,
    to: CONTACT_TO_EMAIL!,
  };
}

function getClient(cfg: ResendConfig): Resend {
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(cfg.apiKey);
  return cachedClient;
}

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  business?: string;
  preferredTime?: string;
  message: string;
};

export async function sendContactEmail(
  payload: ContactPayload,
): Promise<{ id: string }> {
  const cfg = readConfig();
  const resend = getClient(cfg);

  const subject = payload.business
    ? `New lead — ${payload.business} (${payload.name})`
    : `New lead — ${payload.name}`;

  const text = [
    `Name:           ${payload.name}`,
    `Email:          ${payload.email}`,
    `Phone:          ${payload.phone || "—"}`,
    `Business:       ${payload.business || "—"}`,
    `Preferred time: ${payload.preferredTime || "—"}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#0A0A23;max-width:560px">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0B2A6B">New lead from lidh.al</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 12px;color:#5b6478">Name</td><td style="padding:6px 12px;font-weight:600">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:6px 12px;color:#5b6478">Email</td><td style="padding:6px 12px"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></td></tr>
        <tr><td style="padding:6px 12px;color:#5b6478">Phone</td><td style="padding:6px 12px">${escapeHtml(payload.phone || "—")}</td></tr>
        <tr><td style="padding:6px 12px;color:#5b6478">Business</td><td style="padding:6px 12px">${escapeHtml(payload.business || "—")}</td></tr>
        <tr><td style="padding:6px 12px;color:#5b6478">Preferred time</td><td style="padding:6px 12px">${escapeHtml(payload.preferredTime || "—")}</td></tr>
      </table>
      <h3 style="margin:20px 0 8px;font-size:14px;color:#0B2A6B">Message</h3>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0">${escapeHtml(payload.message)}</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: cfg.from,
    to: cfg.to,
    replyTo: payload.email,
    subject,
    text,
    html,
  });

  if (error || !data) {
    throw new Error(
      `Resend send failed: ${error?.message ?? "unknown error"}`,
    );
  }

  return { id: data.id };
}

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<{ id: string }> {
  const cfg = readConfig();
  const resend = getClient(cfg);
  const { data, error } = await resend.emails.send({
    from: cfg.from,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  if (error || !data) {
    throw new Error(
      `Resend send failed: ${error?.message ?? "unknown error"}`,
    );
  }
  return { id: data.id };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
