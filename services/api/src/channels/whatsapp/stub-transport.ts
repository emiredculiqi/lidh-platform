import { Injectable, Logger } from "@nestjs/common";
import type { WhatsAppTransport } from "./transport";

/**
 * Default WhatsAppTransport for dev/testing. Logs the outbound message
 * instead of hitting a provider, so the full inbound → @lidh/core agent →
 * outbound pipeline is verifiable with zero credentials.
 *
 * MetaCloudTransport takes over in production when META_APP_ID is set
 * (see WhatsappModule's transport factory).
 */
@Injectable()
export class StubWhatsAppTransport implements WhatsAppTransport {
  private readonly logger = new Logger("WhatsApp:Stub");

  async sendText(
    to: string,
    text: string,
    ctx?: { phoneNumberId?: string },
  ): Promise<void> {
    this.logger.log(
      `OUTBOUND → ${to}${ctx?.phoneNumberId ? ` (from ${ctx.phoneNumberId})` : ""}: ` +
        `${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`,
    );
  }
}
