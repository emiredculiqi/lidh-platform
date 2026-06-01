import { Injectable, Logger } from "@nestjs/common";
import type {
  OutboundContext,
  WhatsAppTransport,
} from "./transport";

/**
 * WhatChimp outbound transport. Sends free-form session-text replies via
 *   POST {base}/api/v1/whatsapp/send  (form-encoded)
 * within the 24h customer-service window (the agent always replies to a
 * just-received inbound, so we're always inside it).
 *
 * Auth: shared `WHATCHIMP_API_TOKEN` env (one WhatChimp account holds all
 * tenants' connected WhatsApp numbers). Per-tenant sender = `phoneNumberId`
 * read from the tenant's Channel.config — passed via OutboundContext.
 */
@Injectable()
export class WhatChimpTransport implements WhatsAppTransport {
  private readonly logger = new Logger("WhatsApp:WhatChimp");
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiToken = process.env.WHATCHIMP_API_TOKEN ?? "";
    this.baseUrl = (
      process.env.WHATCHIMP_BASE_URL ?? "https://app.whatchimp.com"
    ).replace(/\/$/, "");
    if (!this.apiToken) {
      // The module factory only binds this transport when the token is set,
      // so reaching here without it indicates a misconfiguration.
      this.logger.warn("WHATCHIMP_API_TOKEN not set — sends will fail");
    }
  }

  /**
   * Provision a WhatChimp account for a business owner (ADR-013, deferred).
   * Called LATER when the tenant subscribes to the WhatsApp-included plan,
   * NOT on signup — most signups won't pay for WhatsApp. Returns a one-time
   * direct-login URL the operator (or the tenant) can use to enter WhatChimp.
   *
   * Wraps WhatChimp's `user/get/direct-login-url/only-new-users` endpoint.
   * Idempotent-ish: on "User already existed" the API returns status:"0" —
   * surface that to the caller (callers decide whether to re-issue or skip).
   */
  async provisionAccount(input: {
    email: string;
    packageId: number;
    expiresAt: Date;
  }): Promise<{ directLoginUrl: string }> {
    if (!this.apiToken) {
      throw new Error("WhatChimp not configured (WHATCHIMP_API_TOKEN unset)");
    }
    const yyyyMmDd = input.expiresAt.toISOString().slice(0, 10);
    const body = new URLSearchParams({
      apiToken: this.apiToken,
      email: input.email,
      package_id: String(input.packageId),
      expired_date: yyyyMmDd,
    });
    const res = await fetch(
      `${this.baseUrl}/api/v1/user/get/direct-login-url/only-new-users`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const raw = await res.text();
    let parsed: {
      status?: string;
      message?: { direct_login_url?: string } | string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `WhatChimp provision: non-JSON response (HTTP ${res.status}) — ${raw.slice(0, 200)}`,
      );
    }
    if (parsed.status !== "1") {
      throw new Error(
        `WhatChimp provision rejected: ${
          typeof parsed.message === "string"
            ? parsed.message
            : "(no message)"
        }`,
      );
    }
    const url =
      typeof parsed.message === "object"
        ? parsed.message?.direct_login_url
        : undefined;
    if (!url) throw new Error("WhatChimp provision: no direct_login_url");
    this.logger.log(`provisioned WhatChimp account for ${input.email}`);
    return { directLoginUrl: url };
  }

  async sendText(
    to: string,
    text: string,
    ctx?: OutboundContext,
  ): Promise<void> {
    const phoneNumberId = ctx?.phoneNumberId;
    if (!phoneNumberId) {
      throw new Error(
        "WhatChimp send: missing phoneNumberId — set it on the tenant's " +
          "whatsapp Channel.config.phoneNumberId",
      );
    }
    // WhatChimp's /send requires digits-only (no leading +).
    const phone = to.replace(/^\+/, "").replace(/\D/g, "");
    if (!phone) throw new Error(`WhatChimp send: invalid phone "${to}"`);

    const body = new URLSearchParams({
      apiToken: this.apiToken,
      phone_number_id: phoneNumberId,
      phone_number: phone,
      message: text,
    });

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (e) {
      throw new Error(
        `WhatChimp send: network error (${(e as Error).message})`,
      );
    }

    const raw = await res.text();
    let parsed: { status?: string; wa_message_id?: string; message?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `WhatChimp send: non-JSON response (HTTP ${res.status}) — ${raw.slice(0, 200)}`,
      );
    }
    if (parsed.status !== "1") {
      // WhatChimp returns `status: "0"` for business errors (subscriber cap,
      // invalid number, etc.) — keep its message visible.
      throw new Error(
        `WhatChimp send rejected: ${parsed.message ?? "(no message)"}`,
      );
    }
    this.logger.log(
      `OUTBOUND → ${phone}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}` +
        (parsed.wa_message_id ? ` [${parsed.wa_message_id}]` : ""),
    );
  }
}
