import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CryptoService } from "../../common/crypto/crypto.service";
import { LiveService } from "../../common/live/live.service";
import { WHATSAPP_TRANSPORT, type WhatsAppTransport } from "./transport";
import { MetaSendError } from "./meta-cloud-transport";

/**
 * Deliver an operator's dashboard reply to the customer over WhatsApp.
 *
 * Called DIRECTLY by ConversationsService.reply (not via LiveService): the
 * LiveService bus is single-instance, so a "send to WhatsApp" subscriber on
 * another machine wouldn't fire. A direct in-process call always runs on the
 * machine handling the reply request.
 *
 * No-op for non-WhatsApp conversations (web replies reach the widget via the
 * `conv:<id>` receive-stream instead).
 */
@Injectable()
export class WhatsAppOutboundService {
  private readonly logger = new Logger(WhatsAppOutboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly live: LiveService,
    @Inject(WHATSAPP_TRANSPORT)
    private readonly transport: WhatsAppTransport,
  ) {}

  async sendForConversation(
    conversationId: string,
    text: string,
  ): Promise<void> {
    const conv = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      include: {
        channel: true,
        contact: { select: { phone: true } },
      },
    });
    if (!conv || conv.channel.kind !== "whatsapp") return; // not a WA thread
    if (conv.channel.status !== "connected") {
      this.logger.warn(
        `WA reply skipped: channel ${conv.channel.id} not connected`,
      );
      return;
    }

    const to = conv.contact.phone;
    if (!to) {
      this.logger.warn(
        `WA reply skipped: conversation ${conversationId} contact has no phone`,
      );
      return;
    }
    const cfg = (conv.channel.config ?? {}) as { phoneNumberId?: unknown };
    const phoneNumberId =
      typeof cfg.phoneNumberId === "string" ? cfg.phoneNumberId : undefined;
    const accessToken = conv.channel.credentialsEnc
      ? this.tryDecrypt(conv.channel.credentialsEnc)
      : undefined;

    try {
      await this.transport.sendText(to, text, { phoneNumberId, accessToken });
    } catch (err) {
      // The operator's message is already persisted; surface a delivery
      // failure to the dashboard instead of throwing it away. A common case
      // is replying OUTSIDE the 24h customer-service window (a free-form
      // message then requires the customer to message first, or a template).
      const outsideWindow =
        err instanceof MetaSendError && err.isOutsideWindow;
      this.logger.error(
        `WA operator reply failed for ${conversationId}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
      this.live.publish(conv.tenantId, {
        type: "delivery_failed",
        conversationId,
        text: outsideWindow
          ? "Not delivered — outside WhatsApp's 24h window. The customer must message first (or use a template)."
          : "WhatsApp delivery failed. Please try again.",
      });
    }
  }

  private tryDecrypt(blob: string): string | undefined {
    try {
      return this.crypto.decrypt(blob);
    } catch {
      return undefined;
    }
  }
}
