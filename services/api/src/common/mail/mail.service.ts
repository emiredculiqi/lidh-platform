import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Outbound email via Resend's REST API (no SDK dependency — same lightweight
 * fetch approach as the embeddings calls).
 *
 * Used to notify the BUSINESS when their agent captures a lead or requests a
 * human handoff. Graceful: if RESEND_API_KEY is unset it logs a warning and
 * no-ops, so chat never fails because email isn't configured. All sends are
 * fire-and-forget from the caller — a failed email must never block a reply.
 *
 * Env:
 *   RESEND_API_KEY   Resend API key (Fly secret in prod; .env in dev)
 *   RESEND_FROM      sender, e.g. "Lidh.al <noreply@lidh.al>" (domain verified)
 *   DASHBOARD_URL    base URL for dashboard links (default https://app.lidh.al)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY ?? "";
  private readonly from = process.env.RESEND_FROM ?? "Lidh.al <noreply@lidh.al>";
  private readonly dashboardUrl =
    process.env.DASHBOARD_URL ?? "https://app.lidh.al";

  constructor(private readonly prisma: PrismaService) {
    if (!this.apiKey) {
      this.logger.warn(
        "RESEND_API_KEY not set — lead/handoff email notifications disabled.",
      );
    }
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  /** Email the business when their agent captures a lead. */
  async notifyLead(
    tenantId: string,
    lead: { name?: string; email?: string; phone?: string; notes?: string },
    transcript?: string,
  ): Promise<void> {
    const r = await this.recipient(tenantId);
    if (!r) return;

    const rows = [
      ["Emri", lead.name],
      ["Email", lead.email],
      ["Telefon", lead.phone],
    ]
      .filter(([, v]) => v && String(v).trim())
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0"><strong>${esc(String(v))}</strong></td></tr>`,
      )
      .join("");

    const leadsUrl = `${this.dashboardUrl}/tenants/${r.slug}/leads`;
    const html = wrap(`
      <h2 style="margin:0 0 4px">Lead i ri 🎉</h2>
      <p style="margin:0 0 16px;color:#475569">Agjenti i <strong>${esc(r.name)}</strong> sapo kapi një kontakt të ri.</p>
      <table style="border-collapse:collapse;font-size:14px">${rows || '<tr><td style="color:#64748b">Pa detaje kontakti</td></tr>'}</table>
      ${lead.notes ? `<p style="margin:16px 0 4px;color:#64748b">Përmbledhje</p><p style="margin:0;font-size:14px">${esc(lead.notes)}</p>` : ""}
      ${transcriptBlock(transcript)}
      <p style="margin:24px 0 0"><a href="${leadsUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Shiko leads-at</a></p>
    `);
    const text = [
      `Lead i ri për ${r.name}`,
      lead.name && `Emri: ${lead.name}`,
      lead.email && `Email: ${lead.email}`,
      lead.phone && `Telefon: ${lead.phone}`,
      lead.notes && `Përmbledhje: ${lead.notes}`,
      ``,
      `Shiko: ${leadsUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.send({
      to: r.to,
      subject: `Lead i ri — ${r.name}`,
      html,
      text,
      // Let the business reply straight to the customer when we have an email.
      replyTo: lead.email?.trim() || undefined,
    });
  }

  /** Email the business when their agent escalates to a human. */
  async notifyHandoff(
    tenantId: string,
    info: { reason?: string; summary?: string },
    transcript?: string,
  ): Promise<void> {
    const r = await this.recipient(tenantId);
    if (!r) return;

    const inboxUrl = `${this.dashboardUrl}/tenants/${r.slug}/inbox`;
    const html = wrap(`
      <h2 style="margin:0 0 4px">Kërkohet ndihmë njerëzore 🙋</h2>
      <p style="margin:0 0 16px;color:#475569">Agjenti i <strong>${esc(r.name)}</strong> kërkoi t'i kalojë biseda një personi.</p>
      ${info.reason ? `<p style="margin:0 0 4px;color:#64748b">Arsyeja</p><p style="margin:0 0 12px;font-size:14px"><strong>${esc(info.reason)}</strong></p>` : ""}
      ${info.summary ? `<p style="margin:0 0 4px;color:#64748b">Konteksti</p><p style="margin:0;font-size:14px">${esc(info.summary)}</p>` : ""}
      ${transcriptBlock(transcript)}
      <p style="margin:24px 0 0"><a href="${inboxUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Hap bisedën</a></p>
    `);
    const text = [
      `Kërkohet ndihmë njerëzore — ${r.name}`,
      info.reason && `Arsyeja: ${info.reason}`,
      info.summary && `Konteksti: ${info.summary}`,
      ``,
      `Hap: ${inboxUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.send({
      to: r.to,
      subject: `Kërkesë për kontakt njerëzor — ${r.name}`,
      html,
      text,
    });
  }

  /** Resolve who gets the notification: the tenant's oldest owner's email,
   *  falling back to a pending owner email if the owner hasn't signed up yet. */
  private async recipient(
    tenantId: string,
  ): Promise<{ to: string; name: string; slug: string } | null> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        pendingOwnerEmail: true,
        memberships: {
          where: { role: "owner" },
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { user: { select: { email: true } } },
        },
      },
    });
    if (!tenant) return null;
    const to = tenant.memberships[0]?.user.email ?? tenant.pendingOwnerEmail;
    if (!to) {
      this.logger.warn(`No notify recipient for tenant ${tenantId}`);
      return null;
    }
    return { to, name: tenant.name, slug: tenant.slug };
  }

  /**
   * Invite someone to join a tenant's team. Sent directly to the invitee (not
   * the owner). They create a Lidh.al account with this email; the AuthGuard
   * binds the invite to their account on first sign-in (email match).
   */
  async sendInvitation(opts: {
    to: string;
    businessName: string;
    role: string; // "admin" | "agent"
    inviterName?: string | null;
  }): Promise<void> {
    const biz = esc(opts.businessName);
    const roleAl = opts.role === "admin" ? "administrator" : "anëtar";
    const roleEn = opts.role === "admin" ? "an administrator" : "a member";
    const by = opts.inviterName ? ` nga ${esc(opts.inviterName)}` : "";
    const signUp = `${this.dashboardUrl}/sign-up`;
    const subject = `Je ftuar në ekipin e ${opts.businessName} · Lidh.al`;
    const text =
      `Je ftuar${opts.inviterName ? ` nga ${opts.inviterName}` : ""} të bashkohesh me ekipin e "${opts.businessName}" në Lidh.al si ${roleAl}.\n` +
      `Krijo llogarinë me këtë email (${opts.to}): ${signUp}\n` +
      `Pas regjistrimit ke akses automatikisht në panel.\n\n` +
      `— — —\n\n` +
      `You've been invited to join the "${opts.businessName}" team on Lidh.al as ${roleEn}.\n` +
      `Create your account with this email (${opts.to}): ${signUp}\n` +
      `You'll get access to the dashboard automatically after signing up.`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#0B2A6B,#1E5FDB 35%,#22D3EE 70%,#5EEAD4);padding:22px 24px;border-radius:14px 14px 0 0;color:#fff">
        <div style="font-size:13px;opacity:.85">Lidh.al</div>
        <div style="font-size:19px;font-weight:700;margin-top:2px">Ftesë në ekip · Team invite</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:24px;color:#0A0A23">
        <p style="margin:0 0 12px">Je ftuar${by} të bashkohesh me ekipin e <b>${biz}</b> në Lidh.al si <b>${roleAl}</b>.</p>
        <p style="margin:0 0 18px;color:#475569;font-size:14px">You've been invited to join <b>${biz}</b> on Lidh.al as ${roleEn}. Sign up with <b>${esc(opts.to)}</b>.</p>
        <a href="${signUp}" style="display:inline-block;background:#1E5FDB;color:#fff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">Krijo llogarinë · Create account</a>
        <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">Pas regjistrimit me këtë email, aksesi jepet automatikisht.</p>
      </div>
    </div>`;
    await this.send({ to: opts.to, subject, html, text });
  }

  private async send(msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        this.logger.error(`Resend ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      this.logger.error(
        `email send failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function transcriptBlock(transcript?: string): string {
  if (!transcript?.trim()) return "";
  const trimmed = transcript.length > 1500 ? transcript.slice(-1500) : transcript;
  return `<p style="margin:16px 0 4px;color:#64748b">Biseda</p><pre style="margin:0;white-space:pre-wrap;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;color:#334155">${esc(trimmed)}</pre>`;
}

function wrap(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">${inner}<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Dërguar nga Lidh.al</p></div>`;
}
