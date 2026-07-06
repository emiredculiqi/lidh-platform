import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

export interface LiveEvent {
  type:
    | "conversation.started"
    | "message"
    | "agent_message" // a human reply, pushed to the widget's receive-stream
    | "ai_paused"
    | "ai_resumed"
    | "lead_captured"
    | "contact_registered"
    | "handoff"
    | "delivery_failed"; // an outbound (e.g. WhatsApp) send failed
  conversationId: string;
  channelKind?: string;
  contactName?: string | null;
  role?: "user" | "assistant";
  preview?: string;
  /** Full message text — used on the widget receive-stream so the visitor's
   *  widget can render the agent's reply. */
  text?: string;
}

/**
 * In-process pub/sub for live dashboard updates (new conversations, new
 * messages). Keyed by tenantId so a watching dashboard only receives its own
 * tenant's events.
 *
 * Single-instance for now — fine while the API runs on one machine. When it
 * scales to multiple machines, swap the EventEmitter for Redis pub/sub so an
 * event emitted on machine A reaches a dashboard connected to machine B.
 */
@Injectable()
export class LiveService {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Many dashboards (and a per-connection listener each) may subscribe.
    this.emitter.setMaxListeners(0);
  }

  publish(tenantId: string, event: LiveEvent): void {
    this.emitter.emit(tenantId, event);
  }

  /** Subscribe to a tenant's events; returns an unsubscribe function. */
  subscribe(tenantId: string, listener: (e: LiveEvent) => void): () => void {
    this.emitter.on(tenantId, listener);
    return () => this.emitter.off(tenantId, listener);
  }
}
