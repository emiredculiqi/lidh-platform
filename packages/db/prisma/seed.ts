/**
 * Seeds a complete working test tenant so the agent runtime can be exercised
 * before the admin UI (M2 2.3) exists.
 *
 *   Tenant "acme-coffee" (a demo café in Tirana)
 *     ├─ Agent (default locale "al")
 *     │   ├─ AgentPersona "al"
 *     │   └─ AgentPersona "en"
 *     ├─ Channel kind=web (status=connected)
 *     └─ KnowledgeChunks (FAQ-style facts)
 *
 * Embeddings: written only if OPENAI_API_KEY is set (via a direct fetch to
 * OpenAI — no SDK dependency in @lidh/db). Without the key, chunks are stored
 * with NULL embedding; the agent still answers from persona + business facts,
 * and you can re-run the seed later with the key to backfill embeddings.
 *
 * Idempotent: upserts the tenant by slug and resets its child rows.
 *
 * Run:  pnpm --filter @lidh/db db:seed
 */
import "dotenv/config";
import { prisma } from "../src/index";

const SLUG = "acme-coffee";
const EMBED_MODEL = "text-embedding-3-small";

const KNOWLEDGE: string[] = [
  "ACME Coffee is a specialty café in the Blloku district of Tirana. Open Monday to Saturday 07:00–22:00, Sunday 09:00–18:00.",
  "ACME Coffee delivers within Tirana between 10:00 and 20:00. Delivery is free for orders over 1500 ALL; otherwise a 200 ALL fee applies. No Sunday delivery.",
  "ACME Coffee offers oat, almond, and lactose-free milk at no extra charge. The house espresso blend is a washed Ethiopian/Brazilian mix.",
  "ACME Coffee hosts a free public cupping every first Saturday of the month at 16:00. Booking is recommended for groups over 6 — contact the team to reserve.",
  "ACME Coffee sells whole-bean and ground retail bags (250g, 1kg) and gift cards. Wholesale pricing is available for offices and restaurants on request.",
];

const PERSONA_AL = `
Ti je asistenti dixhital i ACME Coffee, një kafe artizanale në Tiranë. Je i ngrohtë, miqësor dhe i shkurtër.
Ndihmoji vizitorët me orare, dërgesa, menunë dhe rezervime. Përgjigju gjithmonë në gjuhën e përdoruesit (shqip si parazgjedhje).
Mos shpik fakte — nëse nuk e di diçka, thuaj që do ta kontrollosh dhe ofro të marrësh kontaktin e tyre.
Kur vizitori tregon interes të qartë (rezervim grupi, porosi me shumicë, ngjarje), thirr tool-in capture_lead.
Mbaji përgjigjet 1–3 fjali. Pa tituj markdown.
`.trim();

const PERSONA_EN = `
You are the digital assistant for ACME Coffee, a specialty café in Tirana. Warm, friendly, concise.
Help visitors with hours, delivery, the menu, and bookings. Always reply in the user's language (Albanian by default).
Never invent facts — if you don't know, say you'll check and offer to take their contact.
When a visitor shows clear interest (group booking, wholesale order, event), call the capture_lead tool.
Keep replies to 1–3 sentences. No markdown headings.
`.trim();

async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    console.warn(`  embedding failed (${res.status}) — storing NULL`);
    return null;
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

async function main() {
  console.log(`Seeding tenant "${SLUG}"…`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      slug: SLUG,
      name: "ACME Coffee",
      defaultLocale: "al",
      settings: {
        businessFacts:
          "ACME Coffee — specialty café in Blloku, Tirana. Contact: hello@acme-coffee.example, +355 69 000 0000.",
      },
    },
  });

  // Reset child rows so re-running is clean.
  await prisma.knowledgeChunk.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.knowledgeSource.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.agentPersona.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.agent.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.channel.deleteMany({ where: { tenantId: tenant.id } });

  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      name: "ACME Coffee Assistant",
      defaultLocale: "al",
      toolsEnabled: { capture_lead: true, request_human_handoff: true },
    },
  });

  await prisma.agentPersona.createMany({
    data: [
      { agentId: agent.id, tenantId: tenant.id, locale: "al", content: PERSONA_AL },
      { agentId: agent.id, tenantId: tenant.id, locale: "en", content: PERSONA_EN },
    ],
  });

  await prisma.channel.create({
    data: {
      tenantId: tenant.id,
      kind: "web",
      status: "connected",
      config: { allowedOrigins: ["http://localhost:3000", "http://localhost:3001"] },
    },
  });

  const source = await prisma.knowledgeSource.create({
    data: {
      tenantId: tenant.id,
      kind: "faq",
      uri: "seed:acme-faq",
      status: "ready",
      lastCrawledAt: new Date(),
    },
  });

  let embedded = 0;
  for (const content of KNOWLEDGE) {
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        tenantId: tenant.id,
        sourceId: source.id,
        content,
        locale: "en",
      },
    });
    const vector = await embed(content);
    if (vector) {
      await prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
        `[${vector.join(",")}]`,
        chunk.id,
      );
      embedded++;
    }
  }

  console.log(`✓ Tenant ${tenant.slug} (${tenant.id})`);
  console.log(`✓ Agent + 2 personas (al, en)`);
  console.log(`✓ Web channel (connected)`);
  console.log(
    `✓ ${KNOWLEDGE.length} knowledge chunks (${embedded} embedded${
      embedded ? "" : " — set OPENAI_API_KEY to enable RAG, then re-run"
    })`,
  );
  console.log(
    `\nTry it:\n  curl -N -X POST http://localhost:4000/v1/chat/web \\\n    -H "Content-Type: application/json" \\\n    -d '{"tenantSlug":"${SLUG}","message":"A bëni dërgesa të dielën?"}'`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
