/**
 * CS-Cart product ingest (quick e-commerce fix): scrape a CS-Cart store's
 * product list (name + URL + category) and write one KnowledgeChunk per
 * product — with the product page URL in both meta.url and the content — so
 * the existing RAG retrieval surfaces each product *with its link*, and the
 * general persona agent can hand the visitor the exact product page.
 *
 * No new tool/persona: reuses the knowledge pipeline. Embeddings via OpenAI
 * text-embedding-3-small (1536-dim) — same model retrieval uses, so the
 * product chunks live in the same vector space as query embeddings.
 *
 *   TENANT_SLUG=shpresa-beauty BASE_URL=https://shpresabeauty.com \
 *     packages/db/node_modules/.bin/tsx services/api/scripts/ingest-cscart-products.ts
 */
import { PrismaClient, Prisma } from "@lidh/db";
import * as cheerio from "cheerio";

const TENANT_SLUG = process.env.TENANT_SLUG ?? "shpresa-beauty";
const BASE = (process.env.BASE_URL ?? "https://shpresabeauty.com").replace(/\/$/, "");
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const UA = "Mozilla/5.0 (compatible; LidhBot/1.0; +https://lidh.al)";
const EMBED_MODEL = "text-embedding-3-small";
// Stable marker so re-runs replace this script's source rather than duplicate.
const SOURCE_URI = `${BASE}/__products_feed__`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Product {
  name: string;
  url: string;
  category: string;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Turn a product URL path into readable category words for better matching.
 *  ".../cosmetics/skin-care/cream/serox-serum/" -> "cosmetics, skin care, cream" */
function categoryFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
    const segs = path.split("/").filter(Boolean);
    segs.pop(); // drop the product slug itself
    return segs
      .map((s) => s.replace(/-en$/, "").replace(/[-_]+/g, " ").trim())
      .filter((s) => s && s !== "health and beauty")
      .join(", ");
  } catch {
    return "";
  }
}

async function enumerateProducts(): Promise<Product[]> {
  const map = new Map<string, Product>();
  for (let page = 1; page <= 12; page++) {
    const url = `${BASE}/index.php?dispatch=products.search&search_performed=Y&items_per_page=50&page=${page}`;
    const html = await fetchText(url);
    if (!html) break;
    const $ = cheerio.load(html);
    const before = map.size;
    $("a.product-title").each((_, a) => {
      const href = ($(a).attr("href") ?? "").trim();
      const name = $(a).text().trim().replace(/\s+/g, " ");
      if (href && name && !map.has(href)) {
        map.set(href, { name, url: href, category: categoryFromUrl(href) });
      }
    });
    await sleep(300);
    if (map.size === before) break; // no new products -> reached the end
  }
  return [...map.values()];
}

/** Batch-embed via OpenAI; returns one 1536-float vector per input. */
async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 90) {
    const batch = texts.slice(i, i + 90);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    for (const d of json.data) out.push(d.embedding);
    await sleep(200);
  }
  return out;
}

async function main(): Promise<void> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true, name: true },
    });
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" not found`);

    console.log("Enumerating products…");
    const products = await enumerateProducts();
    console.log(`Found ${products.length} products for ${tenant.name}`);
    if (!products.length) throw new Error("no products scraped — check selectors");

    // One chunk per product. The URL is in BOTH meta.url (retrieval prefixes
    // "(source: <url>)") and the content (so the model can cite it verbatim).
    const contents = products.map(
      (p) =>
        `${p.name}.${p.category ? ` Kategoria: ${p.category}.` : ""} ` +
        `Produkt nga ${tenant.name}. Lidhja te produkti: ${p.url}`,
    );

    console.log("Embedding…");
    const vectors = await embed(contents);

    // Re-runnable: replace this script's source + its chunks.
    const existing = await prisma.knowledgeSource.findFirst({
      where: { tenantId: tenant.id, uri: SOURCE_URI },
      select: { id: true },
    });
    if (existing) {
      await prisma.knowledgeChunk.deleteMany({ where: { sourceId: existing.id } });
      await prisma.knowledgeSource.delete({ where: { id: existing.id } });
    }
    const source = await prisma.knowledgeSource.create({
      data: {
        tenantId: tenant.id,
        kind: "url",
        uri: SOURCE_URI,
        status: "ready",
        lastCrawledAt: new Date(),
        meta: { label: "Product catalogue", productCount: products.length },
      },
    });

    console.log("Writing chunks…");
    let ok = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const chunk = await prisma.knowledgeChunk.create({
        data: {
          tenantId: tenant.id,
          sourceId: source.id,
          content: contents[i],
          meta: { url: p.url, title: p.name },
          tokens: Math.ceil(contents[i].length / 4),
        },
        select: { id: true },
      });
      const literal = `[${vectors[i].join(",")}]`;
      await prisma.$executeRaw`UPDATE "KnowledgeChunk" SET embedding = ${literal}::vector WHERE id = ${chunk.id}`;
      ok++;
      if ((i + 1) % 20 === 0) console.log(`  …${i + 1}/${products.length}`);
    }

    console.log(`\nDone. Ingested ${ok} product chunks (source ${source.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
