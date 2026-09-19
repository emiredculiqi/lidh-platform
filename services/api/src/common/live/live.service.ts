import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { PresenceRegistry, type Viewer, type ViewerInfo } from "./presence";

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
    | "delivery_failed" // an outbound (e.g. WhatsApp) send failed
    | "presence"; // who is viewing / typing in a thread (ADR-024 §3)
  conversationId: string;
  /** For `presence`: everyone currently on the thread. */
  viewers?: Viewer[];
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
export class LiveService implements OnModuleInit, OnModuleDestroy {
  private readonly emitter = new EventEmitter();
  private readonly presence = new PresenceRegistry();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Many dashboards (and a per-connection listener each) may subscribe.
    this.emitter.setMaxListeners(0);
  }

  onModuleInit(): void {
    if (process.env.VITEST) return;
    // Expire viewers that closed the tab without saying goodbye.
    this.sweepTimer = setInterval(() => {
      for (const s of this.presence.sweep()) this.publishPresence(s.tenantId, s.conversationId, s.viewers);
    }, 10_000);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  // ---- presence (ADR-024 §3) ----

  /** A dashboard is on this thread (and typing or not). Broadcasts on change. */
  heartbeat(tenantId: string, conversationId: string, viewer: ViewerInfo, typing: boolean): Viewer[] {
    const s = this.presence.heartbeat(tenantId, conversationId, viewer, typing);
    if (s) this.publishPresence(s.tenantId, s.conversationId, s.viewers);
    return this.presence.viewers(conversationId);
  }

  /** A dashboard left this thread. */
  leave(tenantId: string, conversationId: string, userId: string): void {
    const s = this.presence.leave(conversationId, userId);
    if (s) this.publishPresence(tenantId, s.conversationId, s.viewers);
  }

  /** Who is on this thread right now. */
  viewers(conversationId: string): Viewer[] {
    return this.presence.viewers(conversationId);
  }

  private publishPresence(tenantId: string, conversationId: string, viewers: Viewer[]): void {
    this.publish(tenantId, { type: "presence", conversationId, viewers });
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
