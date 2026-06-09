/**
 * One-shot: create (or update) the Bela Real Estate demo tenant with the
 * real_estate persona + the search_properties tool enabled (ADR-016).
 *
 * Idempotent: if the tenant already exists it just ensures the tool is on and
 * the personas are present. Run BEFORE the Houzez ingest (which needs the
 * tenant to exist).
 *
 *   pnpm --filter @lidh/api exec tsx scripts/create-bela-tenant.ts
 */
import { PrismaClient } from "@lidh/db";
import { expandPreset } from "@lidh/core";

const SLUG = "bela-real-estate";
const NAME = "Bela Real Estate";
const FACTS =
  "Bela Real Estate — agjenci patundshmërie në Shqipëri, me fokus Tiranë dhe Durrës. " +
  "Ndihmon klientët të blejnë ose marrin me qira apartamente, vila, zyra dhe prona të tjera. " +
  "Website: https://belarealestate.al";

// trial window long enough to demo without expiring.
const TRIAL_DAYS = 60;

const TOOLS_ENABLED = {
  capture_lead: true,
  request_human_handoff: true,
  search_properties: true,
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const personas = expandPreset("real_estate", NAME);
    if (!personas) throw new Error("real_estate preset not found in @lidh/core");

    const existing = await prisma.tenant.findUnique({
      where: { slug: SLUG },
      include: { agents: true },
    });

    if (existing) {
      // Ensure the search tool is enabled on the (first) agent.
      const agent = existing.agents[0];
      if (agent) {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { toolsEnabled: TOOLS_ENABLED },
        });
      }
      console.log(`Tenant "${SLUG}" already exists (${existing.id}); ensured search_properties enabled.`);
      return;
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          slug: SLUG,
          name: NAME,
          defaultLocale: "al",
          settings: { businessFacts: FACTS },
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        },
      });
      const agent = await tx.agent.create({
        data: {
          tenantId: t.id,
          name: `${NAME} Assistant`,
          defaultLocale: "al",
          toolsEnabled: TOOLS_ENABLED,
        },
      });
      await tx.agentPersona.createMany({
        data: personas.map((p) => ({
          agentId: agent.id,
          tenantId: t.id,
          locale: p.locale,
          content: p.content,
        })),
      });
      await tx.channel.create({
        data: {
          tenantId: t.id,
          kind: "web",
          status: "connected",
          config: { allowedOrigins: [] },
        },
      });
      return t;
    });

    console.log(
      `Created tenant ${NAME} (${tenant.id}) with ${personas.length} personas + search_properties enabled.`,
    );
    console.log(`Funnel URL: https://app.lidh.al/b/${SLUG}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
