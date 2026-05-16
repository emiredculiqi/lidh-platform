import { Logger } from "@nestjs/common";

/**
 * Tier-2 fetcher: a real headless Chromium via Playwright. Rescues the
 * COMMON failure — JS-rendered SMB sites (Wix/Squarespace/modern frameworks)
 * where plain fetch gets an empty shell — and passes *weak* bot checks
 * (it's a real browser). NOT a universal WAF bypass (ADR-005): hardcore
 * Cloudflare-managed/DataDome still win → handled by the fail-loud UX.
 *
 * `playwright` is lazily imported the first time we escalate, so normal
 * (plain-fetch) crawls never load Chromium. One browser is reused for the
 * whole crawl; the caller MUST call closePlaywrightBrowser() afterwards
 * (KnowledgeService does, in a finally).
 */
const logger = new Logger("WebFetch:Playwright");

// Minimal structural types so this file doesn't hard-depend on playwright's
// types at compile time (the package is present, but keeps the import lazy).
type PwBrowser = { newPage: () => Promise<PwPage>; close: () => Promise<void> };
type PwPage = {
  goto: (url: string, opts: unknown) => Promise<unknown>;
  content: () => Promise<string>;
  close: () => Promise<void>;
};

let browserPromise: Promise<PwBrowser> | null = null;

async function getBrowser(): Promise<PwBrowser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = (await import("playwright")) as {
        chromium: {
          launch: (o: unknown) => Promise<PwBrowser>;
        };
      };
      logger.log("launching headless Chromium (escalated fetch)");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
    })();
  }
  return browserPromise;
}

/** Fetch fully-rendered HTML for one URL. Throws on failure (the crawler
 *  maps that to a CrawlError → friendly message). */
export async function playwrightFetch(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Small settle for client-rendered content to paint.
    await new Promise((r) => setTimeout(r, 1500));
    return await page.content();
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Close the shared browser. Idempotent; safe to call when never launched. */
export async function closePlaywrightBrowser(): Promise<void> {
  if (!browserPromise) return;
  const p = browserPromise;
  browserPromise = null;
  try {
    const browser = await p;
    await browser.close();
  } catch {
    /* already gone */
  }
}
