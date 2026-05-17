import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/public.decorator";
import { WhatsappService } from "./whatsapp.service";
import { InboundWebhookDto } from "./dto/inbound-webhook.dto";

@ApiTags("WhatsApp")
@Public() // both routes are provider webhooks — no Clerk user
@Controller("webhooks/whatsapp")
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @Get()
  @ApiOperation({
    summary: "Webhook verification handshake (provider-agnostic)",
    description:
      "Meta-style verification: echoes `hub.challenge` when " +
      "`hub.verify_token` matches env `WHATSAPP_VERIFY_TOKEN`. WhatChimp's " +
      "scheme is wired in M4.4; this generic form covers the common case.",
  })
  verify(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ): string {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === "subscribe" && expected && token === expected) {
      return challenge ?? "";
    }
    return "forbidden";
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Inbound WhatsApp message (fast-ack + async process)",
    description:
      "**How it works:** acks 200 immediately, then runs the agent " +
      "in-process (providers retry on slow responses, so we must ack fast). " +
      "Resolves the tenant by `businessNumber` → a whatsapp Channel, " +
      "reuses the same @lidh/core agent as web, replies via the configured " +
      "WhatsAppTransport.\n\n" +
      "_M4.1 accepts the normalized shape directly; a WhatChimp/Meta payload " +
      "adapter lands in M4.4. Signature verification (provider-specific HMAC) " +
      "also lands with the real provider._",
  })
  ack(@Body() dto: InboundWebhookDto): { status: "accepted" } {
    // Fire-and-forget (ADR-002 pattern): never block the provider's webhook.
    void this.whatsapp.handleInbound(dto).catch((err) =>
      this.logger.error(
        `handleInbound crashed: ${err instanceof Error ? err.message : "unknown"}`,
      ),
    );
    return { status: "accepted" };
  }
}
