import "server-only";

type Bucket = { count: number; resetAt: number };

const ipKey = Symbol.for("lidh.demo.ratelimit.ip");
const emailKey = Symbol.for("lidh.demo.ratelimit.email");
type GlobalWithBuckets = typeof globalThis & {
  [ipKey]?: Map<string, Bucket>;
  [emailKey]?: Map<string, Bucket>;
};
const g = globalThis as GlobalWithBuckets;
const ipBuckets: Map<string, Bucket> =
  g[ipKey] ?? (g[ipKey] = new Map<string, Bucket>());
const emailBuckets: Map<string, Bucket> =
  g[emailKey] ?? (g[emailKey] = new Map<string, Bucket>());

const IP_LIMIT = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 2;
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

function check(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now >= existing.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { ok: true };
}

export function checkRateLimit(
  ip: string,
  email: string,
): { ok: true } | { ok: false; reason: "ip" | "email"; retryAfterMs: number } {
  const ipResult = check(ipBuckets, ip, IP_LIMIT, IP_WINDOW_MS);
  if (!ipResult.ok) {
    return { ok: false, reason: "ip", retryAfterMs: ipResult.retryAfterMs! };
  }
  const emailKey = email.trim().toLowerCase();
  const emailResult = check(
    emailBuckets,
    emailKey,
    EMAIL_LIMIT,
    EMAIL_WINDOW_MS,
  );
  if (!emailResult.ok) {
    return {
      ok: false,
      reason: "email",
      retryAfterMs: emailResult.retryAfterMs!,
    };
  }
  return { ok: true };
}
