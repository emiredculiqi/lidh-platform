/**
 * Who answers a conversation right now — the human team or the assistant.
 *
 * Built like `entitlements.ts`: a pure resolver over plain data plus the clock,
 * no DB, no side effects, injectable time for tests. Both runtimes and the
 * dashboard read the same function, so there is one definition of "is the
 * assistant on" (ADR-020; ADR-018 Decision 2 says human is Level 0, the default).
 *
 * Layers, high → low:
 *   1. Conversation.aiOverride — a human took over (`human`) or handed the
 *      thread to the assistant (`ai`). Wins until cleared; a takeover never
 *      silently ends because the clock hit 18:00.
 *   2. Tenant.settings.responder.mode — `human` (default), `ai` (always, the
 *      "activate now" switch), or `schedule`.
 *   3. The schedule: weekly windows in the business's timezone during which
 *      the assistant answers. Outside them, humans.
 */

export type Responder = "human" | "ai";
export type ResponderMode = "human" | "ai" | "schedule";

/** A weekly window. `days` are ISO weekdays, 1 = Monday … 7 = Sunday.
 *  `from`/`to` are "HH:MM" local time; `to` <= `from` wraps past midnight
 *  ("18:00" → "09:00" = evening through next morning). "24:00" is accepted
 *  as end-of-day. */
export interface ResponderWindow {
  days: number[];
  from: string;
  to: string;
}

export interface ResponderSettings {
  mode: ResponderMode;
  /** IANA zone the windows are expressed in. */
  timezone: string;
  windows: ResponderWindow[];
}

export const DEFAULT_TIMEZONE = "Europe/Tirane";

/** Pre-filled when a business first switches to `schedule`: assistant covers
 *  weekday evenings/nights and the whole weekend — the after-hours wedge. */
export const DEFAULT_WINDOWS: ResponderWindow[] = [
  { days: [1, 2, 3, 4, 5], from: "18:00", to: "09:00" },
  { days: [6, 7], from: "00:00", to: "24:00" },
];

const HHMM = /^([01]\d|2[0-4]):([0-5]\d)$/;

function toMinutes(hhmm: string): number | null {
  const m = HHMM.exec(hhmm);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v > 24 * 60 ? null : v;
}

function isValidWindow(w: unknown): w is ResponderWindow {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    Array.isArray(o.days) &&
    o.days.length > 0 &&
    o.days.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7) &&
    typeof o.from === "string" &&
    typeof o.to === "string" &&
    toMinutes(o.from) !== null &&
    toMinutes(o.to) !== null
  );
}

/**
 * Read the responder block out of Tenant.settings, tolerating absence and
 * garbage. Absent → human (the ADR-018 default). Invalid windows are dropped
 * rather than failing the whole read — a broken settings row must never make
 * the runtime throw on a customer message.
 */
export function readResponderSettings(settings: unknown): ResponderSettings {
  const raw =
    settings && typeof settings === "object"
      ? (settings as { responder?: unknown }).responder
      : undefined;
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode: ResponderMode =
    r.mode === "ai" || r.mode === "schedule" ? r.mode : "human";
  const timezone =
    typeof r.timezone === "string" && r.timezone.trim()
      ? r.timezone.trim()
      : DEFAULT_TIMEZONE;
  const windows = Array.isArray(r.windows)
    ? r.windows.filter(isValidWindow)
    : [];
  return { mode, timezone, windows };
}

/** Local weekday (ISO 1–7) and minutes-since-midnight for `now` in `timezone`.
 *  Falls back to UTC if the zone is unknown to this runtime. */
function localClock(now: Date, timezone: string): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const DAYS: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const day = DAYS[get("weekday")] ?? 1;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return { day, minutes };
}

/** Is `now` inside any window? Overnight windows (`to` <= `from`) span from
 *  `from` on a listed day through `to` on the following morning. */
export function isInsideWindows(
  windows: ResponderWindow[],
  timezone: string,
  now: Date,
): boolean {
  if (windows.length === 0) return false;
  const { day, minutes } = localClock(now, timezone);
  const yesterday = day === 1 ? 7 : day - 1;
  for (const w of windows) {
    const from = toMinutes(w.from);
    const to = toMinutes(w.to);
    if (from === null || to === null) continue;
    if (to > from) {
      // Same-day window.
      if (w.days.includes(day) && minutes >= from && minutes < to) return true;
    } else {
      // Wraps midnight: the evening part on a listed day …
      if (w.days.includes(day) && minutes >= from) return true;
      // … and the morning part on the day after a listed day.
      if (w.days.includes(yesterday) && minutes < to) return true;
    }
  }
  return false;
}

/** The business-level answer, ignoring any per-conversation override. */
export function resolveResponder(
  settings: ResponderSettings,
  now: Date = new Date(),
): Responder {
  switch (settings.mode) {
    case "ai":
      return "ai";
    case "schedule":
      return isInsideWindows(settings.windows, settings.timezone, now) ? "ai" : "human";
    default:
      return "human";
  }
}

/** The answer for one conversation: its override if set, else the business's. */
export function effectiveResponder(
  settings: ResponderSettings,
  override: Responder | null | undefined,
  now: Date = new Date(),
): Responder {
  return override ?? resolveResponder(settings, now);
}
