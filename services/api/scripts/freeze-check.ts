/**
 * READ-ONLY freeze audit (ADR-017). Lists every tenant and whether the live
 * trial-enforcement now freezes it — using the SAME resolver the runtime uses,
 * so there is zero drift from production behavior. Makes NO writes.
 *
 *   pnpm --filter @lidh/api exec tsx scripts/freeze-check.ts   (needs DATABASE_URL)
 */
import { prisma } from "@lidh/db";
import { loadTenantEntitlements } from "../src/tenants/entitlements";

const DAY = 86_400_000;

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    select: {
      slug: true,
      name: true,
      status: true,
      trialEndsAt: true,
      planId: true,
      planOverrides: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (tenants.length === 0) {
    console.log("No tenants found.");
    return;
  }

  const rows: Array<Record<string, string>> = [];
  let live = 0;
  let grace = 0;
  let frozen = 0;

  for (const t of tenants) {
    const ent = await loadTenantEntitlements(prisma, t);
    let timing = "";
    if (ent.graceEndsAt) {
      const days = Math.ceil((ent.graceEndsAt.getTime() - Date.now()) / DAY);
      timing = days > 0 ? `freezes in ~${days}d` : "past grace";
    }
    if (ent.state === "expired" || ent.state === "archived") frozen++;
    else if (ent.state === "grace") grace++;
    else live++;

    rows.push({
      tenant: t.slug,
      state: ent.state,
      web: ent.chatEnabled ? "on" : "OFF",
      whatsapp: ent.whatsappEnabled ? "on" : "OFF",
      dashboard: ent.dashboard,
      timing,
    });
  }

  console.table(rows);
  console.log(
    `Totals: ${live} live · ${grace} in grace · ${frozen} FROZEN  (of ${tenants.length})`,
  );

  const frozenRows = rows.filter(
    (r) => r.state === "expired" || r.state === "archived",
  );
  if (frozenRows.length) {
    console.log(
      "\n⚠  FROZEN right now (customer channels silent, dashboard read-only):",
    );
    for (const r of frozenRows) console.log(`   • ${r.tenant}  (${r.state})`);
    console.log(
      "\n   To keep any live: admin grant-plan (Premium) or extend-trial.",
    );
  } else {
    console.log("\n✓  Nothing is frozen.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
