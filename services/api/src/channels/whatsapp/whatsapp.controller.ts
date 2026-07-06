import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createHmac } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { Public } from "../../common/auth/public.decorator";
import { CryptoService } from "../../common/crypto/crypto.service";
import { WhatsappService } from "./whatsapp.service";
import { parseMetaWebhook } from "./meta-webhook.parser";

/**
 * Meta WhatsApp Cloud API webhook (direct Tech Provider). One endpoint pair:
 *   GET  /v1/webhooks/whatsapp  → verification handshake (hub.challenge echo)
 *   POST /v1/webhooks/whatsapp  → inbound messages / echoes / account events
 *
 * Configure this exact URL (note the /v1 global prefix) in the Meta App's
 * WhatsApp webhook settings, with the verify token = META_WEBHOOK_VERIFY_TOKEN.
 */
@ApiTags("WhatsApp")
@Public() // provider webhooks — no Clerk user; POST is authenticated via HMAC.
@Controller("webhooks/whatsapp")
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly crypto: CryptoService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Webhook verification handshake",
    description:
      "Meta subscription check: echoes `hub.challenge` when `hub.verify_token` " +
      "matches env `META_WEBHOOK_VERIFY_TOKEN`.",
  })
  verify(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ): string {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && expected && token === expected) {
      return challenge ?? "";
    }
    return "forbidden";
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Inbound WhatsApp webhook (fast-ack + async process)",
    description:
      "Verifies X-Hub-Signature-256 over the raw body, then acks 200 " +
      "immediately and processes in-process (Meta retries on slow/failed " +
      "responses, so we must ack fast). Routes inbound messages to the same " +
      "@lidh/core agent as web, coexistence echoes to the inbox, and account " +
      "events to channel status.",
  })
  handle(@Req() req: RawBodyRequest<FastifyRequest>): { status: string } {
    // 1) Authenticate the payload via HMAC over the EXACT received bytes.
    if (!this.verifySignature(req)) {
      // Return 200 (so Meta doesn't disable the webhook) but drop it.
      this.logger.warn("webhook signature invalid/missing — dropped");
      return { status: "ignored" };
    }

    // 2) Parse (Fastify already parsed the same bytes into req.body).
    const parsed = parseMetaWebhook(req.body ?? this.reparse(req));

    // 3) Fast-ack; fire-and-forget each unit of work (never block the ack).
    for (const msg of parsed.messages) {
      void this.whatsapp
        .handleInbound(msg)
        .catch((err) => this.logCrash("handleInbound", err));
    }
    for (const echo of parsed.echoes) {
      void this.whatsapp
        .handleEcho(echo)
        .catch((err) => this.logCrash("handleEcho", err));
    }
    for (const evt of parsed.accountEvents) {
      void this.whatsapp
        .handleAccountEvent(evt)
        .catch((err) => this.logCrash("handleAccountEvent", err));
    }
    if (parsed.statusCount > 0) {
      this.logger.debug(`ignored ${parsed.statusCount} status update(s)`);
    }

    return { status: "accepted" };
  }

  /**
   * Verify Meta's X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app_secret,
   * rawBody). When META_APP_SECRET is unset (local/dev, stub transport), skip
   * verification so the pipeline is testable without Meta credentials.
   */
  private verifySignature(req: RawBodyRequest<FastifyRequest>): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
      this.logger.warn(
        "META_APP_SECRET unset — skipping webhook signature check (dev only)",
      );
      return true;
    }
    const header = req.headers["x-hub-signature-256"];
    const sig = Array.isArray(header) ? header[0] : header;
    if (!sig || !req.rawBody) return false;
    const expected =
      "sha256=" +
      createHmac("sha256", secret).update(req.rawBody).digest("hex");
    return this.crypto.safeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  private reparse(req: RawBodyRequest<FastifyRequest>): unknown {
    try {
      return req.rawBody ? JSON.parse(req.rawBody.toString("utf8")) : undefined;
    } catch {
      return undefined;
    }
  }

  private logCrash(where: string, err: unknown): void {
    this.logger.error(
      `${where} crashed: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
