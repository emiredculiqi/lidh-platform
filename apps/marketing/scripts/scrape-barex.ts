/**
 * Scrapes barexitaliana.al via its public JSON API and writes a DemoPreset
 * to content/demos/barexitaliana.json.
 *
 * Run:  npm run scrape:barex
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://barexitaliana.al/api";
const KEY = "o0b14hv0-f4d3-84j8-6411-c818t30757l380925";
const ORIGIN = "https://barexitaliana.al";
const SLUG = "barexitaliana";

type AnyRec = Record<string, any>;

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": KEY,
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function flattenCategories(nodes: AnyRec[]): AnyRec[] {
  const out: AnyRec[] = [];
  const walk = (ns: AnyRec[]) => {
    for (const n of ns) {
      out.push(n);
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

async function main() {
  console.log("→ /frontend/setting");
  const setting = (await api<{ data: AnyRec }>("/frontend/setting")).data;

  console.log("→ /frontend/product-category/tree");
  const categoriesTree = await api<AnyRec[]>("/frontend/product-category/tree");
  const categories = flattenCategories(categoriesTree);

  console.log("→ /frontend/page");
  const cmsPages = (await api<{ data: AnyRec[] }>("/frontend/page")).data ?? [];

  console.log("→ /frontend/product?per_page=200");
  const productList =
    (await api<{ data: AnyRec[] }>("/frontend/product?per_page=200")).data ?? [];
  console.log(`  ${productList.length} products in catalog`);

  console.log("→ /frontend/product/show/{slug} (per product)");
  const products: AnyRec[] = [];
  for (let i = 0; i < productList.length; i++) {
    const p = productList[i];
    try {
      const detail = await api<{ data: AnyRec }>(
        `/frontend/product/show/${encodeURIComponent(p.slug)}`,
      );
      products.push(detail.data);
      process.stdout.write(`\r  ${i + 1}/${productList.length}`);
    } catch (err) {
      console.warn(`\n  product ${p.slug} failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  process.stdout.write("\n");

  // Group products by their declared category_slug
  const byCatSlug = new Map<string, AnyRec[]>();
  for (const p of products) {
    const cs = p.category_slug as string | undefined;
    if (!cs) continue;
    if (!byCatSlug.has(cs)) byCatSlug.set(cs, []);
    byCatSlug.get(cs)!.push(p);
  }

  const settingPageText = [
    `Company: ${setting.company_name}`,
    `Email: ${setting.company_email}`,
    setting.company_calling_code && setting.company_phone
      ? `Phone: ${setting.company_calling_code} ${setting.company_phone}`
      : undefined,
    setting.company_address ? `Address: ${setting.company_address}` : undefined,
    `Currency: ${setting.site_default_currency_symbol}`,
    setting.shipping_setup_flat_rate_wise_cost
      ? `Shipping: flat rate ${setting.shipping_setup_flat_rate_wise_cost} ${setting.site_default_currency_symbol} within Albania`
      : undefined,
    setting.site_cash_on_delivery ? `Cash on delivery: supported` : undefined,
    setting.social_media_facebook
      ? `Facebook: ${setting.social_media_facebook}`
      : undefined,
    setting.social_media_instagram
      ? `Instagram: ${setting.social_media_instagram}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const pages: { url: string; title: string; text: string }[] = [
    {
      url: ORIGIN,
      title: `About ${setting.company_name}`,
      text: settingPageText,
    },
  ];

  // CMS pages (FAQ, etc.) — content already in `description`
  for (const cms of cmsPages) {
    const text = htmlToText(cms.description);
    if (!text) continue;
    pages.push({
      url: `${ORIGIN}/page/${cms.slug}`,
      title: cms.title || cms.name || cms.slug,
      text,
    });
  }

  // One page per category, listing all products in that category
  for (const cat of categories) {
    const catProducts = byCatSlug.get(cat.slug) ?? [];
    if (catProducts.length === 0 && !cat.description) continue;

    const lines: string[] = [`Category: ${cat.name}`];
    const desc = htmlToText(cat.description);
    if (desc) lines.push(`Description: ${desc}`);
    lines.push(`Products in this category: ${catProducts.length}`);
    lines.push("");

    for (const p of catProducts) {
      lines.push(`• ${p.name}`);
      const priceLine =
        p.discount_percentage && p.discount_percentage > 0
          ? `Price: ${p.currency_price} (${p.discount_percentage}% off)`
          : `Price: ${p.currency_price}`;
      lines.push(`  ${priceLine}`);
      if (p.sku) lines.push(`  SKU: ${p.sku}`);
      if (p.unit) lines.push(`  Unit: ${p.unit}`);
      lines.push(`  URL: ${ORIGIN}/products/${p.slug}`);
      const details = htmlToText(p.details).slice(0, 1500);
      if (details) lines.push(`  Description: ${details}`);
      const usage = htmlToText(p.shipping_and_return).slice(0, 800);
      if (usage) lines.push(`  Usage / Care: ${usage}`);
      lines.push("");
    }

    pages.push({
      url: `${ORIGIN}/category/${cat.slug}`,
      title: `Category: ${cat.name}`,
      text: lines.join("\n"),
    });
  }

  // Catch-all for products with no category match
  const matched = new Set<number>();
  for (const arr of byCatSlug.values()) for (const p of arr) matched.add(p.id);
  const orphans = products.filter((p) => !matched.has(p.id));
  if (orphans.length > 0) {
    const lines = [`Other products (${orphans.length}):`, ""];
    for (const p of orphans) {
      lines.push(`• ${p.name} — ${p.currency_price}`);
      const details = htmlToText(p.details).slice(0, 800);
      if (details) lines.push(`  ${details}`);
      lines.push("");
    }
    pages.push({
      url: `${ORIGIN}/products`,
      title: "Other products",
      text: lines.join("\n"),
    });
  }

  const preset = {
    slug: SLUG,
    origin: ORIGIN,
    locale: "en" as const,
    company: {
      name: setting.company_name,
      email: setting.company_email ?? undefined,
      phone:
        setting.company_calling_code && setting.company_phone
          ? `${setting.company_calling_code} ${setting.company_phone}`
          : undefined,
      address: setting.company_address ?? undefined,
      currency: setting.site_default_currency_symbol ?? undefined,
      facebook: setting.social_media_facebook ?? undefined,
      instagram: setting.social_media_instagram ?? undefined,
    },
    welcome: {
      al: `Përshëndetje! 👋 Jam asistenti virtual i ${setting.company_name}. Si mund të të ndihmoj sot — dëshiron të gjesh produktin e duhur, të mësosh për përbërësit, ose të dish për dorëzimin?`,
      en: `Hi there! 👋 I'm the virtual assistant for ${setting.company_name}. How can I help — finding the right product, learning about ingredients, or anything about shipping and returns?`,
    },
    pages,
  };

  const outDir = join(process.cwd(), "content/demos");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${SLUG}.json`);
  writeFileSync(outPath, JSON.stringify(preset, null, 2));
  console.log(`✓ Wrote ${outPath}`);
  console.log(
    `  ${preset.pages.length} pages · ${products.length} products · ${cmsPages.length} CMS pages`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
