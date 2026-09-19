import { describe, it, expect } from "vitest";
import {
  DEFAULT_WINDOWS,
  effectiveResponder,
  isInsideWindows,
  readResponderSettings,
  resolveResponder,
  type ResponderSettings,
} from "./responder";

// Tirana is UTC+2 in September (CEST). Build instants from local wall time.
const tirana = (isoLocal: string) => new Date(`${isoLocal}+02:00`);

const schedule: ResponderSettings = {
  mode: "schedule",
  timezone: "Europe/Tirane",
  windows: DEFAULT_WINDOWS,
};

describe("readResponderSettings", () => {
  it("defaults to human when the block is absent — ADR-018 Level 0", () => {
    expect(readResponderSettings({}).mode).toBe("human");
    expect(readResponderSettings(null).mode).toBe("human");
    expect(readResponderSettings({ businessFacts: "x" }).mode).toBe("human");
  });

  it("honours the backfilled 'ai' mode for existing tenants", () => {
    expect(readResponderSettings({ responder: { mode: "ai" } }).mode).toBe("ai");
  });

  it("drops invalid windows instead of throwing", () => {
    const s = readResponderSettings({
      responder: {
        mode: "schedule",
        windows: [
          { days: [1], from: "18:00", to: "09:00" },
          { days: [9], from: "18:00", to: "09:00" },   // bad day
          { days: [1], from: "25:00", to: "09:00" },   // bad time
          "garbage",
        ],
      },
    });
    expect(s.windows).toHaveLength(1);
  });

  it("falls back to Europe/Tirane for the timezone", () => {
    expect(readResponderSettings({ responder: { mode: "schedule" } }).timezone).toBe(
      "Europe/Tirane",
    );
  });
});

describe("resolveResponder", () => {
  it("human mode is always human, ai mode is always ai", () => {
    const base = { timezone: "Europe/Tirane", windows: DEFAULT_WINDOWS };
    expect(resolveResponder({ ...base, mode: "human" }, tirana("2026-09-16T02:00:00"))).toBe("human");
    expect(resolveResponder({ ...base, mode: "ai" }, tirana("2026-09-16T12:00:00"))).toBe("ai");
  });

  describe("default schedule — weekday evenings + weekends", () => {
    it("weekday working hours → human", () => {
      expect(resolveResponder(schedule, tirana("2026-09-16T10:30:00"))).toBe("human"); // Wed
    });
    it("weekday evening → ai", () => {
      expect(resolveResponder(schedule, tirana("2026-09-16T19:00:00"))).toBe("ai");
    });
    it("the wrapped morning after a weekday → ai until 09:00", () => {
      expect(resolveResponder(schedule, tirana("2026-09-17T02:00:00"))).toBe("ai");   // Thu 02:00
      expect(resolveResponder(schedule, tirana("2026-09-17T08:59:00"))).toBe("ai");
      expect(resolveResponder(schedule, tirana("2026-09-17T09:00:00"))).toBe("human");
    });
    it("Saturday midday → ai (whole weekend)", () => {
      expect(resolveResponder(schedule, tirana("2026-09-19T12:00:00"))).toBe("ai");   // Sat
    });
    it("Monday 08:00 → human — nothing carries over from Sunday's all-day window", () => {
      // Sunday's window ends at 24:00, Friday's overnight window covers Sat
      // morning; Monday 08:00 is covered by nothing → human. Guards against
      // the wrap logic leaking across a day it shouldn't.
      expect(resolveResponder(schedule, tirana("2026-09-21T08:00:00"))).toBe("human"); // Mon
    });
  });

  it("evaluates in the business's timezone, not the server's", () => {
    // 20:00 in Tirana is 18:00 UTC. A UTC-based read would say "inside the
    // window" for a business in a zone where it's still afternoon.
    const s: ResponderSettings = {
      mode: "schedule",
      timezone: "America/New_York",   // 14:00 there at 18:00 UTC in September
      windows: [{ days: [1, 2, 3, 4, 5], from: "18:00", to: "09:00" }],
    };
    expect(resolveResponder(s, new Date("2026-09-16T18:00:00Z"))).toBe("human");
    expect(resolveResponder(schedule, new Date("2026-09-16T18:00:00Z"))).toBe("ai");
  });

  it("an unknown timezone falls back to UTC instead of throwing", () => {
    const s: ResponderSettings = { ...schedule, timezone: "Not/AZone" };
    expect(() => resolveResponder(s, new Date())).not.toThrow();
  });
});

describe("effectiveResponder — the per-conversation override wins", () => {
  it("a takeover stays human even inside an AI window", () => {
    expect(effectiveResponder(schedule, "human", tirana("2026-09-16T22:00:00"))).toBe("human");
  });
  it("handing a thread to the assistant works even in human mode", () => {
    const human: ResponderSettings = { ...schedule, mode: "human" };
    expect(effectiveResponder(human, "ai", tirana("2026-09-16T10:00:00"))).toBe("ai");
  });
  it("no override → the business setting decides", () => {
    expect(effectiveResponder(schedule, null, tirana("2026-09-16T10:00:00"))).toBe("human");
    expect(effectiveResponder(schedule, undefined, tirana("2026-09-16T22:00:00"))).toBe("ai");
  });
});

describe("isInsideWindows edge cases", () => {
  it("empty windows are never inside", () => {
    expect(isInsideWindows([], "Europe/Tirane", new Date())).toBe(false);
  });
  it("'24:00' means end of day for an all-day window", () => {
    const w = [{ days: [7], from: "00:00", to: "24:00" }];
    expect(isInsideWindows(w, "Europe/Tirane", tirana("2026-09-20T23:59:00"))).toBe(true); // Sun
    expect(isInsideWindows(w, "Europe/Tirane", tirana("2026-09-21T00:00:00"))).toBe(false); // Mon
  });
});
