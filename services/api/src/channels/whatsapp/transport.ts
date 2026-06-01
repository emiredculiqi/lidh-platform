/**
 * WhatsApp transport PORT (ports & adapters — same idea as core's executeTool).
 *
 * The WhatsApp channel logic depends only on this interface. Concrete
 * providers implement it:
 *   - StubWhatsAppTransport  → dev/testing (logs, no network)
 *   - WhatChimpTransport     → M4.4, AFTER validating WhatChimp is a
 *                              pass-through (memory: project_whatsapp_provider)
 *   - MetaCloudTransport     → fallback if WhatChimp can't be pass-through
 *
 * Swapping providers = swapping the binding in WhatsappModule; the service,
 * webhook, and the @lidh/core agent never change.
 */

export const WHATSAPP_TRANSPORT = Symbol("WHATSAPP_TRANSPORT");

/** A normalized inbound message — provider payloads are mapped into this. */
export interface InboundWhatsAppMessage {
  /** The customer's WhatsApp phone (E.164, e.g. +355691112222). */
  from: string;
  /** The business WhatsApp number/id that received it (identifies the tenant). */
  businessNumber: string;
  /** The text body. (Media/templates handled later.) */
  text: string;
  /** Provider's message id (idempotency / dedupe). */
  providerMessageId?: string;
  /** Optional provider-supplied display name of the sender. */
  senderName?: string;
}

/**
 * Per-channel context the service passes when sending. Real providers need
 * to know WHICH business number is sending (each tenant has its own); the
 * service reads it from the resolved whatsapp Channel's config.
 */
export interface OutboundContext {
  /** Meta WhatsApp Business phone_number_id (used by WhatChimp / Meta Cloud). */
  phoneNumberId?: string;
}

export interface WhatsAppTransport {
  /** Send a free-form text reply to a customer. */
  sendText(to: string, text: string, ctx?: OutboundContext): Promise<void>;
}
