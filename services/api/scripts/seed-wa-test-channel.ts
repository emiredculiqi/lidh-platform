/**
 * Attach a Meta *test* WhatsApp number to a tenant so the deployed agent
 * answers it — a test harness that bypasses the Embedded Signup Connect button
 * (which needs Advanced Access / App Review). Direct DB seed, no plan-gate.
 *
 * IMPORTANT: run with the SAME DATABASE_URL and CREDENTIAL_ENC_KEY your
 * DEPLOYED API uses, so it can decrypt the token when it sends replies.
 *
 * Usage (values via env — secrets never land in shell history if you use a
 * leading space or a .env you delete after):
 *
 *   cd services/api
 *   DATABASE_URL='<prod Neon url>' \
 *   CREDENTIAL_ENC_KEY='<same base64 as your Fly secret>' \
 *   TENANT_SLUG='<a tenant that has an agent+persona>' \
 *   WA_PHONE_NUMBER_ID='<test number Phone number ID>' \
 *   WA_WABA_ID='<test WABA ID>' \
 *   WA_DISPLAY_NUMBER='+1 555 ...' \
 *   WA_ACCESS_TOKEN='<temporary access token from API Setup>' \
 *     node_modules/.bin/ts-node --transpile-only \
 *       --compiler-options '{"module":"commonjs"}' scripts/seed-wa-test-channel.ts
 *
 * To remove the test channel later, re-run with WA_ACCESS_TOKEN unset and it
 * will refuse — instead disconnect from the dashboard, or delete the row.
 */
import { prisma } from "@lidh/db";
import { CryptoService } from "../src/common/crypto/crypto.service";

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const slug = req("TENANT_SLUG");
  const phoneNumberId = req("WA_PHONE_NUMBER_ID");
  const wabaId = req("WA_WABA_ID");
  const accessToken = req("WA_ACCESS_TOKEN");
  const displayNumber = process.env.WA_DISPLAY_NUMBER ?? null;

  const crypto = new CryptoService(); // reads CREDENTIAL_ENC_KEY from env
  if (!crypto.enabled) {
    console.error(
      "✗ CREDENTIAL_ENC_KEY missing/invalid — set the SAME base64 value as your Fly secret",
    );
    process.exit(1);
  }
  const credentialsEnc = crypto.encrypt(accessToken);

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`✗ Tenant '${slug}' not found`);
    process.exit(1);
  }
  const agent = await prisma.agent.findFirst({ where: { tenantId: tenant.id } });
  if (!agent) {
    console.error(
      `✗ Tenant '${slug}' has no agent/persona — pick a configured tenant`,
    );
    process.exit(1);
  }

  const config = {
    phoneNumberId,
    wabaId,
    displayPhoneNumber: displayNumber,
    coexistence: false, // test number, not a coexistence Business App number
  };

  const channel = await prisma.channel.upsert({
    where: { tenantId_kind: { tenantId: tenant.id, kind: "whatsapp" } },
    update: { status: "connected", config, credentialsEnc },
    create: {
      tenantId: tenant.id,
      kind: "whatsapp",
      status: "connected",
      config,
      credentialsEnc,
    },
  });

  console.log(`✅ WhatsApp test channel connected for tenant '${slug}'`);
  console.log(
    `   channelId=${channel.id}  phoneNumberId=${phoneNumberId}  waba=${wabaId}`,
  );
  console.log(`   token encrypted (${credentialsEnc.length} chars, not shown)`);
  console.log(
    `\nNow message the test number from your phone — the agent should reply.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
