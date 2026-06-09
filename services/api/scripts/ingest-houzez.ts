/**
 * Houzez real-estate ingest (ADR-016) — populates the Property table for a
 * tenant by scraping a Houzez WordPress site (e.g. belarealestate.al).
 *
 * Why a standalone script (not the prose crawler): the platform crawler caps
 * at ~25 pages, has no pagination, and dissolves structured fields into text.
 * This script instead enumerates every listing from the WP property sitemaps,
 * filters to the cities we want, parses each detail page's clean key/value
 * table into typed columns, and upserts by externalId (re-runnable).
 *
 * Usage (from repo root):
 *   TENANT_SLUG=bela-real-estate PER_CITY_CAP=250 \
 *     pnpm --filter @lidh/api exec tsx scripts/ingest-houzez.ts
 *
 * Env:
 *   TENANT_SLUG   tenant to attach properties to (must already exist)
 *   BASE_URL      site root (default https://belarealestate.al)
 *   PER_CITY_CAP  max listings per city for the demo (default 250; 0 = no cap)
 */
import { PrismaClient, type PropertyListingType } from "@lidh/db";
import * as cheerio from "cheerio";

const TENANT_SLUG = process.env.TENANT_SLUG ?? "bela-real-estate";
const BASE = (process.env.BASE_URL ?? "https://belarealestate.al").replace(
  /\/$/,
  "",
);
const PER_CITY_CAP = Number(process.env.PER_CITY_CAP ?? 250);
const CONCURRENCY = 4;
const UA = "Mozilla/5.0 (compatible; LidhBot/1.0; +https://lidh.al)";

// URL-slug city suffix -> canonical stored city. Only these cities are ingested.
const CITY_BY_SLUG: Record<string, string> = {
  tirane: "Tiranë",
  durres: "Durrës",
};

interface PropertyInput {
  externalId: string;
  title: string;
  listingType: PropertyListingType;
  propertyType: string;
  city: string;
  area: string | null;
  address: string | null;
  priceEur: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  floor: number | null;
  description: string | null;
  sourceUrl: string;
  photoUrl: string | null;
}

async function fetchText(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "sq,en" },
        redirect: "follow",
      });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {
      // network blip — retry
    }
    await sleep(400 * (i + 1));
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Collect every property URL from the WP property sitemaps, keep only the
 *  cities we ingest (by URL-slug suffix). */
async function enumerateUrls(): Promise<{ url: string; city: string }[]> {
  const out: { url: string; city: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const sm = `${BASE}/wp-sitemap-posts-property-${i}.xml`;
    const xml = await fetchText(sm);
    if (!xml) break; // no more sitemap pages
    const locs = xml.match(/<loc>([^<]+)<\/loc>/g) ?? [];
    for (const loc of locs) {
      const url = loc.replace(/<\/?loc>/g, "").trim();
      const m = url.match(/-(tirane|durres)\/?$/i);
      if (m) out.push({ url, city: CITY_BY_SLUG[m[1].toLowerCase()] });
    }
  }
  return out;
}

// Parse the FIRST number token in a string, treating , and . as thousands
// separators. "87 m2" -> 87, "€1,000" -> 1000, "1.000" -> 1000.
const digits = (s: string | undefined): number | null => {
  if (!s) return null;
  const m = s.match(/\d[\d.,]*\d|\d/);
  if (!m) return null;
  const n = Number(m[0].replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function parseDetail(
  html: string,
  url: string,
  city: string,
): PropertyInput | null {
  const $ = cheerio.load(html);

  // Houzez detail table: each <li> is "Label Value" in clean text.
  const kv: Record<string, string> = {};
  const apply = (t: string) => {
    for (const [key, re] of LABELS) {
      const mm = t.match(re);
      if (mm && kv[key] === undefined) kv[key] = mm[1].trim();
    }
  };
  $(".detail-wrap li, .property-detail-wrap li, .detail-list li").each(
    (_, el) => apply($(el).text().trim().replace(/\s+/g, " ")),
  );
  // Fallback for older/alternate layouts: scan the whole page text for any
  // labels the structured list didn't yield.
  if (kv.price === undefined || kv.bedrooms === undefined || kv.type === undefined) {
    apply($("body").text().replace(/\s+/g, " "));
  }

  const externalId = (
    kv.id ??
    url.match(/id-([a-z0-9]+)-(?:tirane|durres)\/?$/i)?.[1] ??
    url.match(/-(b[a-z0-9]+)-(?:tirane|durres)\/?$/i)?.[1] ??
    ""
  ).toUpperCase();
  if (!externalId) return null;

  const title =
    $("h1").first().text().trim().replace(/\s+/g, " ") ||
    $("title").first().text().trim();

  const statusText = (kv.status ?? "").toLowerCase();
  const titleLc = title.toLowerCase();
  const isRent =
    statusText.includes("qera") || titleLc.includes("qera"); // "Për Qera" / "Me Qera"
  const listingType: PropertyListingType = isRent ? "rent" : "sale";

  const address =
    $(".property-address, .item-address, address")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ") || null;
  const area = address ? (address.split(",")[0]?.trim() || null) : null;

  const description =
    $("#property-description-wrap, .property-description, .block-content-wrap")
      .first()
      .text()
      .replace(/^\s*Description\s*/i, "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 2000) || null;

  const photoUrl =
    $('meta[property="og:image"]').attr("content") ??
    $(".houzez-gallery img, .property-gallery img").first().attr("src") ??
    null;

  return {
    externalId,
    title: title || `Property ${externalId}`,
    listingType,
    propertyType: kv.type || propertyTypeFromTitle(titleLc),
    city,
    area,
    address,
    priceEur: digits(kv.price),
    bedrooms: digits(kv.bedrooms),
    bathrooms: digits(kv.bathrooms),
    areaSqm: digits(kv.size),
    floor: digits(kv.floor),
    description,
    sourceUrl: url,
    photoUrl,
  };
}

/** Best-effort property category from the Albanian title when the detail
 *  table didn't expose "Property Type". */
function propertyTypeFromTitle(titleLc: string): string {
  if (titleLc.includes("apartament")) return "Apartamente";
  if (titleLc.includes("vil")) return "Vilë";
  if (titleLc.includes("magazin")) return "Magazinë";
  if (titleLc.includes("zyr")) return "Zyrë";
  if (titleLc.includes("dyqan") || titleLc.includes("lokal")) return "Dyqan";
  if (titleLc.includes("tok") || titleLc.includes("truall")) return "Tokë";
  if (titleLc.includes("garazh")) return "Garazh";
  if (titleLc.includes("servis")) return "Servis";
  if (titleLc.includes("shtëpi") || titleLc.includes("shtepi")) return "Shtëpi";
  return "Pronë";
}

// Ordered label matchers — check Bedrooms before Rooms, etc.
const LABELS: [string, RegExp][] = [
  ["id", /Property ID\s+(.+)/i],
  ["price", /Price\s+(.+)/i],
  ["size", /(?:Property Size|Size|Sip[eë]rfaqe)\s+(.+)/i],
  ["bedrooms", /Bedrooms?\s+(\d+)/i],
  ["bathrooms", /Bathrooms?\s+(\d+)/i],
  ["type", /Property Type\s+(.+)/i],
  ["status", /Property Status\s+(.+)/i],
  ["floor", /Floor(?:\s*Nr)?\s+(\d+)/i],
];

async function pool<T>(
  items: T[],
  worker: (item: T, i: number) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i], i);
      await sleep(120); // be polite
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true, name: true },
    });
    if (!tenant) {
      throw new Error(
        `Tenant "${TENANT_SLUG}" not found — create it first, then re-run.`,
      );
    }
    console.log(`Ingesting into tenant ${tenant.name} (${tenant.id})`);

    console.log("Enumerating property URLs from sitemaps…");
    const all = await enumerateUrls();
    // Cap per city for the demo.
    const byCity: Record<string, { url: string; city: string }[]> = {};
    for (const it of all) (byCity[it.city] ??= []).push(it);
    const selected: { url: string; city: string }[] = [];
    for (const [city, list] of Object.entries(byCity)) {
      const take = PER_CITY_CAP > 0 ? list.slice(0, PER_CITY_CAP) : list;
      console.log(`  ${city}: ${list.length} found, ingesting ${take.length}`);
      selected.push(...take);
    }

    let ok = 0;
    let fail = 0;
    await pool(selected, async ({ url, city }, i) => {
      const html = await fetchText(url);
      if (!html) {
        fail++;
        return;
      }
      const p = parseDetail(html, url, city);
      if (!p) {
        fail++;
        return;
      }
      await prisma.property.upsert({
        where: { tenantId_externalId: { tenantId: tenant.id, externalId: p.externalId } },
        create: { tenantId: tenant.id, ...p },
        update: { ...p, status: "available" },
      });
      ok++;
      if ((i + 1) % 25 === 0) {
        console.log(`  …${i + 1}/${selected.length} (ok ${ok}, fail ${fail})`);
      }
    });

    const total = await prisma.property.count({ where: { tenantId: tenant.id } });
    console.log(`\nDone. upserted ok=${ok} fail=${fail}. Tenant now has ${total} properties.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
