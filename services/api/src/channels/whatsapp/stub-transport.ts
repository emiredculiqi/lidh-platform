import { Injectable, Logger } from "@nestjs/common";
import type { WhatsAppTransport } from "./transport";

/**
 * Default WhatsAppTransport for dev/testing. Logs the outbound message
 * instead of hitting a provider, so the full inbound → @lidh/core agent →
 * outbound pipeline is verifiable with zero credentials.
 *
 * Replaced by WhatChimpTransport in M4.4 once WhatChimp is validated as a
 * pass-through (see ADR-004 / project_whatsapp_provider memory).
 */
@Injectable()
export class StubWhatsAppTransport implements WhatsAppTransport {
  private readonly logger = new Logger("WhatsApp:Stub");

  async sendText(to: string, text: string): Promise<void> {
    this.logger.log(
      `OUTBOUND → ${to}: ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`,
    );
  }
}
