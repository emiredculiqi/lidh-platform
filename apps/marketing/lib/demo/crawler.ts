import "server-only";
import * as cheerio from "cheerio";

export const MAX_PAGES = 15;
export const MAX_TOTAL_CHARS = 150_000;
export const PER_PAGE_CHAR_CAP = 10_000;
export const FETCH_TIMEOUT_MS = 8_000;
export const FETCH_CONCURRENCY = 5;
const PRIORITY_KEYWORDS = [
  "about",
  "rreth",
  "service",
  "shërbim",
  "sherbim",
  "product",
  "produkt",
  "pricing",
  "çmim",
  "cmim",
  "price",
  "contact",
  "kontakt",
  "faq",
  "pyetje",
  "team",
  "ekip",
  "menu",
  "shop",
  "store",
  "blog",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export type CrawledPage = {
  url: string;
  title: string;
  text: string;
};

export type CrawlResult = {
  origin: string;
  pages: CrawledPage[];
};

export class CrawlError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_url"
      | "unreachable"
      | "blocked"
      | "bot_protected"
      | "too_large"
      | "empty",
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

function detectBotProtection(html: string): string | null {
  const sample = html.slice(0, 4000).toLowerCase();
  if (sample.includes("_incapsula_resource") || sample.includes("incapsula incident"))
    return "Incapsula";
  if (
    sample.includes("cf-browser-verification") ||
    sample.includes("cf_chl_opt") ||
    sample.includes("__cf_chl_") ||
    (sample.includes("cloudflare") && sample.includes("just a moment"))
  )
    return "Cloudflare";
  if (sample.includes("akamai bot manager") || sample.includes("ak_bmsc"))
    return "Akamai";
  if (sample.includes("perimeterx") || sample.includes("_pxhd"))
    return "PerimeterX";
  if (sample.includes("datadome")) return "DataDome";
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

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CrawlError("only http(s) urls are allowed", "invalid_url");
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    throw new CrawlError("non-public host blocked", "blocked");
  }

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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sq,en;q=0.9,it;q=0.8,*;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) {
      throw new CrawlError(`http ${res.status}`, "unreachable");
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new CrawlError("not html", "unreachable");
    }
    const text = await res.text();
    if (text.length > 2_000_000) {
      throw new CrawlError("page too large", "too_large");
    }
    return text;
  } catch (err) {
    if (err instanceof CrawlError) throw err;
    throw new CrawlError(
      err instanceof Error ? err.message : "fetch failed",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

function extractReadable(
  html: string,
  url: string,
): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || url;

  const parts: string[] = [];

  const metaSelectors = [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:site_name"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="keywords"]',
    'meta[name="author"]',
  ];
  for (const sel of metaSelectors) {
    const content = $(sel).attr("content")?.trim();
    if (content) parts.push(content);
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    const flattened = flattenJsonLd(raw);
    if (flattened) parts.push(flattened);
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

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText) parts.push(bodyText);

  const seen = new Set<string>();
  const deduped = parts.filter((p) => {
    const key = p.slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const text = deduped.join("\n").slice(0, PER_PAGE_CHAR_CAP);
  return { title, text };
}

function flattenJsonLd(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const out: string[] = [];
    collectStrings(parsed, out);
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
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStrings(v, out);
    }
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
    if (key === origin.toString()) return;
    if (seen.has(key)) return;
    if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3)$/i.test(abs.pathname)) {
      return;
    }
    seen.add(key);
    out.push(key);
  });

  return out;
}

function scoreLink(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  for (const kw of PRIORITY_KEYWORDS) {
    if (lower.includes(kw)) score += 10;
  }
  const path = lower.replace(/^https?:\/\/[^/]+/, "");
  const segments = path.split("/").filter(Boolean).length;
  score -= segments;
  if (/\?|#/.test(url)) score -= 2;
  return score;
}

function prioritizeLinks(links: string[]): string[] {
  return [...new Set(links)]
    .map((u) => ({ u, s: scoreLink(u) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.u);
}

async function fetchSitemapUrls(origin: URL): Promise<string[]> {
  const candidates = [
    new URL("/sitemap.xml", origin).toString(),
    new URL("/sitemap_index.xml", origin).toString(),
  ];

  for (const url of candidates) {
    try {
      const xml = await fetchText(url);
      if (!xml) continue;
      const urls = parseSitemap(xml, origin);
      if (urls.length > 0) {
        if (urls.some((u) => u.endsWith(".xml"))) {
          const subUrls: string[] = [];
          for (const sub of urls.slice(0, 3)) {
            try {
              const subXml = await fetchText(sub);
              subUrls.push(...parseSitemap(subXml, origin));
            } catch {}
            if (subUrls.length >= 200) break;
          }
          return dedupe(subUrls.filter((u) => !u.endsWith(".xml")));
        }
        return dedupe(urls);
      }
    } catch {}
  }
  return [];
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml,text/xml,*/*;q=0.5",
        "Accept-Language": "sq,en;q=0.9,*;q=0.5",
      },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function parseSitemap(xml: string, origin: URL): string[] {
  const out: string[] = [];
  const re = /<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const raw = match[1].trim();
    try {
      const abs = new URL(raw, origin);
      if (abs.hostname.toLowerCase() !== origin.hostname.toLowerCase()) continue;
      if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|svg|mp4|mp3|css|js)$/i.test(abs.pathname))
        continue;
      abs.hash = "";
      out.push(abs.toString());
    } catch {}
  }
  return out;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

async function fetchInBatches(
  urls: string[],
  concurrency: number,
): Promise<Array<{ url: string; html: string } | null>> {
  const results: Array<{ url: string; html: string } | null> = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (url) => ({ url, html: await fetchHtml(url) })),
    );
    for (const r of settled) {
      results.push(r.status === "fulfilled" ? r.value : null);
    }
  }
  return results;
}

export async function crawlSite(input: string): Promise<CrawlResult> {
  const origin = normalizeUrl(input);
  const homepageHtml = await fetchHtml(origin.toString());

  const wafVendor = detectBotProtection(homepageHtml);
  if (wafVendor) {
    throw new CrawlError(
      `site is behind ${wafVendor} bot protection`,
      "bot_protected",
    );
  }

  const homepage = extractReadable(homepageHtml, origin.toString());

  const sitemapUrls = await fetchSitemapUrls(origin);
  const homepageLinks = collectInternalLinks(homepageHtml, origin);

  const candidatePool = dedupe([...sitemapUrls, ...homepageLinks]).filter(
    (u) => u !== origin.toString(),
  );

  const ordered = prioritizeLinks(candidatePool).slice(0, MAX_PAGES - 1);

  const fetched = await fetchInBatches(ordered, FETCH_CONCURRENCY);

  const pages: CrawledPage[] = [
    { url: origin.toString(), ...homepage },
  ];

  let totalChars = homepage.text.length;

  for (const result of fetched) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    if (!result) continue;
    const extracted = extractReadable(result.html, result.url);
    if (!extracted.text) continue;
    const remaining = MAX_TOTAL_CHARS - totalChars;
    const trimmed = extracted.text.slice(0, remaining);
    pages.push({ url: result.url, title: extracted.title, text: trimmed });
    totalChars += trimmed.length;
  }

  if (totalChars < 30) {
    throw new CrawlError("no readable content found", "empty");
  }

  return { origin: origin.toString(), pages };
}
