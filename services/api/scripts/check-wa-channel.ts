import { prisma } from "@lidh/db";

(async () => {
  const chans = await prisma.channel.findMany({
    where: { kind: "whatsapp" },
    select: {
      id: true,
      status: true,
      config: true,
      credentialsEnc: true,
      tenant: { select: { slug: true } },
    },
  });
  if (chans.length === 0) {
    console.log("NO whatsapp channels found in this database.");
  }
  for (const c of chans) {
    console.log({
      tenant: c.tenant.slug,
      status: c.status,
      config: c.config,
      hasToken: !!c.credentialsEnc,
      tokenChars: c.credentialsEnc?.length ?? 0,
    });
  }
  // Also confirm which DB host this is (sanity vs the deployed API).
  const [{ url }] = await prisma.$queryRawUnsafe<{ url: string }[]>(
    "SELECT current_database() AS url",
  );
  console.log("connected database:", url);
  await prisma.$disconnect();
})();
