// Date/time formatting pinned to Albania's timezone.
//
// Why this exists: timestamps are stored in UTC (Prisma), and most dashboard
// pages are SERVER components that render on Vercel — whose timezone is UTC.
// A bare `new Date(x).toLocaleString()` therefore formats in UTC and shows
// times ~1–2h behind Albanian local time. Pinning `timeZone` makes the output
// correct regardless of where it renders (server or browser).

const TZ = "Europe/Tirane";
const LOCALE = "sq-AL";

/** e.g. "22 qer 2026, 14:35" — date + time, for inbox/leads timestamps. */
export function formatDateTime(value: string | Date | number): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 24-hour clock — no AM/PM
  });
}

/** e.g. "22 qer 2026" — date only, for trial end / day-level info. */
export function formatDate(value: string | Date | number): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** e.g. "14:35" — time only, for per-message timestamps in a thread. */
export function formatTime(value: string | Date | number): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 24-hour clock — no AM/PM
  });
}
