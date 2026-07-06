import { Injectable, Logger } from "@nestjs/common";

const DEFAULT_GRAPH_VERSION = "v22.0";

export interface ExchangedToken {
  accessToken: string;
  /** Seconds until expiry, if Meta returned one (long-lived tokens omit it). */
  expiresIn?: number;
}

export interface PhoneNumberInfo {
  displayPhoneNumber?: string;
  verifiedName?: string;
}

/**
 * Pure Meta Graph client for the Embedded Signup onboarding handshake (no DB,
 * no crypto). Reads app-level credentials from env:
 *   META_APP_ID, META_APP_SECRET, META_GRAPH_VERSION
 * The per-tenant WABA id / phone_number_id / access token flow through the
 * method args (ChannelsService owns persistence + encryption).
 */
@Injectable()
export class MetaOnboardingService {
  private readonly logger = new Logger(MetaOnboardingService.name);
  private readonly graphVersion: string;

  constructor() {
    this.graphVersion = (
      process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION
    ).replace(/^\/|\/$/g, "");
  }

  private base(path: string): string {
    return `https://graph.facebook.com/${this.graphVersion}/${path}`;
  }

  /**
   * Exchange the Embedded Signup auth `code` for a WABA-scoped business token.
   * GET /oauth/access_token?client_id&client_secret&code
   */
  async exchangeCodeForToken(code: string): Promise<ExchangedToken> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Meta onboarding not configured (META_APP_ID/SECRET)");
    }
    const url =
      this.base("oauth/access_token") +
      `?client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&code=${encodeURIComponent(code)}`;
    const body = await this.getJson(url, undefined, "code exchange");
    const accessToken =
      typeof body.access_token === "string" ? body.access_token : undefined;
    if (!accessToken) {
      throw new Error("Meta code exchange: no access_token in response");
    }
    return {
      accessToken,
      expiresIn:
        typeof body.expires_in === "number" ? body.expires_in : undefined,
    };
  }

  /**
   * Subscribe OUR app to the customer's WABA so their message webhooks reach
   * us. POST /{waba-id}/subscribed_apps
   */
  async subscribeApp(wabaId: string, accessToken: string): Promise<void> {
    await this.postJson(
      this.base(`${wabaId}/subscribed_apps`),
      accessToken,
      {},
      "subscribe app",
    );
    this.logger.log(`subscribed app to WABA ${wabaId}`);
  }

  /** Unsubscribe our app from a WABA (on disconnect). Best-effort. */
  async unsubscribeApp(wabaId: string, accessToken: string): Promise<void> {
    const res = await fetch(this.base(`${wabaId}/subscribed_apps`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      this.logger.warn(
        `unsubscribe WABA ${wabaId} returned HTTP ${res.status} (ignored)`,
      );
    }
  }

  /**
   * Register a phone number for Cloud API. Only for STANDARD onboarding —
   * coexistence keeps the number on the owner's WhatsApp Business App and must
   * NOT be registered. POST /{phone-number-id}/register
   */
  async registerPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
    pin: string,
  ): Promise<void> {
    await this.postJson(
      this.base(`${phoneNumberId}/register`),
      accessToken,
      { messaging_product: "whatsapp", pin },
      "register number",
    );
    this.logger.log(`registered phone number ${phoneNumberId}`);
  }

  /** Fetch the display number + verified name for a phone_number_id. */
  async getPhoneNumber(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<PhoneNumberInfo> {
    const url = this.base(
      `${phoneNumberId}?fields=display_phone_number,verified_name`,
    );
    const body = await this.getJson(url, accessToken, "get phone number");
    return {
      displayPhoneNumber:
        typeof body.display_phone_number === "string"
          ? body.display_phone_number
          : undefined,
      verifiedName:
        typeof body.verified_name === "string" ? body.verified_name : undefined,
    };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private async getJson(
    url: string,
    accessToken: string | undefined,
    label: string,
  ): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      });
    } catch (e) {
      throw new Error(`Meta ${label}: network error (${(e as Error).message})`);
    }
    return this.parse(res, label);
  }

  private async postJson(
    url: string,
    accessToken: string,
    payload: Record<string, unknown>,
    label: string,
  ): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error(`Meta ${label}: network error (${(e as Error).message})`);
    }
    return this.parse(res, label);
  }

  private async parse(
    res: Response,
    label: string,
  ): Promise<Record<string, unknown>> {
    const raw = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `Meta ${label}: non-JSON response (HTTP ${res.status}) — ${raw.slice(0, 200)}`,
      );
    }
    const error = body.error as { message?: string } | undefined;
    if (!res.ok || error) {
      throw new Error(
        `Meta ${label} failed (HTTP ${res.status}): ${error?.message ?? raw.slice(0, 200)}`,
      );
    }
    return body;
  }
}
