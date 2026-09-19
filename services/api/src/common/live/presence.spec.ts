import { describe, it, expect } from "vitest";
import { PresenceRegistry, TYPING_TTL_MS, VIEW_TTL_MS } from "./presence";

const ana = { userId: "u_ana", name: "Ana" };
const ben = { userId: "u_ben", name: "Ben" };
const T0 = 1_000_000;

describe("PresenceRegistry", () => {
  it("reports a new viewer once, then stays quiet on identical heartbeats", () => {
    const r = new PresenceRegistry();
    const first = r.heartbeat("t1", "c1", ana, false, T0);
    expect(first?.viewers).toEqual([{ ...ana, typing: false }]);
    expect(first?.tenantId).toBe("t1");
    expect(r.heartbeat("t1", "c1", ana, false, T0 + 20_000)).toBeNull();
  });

  it("flags typing and clears it when it expires or is withdrawn", () => {
    const r = new PresenceRegistry();
    r.heartbeat("t1", "c1", ana, false, T0);
    expect(r.heartbeat("t1", "c1", ana, true, T0 + 1000)?.viewers[0].typing).toBe(true);
    // Still typing inside the TTL: no change to report.
    expect(r.viewers("c1", T0 + 1000 + TYPING_TTL_MS)[0].typing).toBe(true);
    expect(r.viewers("c1", T0 + 1001 + TYPING_TTL_MS)[0].typing).toBe(false);
    // Withdrawn explicitly.
    r.heartbeat("t1", "c1", ana, true, T0 + 2000);
    expect(r.heartbeat("t1", "c1", ana, false, T0 + 2500)?.viewers[0].typing).toBe(false);
  });

  it("expires a viewer that stopped heartbeating, via sweep", () => {
    const r = new PresenceRegistry();
    r.heartbeat("t1", "c1", ana, false, T0);
    r.heartbeat("t1", "c1", ben, false, T0 + 30_000);
    expect(r.sweep(T0 + 40_000)).toEqual([]); // nobody expired yet
    const changed = r.sweep(T0 + VIEW_TTL_MS + 1);
    expect(changed).toHaveLength(1);
    expect(changed[0].viewers.map((v) => v.userId)).toEqual(["u_ben"]);
    // Once everyone is gone the room is dropped and reported empty exactly once.
    const gone = r.sweep(T0 + 30_000 + VIEW_TTL_MS + 1);
    expect(gone[0].viewers).toEqual([]);
    expect(r.sweep(T0 + 999_999)).toEqual([]);
  });

  it("leave removes the viewer immediately", () => {
    const r = new PresenceRegistry();
    r.heartbeat("t1", "c1", ana, false, T0);
    r.heartbeat("t1", "c1", ben, false, T0);
    const s = r.leave("c1", "u_ana", T0 + 1);
    expect(s?.viewers.map((v) => v.userId)).toEqual(["u_ben"]);
    expect(r.leave("c_unknown", "u_ana", T0)).toBeNull();
  });

  it("keeps rooms per conversation", () => {
    const r = new PresenceRegistry();
    r.heartbeat("t1", "c1", ana, false, T0);
    r.heartbeat("t1", "c2", ben, true, T0);
    expect(r.viewers("c1", T0).map((v) => v.userId)).toEqual(["u_ana"]);
    expect(r.viewers("c2", T0)).toEqual([{ ...ben, typing: true }]);
    expect(r.viewers("c3", T0)).toEqual([]);
  });
});
