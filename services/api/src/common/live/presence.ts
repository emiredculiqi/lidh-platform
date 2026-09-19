/**
 * Who is looking at (or typing in) which conversation, right now.
 * ADR-024 §3 — a soft signal so two employees don't answer the same customer
 * blind. Pure and in-memory: the dashboards heartbeat every ~20 s, a viewer
 * expires after VIEW_TTL_MS without one, and "typing" expires after
 * TYPING_TTL_MS. Single-instance like the rest of the live bus; it moves to
 * Redis with it.
 */
export const VIEW_TTL_MS = 45_000;
export const TYPING_TTL_MS = 6_000;

export interface ViewerInfo {
  userId: string;
  name: string | null;
}

export interface Viewer extends ViewerInfo {
  typing: boolean;
}

interface ViewerState extends ViewerInfo {
  at: number;
  typingAt: number;
}

interface Room {
  tenantId: string;
  viewers: Map<string, ViewerState>;
  /** Fingerprint of the last snapshot handed out as "changed". */
  lastKey: string;
}

export interface RoomSnapshot {
  tenantId: string;
  conversationId: string;
  viewers: Viewer[];
}

export class PresenceRegistry {
  private readonly rooms = new Map<string, Room>();

  /** A dashboard says "I'm on this thread" (and whether it's typing).
   *  Returns the room snapshot when it differs from the last one, else null. */
  heartbeat(
    tenantId: string,
    conversationId: string,
    viewer: ViewerInfo,
    typing: boolean,
    now = Date.now(),
  ): RoomSnapshot | null {
    let room = this.rooms.get(conversationId);
    if (!room) {
      room = { tenantId, viewers: new Map(), lastKey: "" };
      this.rooms.set(conversationId, room);
    }
    const prev = room.viewers.get(viewer.userId);
    room.viewers.set(viewer.userId, {
      userId: viewer.userId,
      name: viewer.name,
      at: now,
      typingAt: typing ? now : prev?.typingAt ?? 0,
    });
    if (!typing) room.viewers.get(viewer.userId)!.typingAt = 0; // explicit "stopped typing"
    return this.changed(conversationId, room, now);
  }

  /** A dashboard left the thread. */
  leave(conversationId: string, userId: string, now = Date.now()): RoomSnapshot | null {
    const room = this.rooms.get(conversationId);
    if (!room) return null;
    room.viewers.delete(userId);
    return this.changed(conversationId, room, now);
  }

  /** Current viewers of a thread (expired ones pruned). */
  viewers(conversationId: string, now = Date.now()): Viewer[] {
    const room = this.rooms.get(conversationId);
    if (!room) return [];
    return this.snapshot(room, now);
  }

  /** Expire stale viewers everywhere; returns the rooms whose snapshot
   *  changed as a result (so the caller can publish them). */
  sweep(now = Date.now()): RoomSnapshot[] {
    const out: RoomSnapshot[] = [];
    for (const [conversationId, room] of this.rooms) {
      const s = this.changed(conversationId, room, now);
      if (s) out.push(s);
      if (room.viewers.size === 0) this.rooms.delete(conversationId);
    }
    return out;
  }

  private snapshot(room: Room, now: number): Viewer[] {
    for (const [id, v] of room.viewers) {
      if (now - v.at > VIEW_TTL_MS) room.viewers.delete(id);
    }
    return [...room.viewers.values()]
      .sort((a, b) => a.at - b.at)
      .map((v) => ({
        userId: v.userId,
        name: v.name,
        typing: now - v.typingAt <= TYPING_TTL_MS,
      }));
  }

  private changed(conversationId: string, room: Room, now: number): RoomSnapshot | null {
    const viewers = this.snapshot(room, now);
    const key = viewers.map((v) => `${v.userId}:${v.typing ? 1 : 0}`).join(",");
    if (key === room.lastKey) return null;
    room.lastKey = key;
    return { tenantId: room.tenantId, conversationId, viewers };
  }
}
