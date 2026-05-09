import "server-only";

type Bucket = { count: number; resetAt: number };

const bucketKey = Symbol.for("lidh.demo.preset.ratelimit");
type GlobalWithBucket = typeof globalThis & {
  [bucketKey]?: Map<string, Bucket>;
};
const g = globalThis as GlobalWithBucket;
const buckets: Map<string, Bucket> =
  g[bucketKey] ?? (g[bucketKey] = new Map<string, Bucket>());

const IP_LIMIT = 100;
const IP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function checkPresetRateLimit(
  slug: string,
  ip: string,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const key = `${slug}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + IP_WINDOW_MS });
    return { ok: true };
  }
  if (existing.count >= IP_LIMIT) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { ok: true };
}
