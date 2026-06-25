// Date/time formatting pinned to Albania's timezone, computed DETERMINISTICALLY
// so server (SSR) and client render byte-identical output — no hydration
// mismatch.
//
// Why not `toLocaleString("sq-AL", …)`: Node (full ICU) renders Albanian month
// names, but a browser may lack `sq-AL` data and fall back to English, so the
// two disagree. Instead we read NUMERIC parts via Intl (the timezone math is
// IANA-tz-data based and consistent everywhere) and format with our own
// Albanian month abbreviations.

const TZ = "Europe/Tirane";
const MONTHS = [
  "jan", "shk", "mar", "pri", "maj", "qer",
  "korr", "gush", "sht", "tet", "nën", "dhj",
];

function parts(value: string | Date | number): {
  y: string;
  mo: number;
  d: string;
  h: string;
  mi: string;
} {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(value))) m[p.type] = p.value;
  return { y: m.year, mo: Number(m.month), d: m.day, h: m.hour, mi: m.minute };
}

/** e.g. "24 qer 2026, 11:25" */
export function formatDateTime(value: string | Date | number): string {
  const { y, mo, d, h, mi } = parts(value);
  return `${d} ${MONTHS[mo - 1]} ${y}, ${h}:${mi}`;
}

/** e.g. "24 qer 2026" */
export function formatDate(value: string | Date | number): string {
  const { y, mo, d } = parts(value);
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

/** e.g. "11:25" */
export function formatTime(value: string | Date | number): string {
  const { h, mi } = parts(value);
  return `${h}:${mi}`;
}
