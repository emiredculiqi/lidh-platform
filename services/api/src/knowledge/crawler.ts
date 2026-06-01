// Adapted from the lidh.al marketing site's demo crawler (battle-tested),
// with the Next.js `import "server-only"` removed — this is plain Node/TS.
// The marketing site lives in its own repo (ADR-012); the two crawlers
// evolve independently from here.
import * as cheerio from "cheerio";

export const MAX_PAGES = 25;
export const MAX_TOTAL_CHARS = 150_000;
export const PER_PAGE_CHAR_CAP = 10_000;
export const FETCH_TIMEOUT_MS = 8_000;
export const FETCH_CONCURRENCY = 5;

const PRIORITY_KEYWORDS = [
  "about", "rreth", "service", "shërbim", "sherbim", "product", "produkt",
  "pricing", "çmim", "cmim", "price", "contact", "kontakt", "faq", "pyetje",
  "team", "ekip", "menu", "shop", "store", "blog",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export type CrawledPage = { url: string; title: string; text: string };
export type CrawlResult = { origin: string; pages: CrawledPage[] };

export class CrawlError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_url" | "unreachable" | "blocked"
      | "bot_protected" | "too_large" | "empty",
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

function detectBotProtection(html: string): string | null {
  const s = html.slice(0, 4000).toLowerCase();
  if (s.includes("_incapsula_resource") || s.includes("incapsula incident")) return "Incapsula";
  if (s.includes("cf-browser-verification") || s.includes("cf_chl_opt") ||
      s.includes("__cf_chl_") || (s.includes("cloudflare") && s.includes("just a moment"))) return "Cloudflare";
  if (s.includes("akamai bot manager") || s.includes("ak_bmsc")) return "Akamai";
  if (s.includes("perimeterx") || s.includes("_pxhd")) return "PerimeterX";
  if (s.includes("datadome")) return "DataDome";
  return null;
}

export function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!raw) throw new CrawlError("empty url", "invalid_url");
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CrawlError("invalid url", "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new CrawlError("only http(s) urls are allowed", "invalid_url");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host))
    throw new CrawlError("non-public host blocked", "blocked");
  return parsed;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sq,en;q=0.9,it;q=0.8,*;q=0.5",
      },
    });
    if (!res.ok) throw new CrawlError(`http ${res.status}`, "unreachable");
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) throw new CrawlError("not html", "unreachable");
    const text = await res.text();
    if (text.length > 2_000_000) throw new CrawlError("page too large", "too_large");
    return text;
  } catch (err) {
    if (err instanceof CrawlError) throw err;
    throw new CrawlError(err instanceof Error ? err.message : "fetch failed", "unreachable");
  } finally {
    clearTimeout(timer);
  }
}

function extractReadable(html: string, url: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || url;
  const parts: string[] = [];

  for (const sel of [
    'meta[name="description"]', 'meta[property="og:title"]',
    'meta[property="og:description"]', 'meta[property="og:site_name"]',
    'meta[name="twitter:title"]', 'meta[name="twitter:description"]',
    'meta[name="keywords"]', 'meta[name="author"]',
  ]) {
    const c = $(sel).attr("content")?.trim();
    if (c) parts.push(c);
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    const f = flattenJsonLd($(el).contents().text());
    if (f) parts.push(f);
  });

  $('script, style, noscript, svg, iframe, [aria-hidden="true"]').remove();
  $("h1, h2, h3, h4").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) parts.push(t);
  });
  $("img[alt]").each((_, el) => {
    const t = $(el).attr("alt")?.trim();
    if (t) parts.push(t);
  });
  $("a[href]").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 1 && t.length < 80) parts.push(t);
  });
  const body = $("body").text().replace(/\s+/g, " ").trim();
  if (body) parts.push(body);

  const seen = new Set<string>();
  const deduped = parts.filter((p) => {
    const k = p.slice(0, 200);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { title, text: deduped.join("\n").slice(0, PER_PAGE_CHAR_CAP) };
}

function flattenJsonLd(raw: string): string {
  try {
    const out: string[] = [];
    collectStrings(JSON.parse(raw), out);
    return out.slice(0, 80).join(" ").slice(0, 4000);
  } catch {
    return "";
  }
}
function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    const s = node.trim();
    if (s && s.length < 500) out.push(s);
  } else if (Array.isArray(node)) {
    for (const n of node) collectStrings(n, out);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) collectStrings(v, out);
  }
}

function collectInternalLinks(html: string, origin: URL): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      return;
    }
    if (abs.hostname.toLowerCase() !== origin.hostname.toLowerCase()) return;
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    abs.hash = "";
    const key = abs.toString();
    if (key === origin.toString() || seen.has(key)) return;
    if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3)$/i.test(abs.pathname)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

function scoreLink(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  for (const kw of PRIORITY_KEYWORDS) if (lower.includes(kw)) score += 10;
  score -= lower.replace(/^https?:\/\/[^/]+/, "").split("/").filter(Boolean).length;
  if (/\?|#/.test(url)) score -= 2;
  return score;
}
function prioritizeLinks(links: string[]): string[] {
  return [...new Set(links)]
    .map((u) => ({ u, s: scoreLink(u) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.u);
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*;q=0.5" },
    });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
function parseSitemap(xml: string, origin: URL): string[] {
  const out: string[] = [];
  const re = /<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    try {
      const abs = new URL(m[1].trim(), origin);
      if (abs.hostname.toLowerCase() !== origin.hostname.toLowerCase()) continue;
      if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3|css|js)$/i.test(abs.pathname)) continue;
      abs.hash = "";
      out.push(abs.toString());
    } catch {
      /* skip */
    }
  }
  return out;
}
/** robots.txt usually declares the real sitemap location (esp. CMS sites
 *  that don't use /sitemap.xml). This is the single biggest "find all pages"
 *  win — read it before guessing standard paths. */
async function fetchRobotsSitemaps(origin: URL): Promise<string[]> {
  try {
    const txt = await fetchText(new URL("/robots.txt", origin).toString());
    if (!txt) return [];
    const out: string[] = [];
    const re = /^\s*sitemap:\s*(\S+)\s*$/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) !== null) {
      try {
        const u = new URL(m[1], origin);
        if (u.hostname.toLowerCase() === origin.hostname.toLowerCase()) {
          out.push(u.toString());
        }
      } catch {
        /* skip malformed */
      }
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

async function fetchSitemapUrls(origin: URL): Promise<string[]> {
  // robots.txt-declared sitemaps first, then standard + common CMS paths.
  const candidates = [
    ...(await fetchRobotsSitemaps(origin)),
    new URL("/sitemap.xml", origin).toString(),
    new URL("/sitemap_index.xml", origin).toString(),
    new URL("/sitemap-index.xml", origin).toString(),
    new URL("/wp-sitemap.xml", origin).toString(),
    new URL("/sitemap/sitemap.xml", origin).toString(),
  ];
  for (const url of [...new Set(candidates)]) {
    try {
      const xml = await fetchText(url);
      if (!xml) continue;
      const urls = parseSitemap(xml, origin);
      if (urls.length === 0) continue;
      if (urls.some((u) => u.endsWith(".xml"))) {
        const sub: string[] = [];
        for (const s of urls.slice(0, 3)) {
          try {
            sub.push(...parseSitemap(await fetchText(s), origin));
          } catch {
            /* skip */
          }
          if (sub.length >= 200) break;
        }
        return [...new Set(sub.filter((u) => !u.endsWith(".xml")))];
      }
      return [...new Set(urls)];
    } catch {
      /* try next */
    }
  }
  return [];
}

/** Pluggable page fetcher (the FetchProvider port, ADR-005). Default = plain
 *  fetch; the service swaps in the Playwright fetcher on escalation. */
export type PageFetcher = (url: string) => Promise<string>;

async function fetchInBatches(
  urls: string[],
  concurrency: number,
  fetcher: PageFetcher,
): Promise<Array<{ url: string; html: string } | null>> {
  const results: Array<{ url: string; html: string } | null> = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const settled = await Promise.allSettled(
      urls.slice(i, i + concurrency).map(async (url) => ({
        url,
        html: await fetcher(url),
      })),
    );
    for (const r of settled) results.push(r.status === "fulfilled" ? r.value : null);
  }
  return results;
}

export interface CrawlOptions {
  /** Hard page cap (defaults to MAX_PAGES; per-plan override later). */
  maxPages?: number;
  /** Override the page fetcher (e.g. Playwright on escalation). Default =
   *  plain fetch. The crawl logic (sitemap, links, extraction) is identical
   *  regardless of how the HTML was obtained. */
  fetcher?: PageFetcher;
}

/**
 * Crawl: homepage → sitemap(+robots.txt)/homepage links → and then keep
 * harvesting internal links from each fetched page (depth-2+), prioritized,
 * until the page cap or the total-chars budget is hit. This finds pages that
 * are neither in a sitemap nor linked from the homepage.
 */
export async function crawlSite(
  input: string,
  opts: CrawlOptions = {},
): Promise<CrawlResult> {
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? MAX_PAGES, 50));
  const fetchPage: PageFetcher = opts.fetcher ?? fetchHtml;
  const origin = normalizeUrl(input);
  const homepageHtml = await fetchPage(origin.toString());

  const waf = detectBotProtection(homepageHtml);
  if (waf) throw new CrawlError(`site is behind ${waf} bot protection`, "bot_protected");

  const homepage = extractReadable(homepageHtml, origin.toString());
  const pages: CrawledPage[] = [{ url: origin.toString(), ...homepage }];
  let total = homepage.text.length;

  const visited = new Set<string>([origin.toString()]);
  let frontier = prioritizeLinks(
    [
      ...new Set([
        ...(await fetchSitemapUrls(origin)),
        ...collectInternalLinks(homepageHtml, origin),
      ]),
    ].filter((u) => !visited.has(u)),
  );

  while (
    pages.length < maxPages &&
    total < MAX_TOTAL_CHARS &&
    frontier.length > 0
  ) {
    const batch = frontier
      .slice(0, FETCH_CONCURRENCY)
      .filter((u) => !visited.has(u));
    frontier = frontier.slice(FETCH_CONCURRENCY);
    for (const u of batch) visited.add(u);

    const fetched = await fetchInBatches(batch, FETCH_CONCURRENCY, fetchPage);
    const harvested: string[] = [];
    for (const r of fetched) {
      if (pages.length >= maxPages || total >= MAX_TOTAL_CHARS) break;
      if (!r) continue;
      const ex = extractReadable(r.html, r.url);
      if (!ex.text) continue;
      const trimmed = ex.text.slice(0, MAX_TOTAL_CHARS - total);
      pages.push({ url: r.url, title: ex.title, text: trimmed });
      total += trimmed.length;
      // Depth-2+: queue this page's internal links too.
      for (const l of collectInternalLinks(r.html, origin)) {
        if (!visited.has(l)) harvested.push(l);
      }
    }
    if (harvested.length) {
      frontier = prioritizeLinks([
        ...new Set([...frontier, ...harvested]),
      ]);
    }
  }

  if (total < 30) throw new CrawlError("no readable content found", "empty");
  return { origin: origin.toString(), pages };
}
