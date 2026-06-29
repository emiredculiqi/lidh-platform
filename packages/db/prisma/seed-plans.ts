/**
 * Seeds the canonical paid plans (idempotent — upsert by slug).
 *
 *   Basic   — €29/mo (€290/yr), €49 setup, 300 conversations/mo, 2 seats, web
 *   Premium — €69/mo (€690/yr), €99 setup, 1,500 conversations/mo, 5 seats,
 *             web + WhatsApp, calendar/reminders/images/integrations/analytics
 *
 * There is NO free plan — the only free offering is the 30-day trial
 * (Tenant.trialEndsAt), which is not a Plan row. `features` follows the
 * `has<Feature>` convention documented on the Plan model.
 *
 * Run:  pnpm --filter @lidh/db db:seed:plans   (DATABASE_URL must be set)
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const db = new PrismaClient();

const PLANS: Prisma.PlanCreateInput[] = [
  {
    slug: "basic",
    name: "Basic",
    priceEurPerMonth: 29,
    priceEurPerYear: 290,
    setupFeeEur: 49,
    conversationsPerMonth: 300,
    maxChannels: 1, // web (WhatsApp/IG only via the shareable agent link)
    maxLanguages: 4, // AL, EN, IT, DE
    maxKnowledgeSources: 0, // 0 = unlimited
    maxTeamMembers: 2,
    features: {
      hasCustomBranding: true,
      hasGdpr: true,
      hasNotifications: true,
      hasWhatsApp: false,
      hasCalendar: false,
      hasImageHandling: false,
      hasIntegrations: false,
      hasAnalytics: false,
    },
  },
  {
    slug: "premium",
    name: "Premium",
    priceEurPerMonth: 69,
    priceEurPerYear: 690,
    setupFeeEur: 99,
    conversationsPerMonth: 1500,
    maxChannels: 2, // web + WhatsApp (1 number included)
    maxLanguages: 4,
    maxKnowledgeSources: 0,
    maxTeamMembers: 5,
    features: {
      hasCustomBranding: true,
      hasGdpr: true,
      hasNotifications: true,
      hasWhatsApp: true,
      whatsAppNumbers: 1,
      hasCalendar: true,
      hasReminders: true,
      hasImageHandling: true,
      imageQuota: 200,
      hasIntegrations: true,
      hasAnalytics: true,
    },
  },
];

async function main() {
  for (const { slug, ...data } of PLANS) {
    const plan = await db.plan.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
    console.log(
      `✓ ${plan.name} (${plan.slug}) — €${plan.priceEurPerMonth}/mo · ` +
        `${plan.conversationsPerMonth} conv · ${plan.maxTeamMembers} seats`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
