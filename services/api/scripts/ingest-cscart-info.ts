/**
 * Add CLEAN general-info knowledge for a CS-Cart shop (about / contact /
 * terms) — readable page text only, no product grids — so the agent can
 * answer "who are you / where / how to contact / how to order / policies"
 * without re-introducing the messy category-page chunks that pollute product
 * links. Also seeds the tenant's businessFacts with the key contact details
 * (always injected into the prompt, never retrieved/diluted).
 *
 *   TENANT_SLUG=shpresa-beauty BASE_URL=https://shpresabeauty.com \
 *     packages/db/node_modules/.bin/tsx services/api/scripts/ingest-cscart-info.ts
 */
import { PrismaClient } from "@lidh/db";
import * as cheerio from "cheerio";

const TENANT_SLUG = process.env.TENANT_SLUG ?? "shpresa-beauty";
const BASE = (process.env.BASE_URL ?? "https://shpresabeauty.com").replace(/\/$/, "");
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const UA = "Mozilla/5.0 (compatible; LidhBot/1.0; +https://lidh.al)";
const SOURCE_URI = `${BASE}/__general_info__`;

// Content pages to ingest (slug -> friendly title). No category/search pages.
const PAGES = [
  { slug: "about-us", title: "Rreth Nesh / About" },
  { slug: "contact", title: "Kontakti / Contact" },
  { slug: "terms", title: "Kushtet / Terms" },
];

// Filled into businessFacts — always available to the agent.
const BUSINESS_FACTS =
  "Shpresa Beauty është një dyqan online kozmetik në Shqipëri që ofron produkte " +
  "të zgjedhura dhe natyrale (përfshirë produkte LR), me shërbim të personalizuar. " +
  "Kontakti: telefon/WhatsApp +355 68 496 4805, email shpresalluko@gmail.com. " +
  "Adresa: Rruga Dajti, Tiranë. Për të porositur, klienti shton produktet në shportë " +
  "në website (shpresabeauty.com) ose na kontakton drejtpërdrejt.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Largest readable text block on the page (after stripping chrome). Content
 *  pages have no product grids, so this is clean. */
function readableContent(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,.ty-footer,.cm-navigation,form").remove();
  const title = $("h1").first().text().trim().replace(/\s+/g, " ");
  let best = "";
  $("div,section,article").each((_, el) => {
    const t = $(el)
      .clone()
      .children("div,section,ul,table")
      .remove()
      .end()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    if (t.length > best.length && t.length < 4000) best = t;
  });
  return { title, text: best };
}

/** Split text into ~800-char chunks at sentence/space boundaries. */
function chunk(text: string): string[] {
  const out: string[] = [];
  const TARGET = 800;
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + TARGET, text.length);
    if (end < text.length) {
      const dot = text.lastIndexOf(". ", end);
      const sp = text.lastIndexOf(" ", end);
      end = dot > i + 300 ? dot + 1 : sp > i + 300 ? sp : end;
    }
    out.push(text.slice(i, end).trim());
    i = end;
  }
  return out.filter((c) => c.length > 30);
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function main(): Promise<void> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true, name: true, settings: true },
    });
    if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" not found`);

    // 1) businessFacts — always-available essentials.
    const settings =
      tenant.settings && typeof tenant.settings === "object"
        ? (tenant.settings as Record<string, unknown>)
        : {};
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...settings, businessFacts: BUSINESS_FACTS } },
    });
    console.log("Set businessFacts (contact + description).");

    // 2) Info-page chunks.
    const items: { content: string; url: string; title: string }[] = [];
    for (const p of PAGES) {
      const url = `${BASE}/${p.slug}/`;
      const html = await fetchText(url);
      if (!html) {
        console.log(`  · skip ${p.slug} (fetch failed)`);
        continue;
      }
      const { title, text } = readableContent(html);
      if (text.length < 40) {
        console.log(`  · skip ${p.slug} (no readable content)`);
        continue;
      }
      for (const c of chunk(text)) {
        items.push({
          content: `${p.title} — ${title}. ${c}`,
          url,
          title: p.title,
        });
      }
      console.log(`  ✓ ${p.slug}: ${chunk(text).length} chunk(s)`);
      await sleep(300);
    }

    if (items.length) {
      const vectors = await embed(items.map((i) => i.content));

      // Re-runnable: replace this source.
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
          meta: { label: "General info (about/contact/terms)" },
        },
      });
      for (let i = 0; i < items.length; i++) {
        const ck = await prisma.knowledgeChunk.create({
          data: {
            tenantId: tenant.id,
            sourceId: source.id,
            content: items[i].content,
            meta: { url: items[i].url, title: items[i].title },
            tokens: Math.ceil(items[i].content.length / 4),
          },
          select: { id: true },
        });
        const literal = `[${vectors[i].join(",")}]`;
        await prisma.$executeRaw`UPDATE "KnowledgeChunk" SET embedding = ${literal}::vector WHERE id = ${ck.id}`;
      }
      console.log(`Ingested ${items.length} general-info chunk(s).`);
    }

    const total = await prisma.knowledgeChunk.count({
      where: { tenantId: tenant.id },
    });
    console.log(`Done. Tenant now has ${total} chunks (products + general info).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
