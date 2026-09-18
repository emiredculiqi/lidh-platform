import { prisma } from "@lidh/db";

(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "lidh-al" },
    select: { id: true },
  });
  if (!tenant) return console.log("no tenant 'lidh-al'");
  const channel = await prisma.channel.findFirst({
    where: { tenantId: tenant.id, kind: "whatsapp" },
  });
  if (!channel) return console.log("no whatsapp channel");

  const convos = await prisma.conversation.findMany({
    where: { tenantId: tenant.id, channelId: channel.id },
    orderBy: { lastMsgAt: "desc" },
    take: 3,
    include: {
      contact: { select: { phone: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          contentText: true,
          contentJson: true,
          createdAt: true,
        },
      },
    },
  });

  if (convos.length === 0) {
    console.log("NO WhatsApp conversations yet — inbound never got processed.");
  }
  for (const c of convos) {
    console.log(
      `\nConversation ${c.id}  contact=${c.contact.name ?? c.contact.phone}  last=${c.lastMsgAt.toISOString()}  aiPaused=${c.aiPaused}`,
    );
    for (const m of c.messages) {
      const j = m.contentJson as { human?: boolean } | null;
      const who =
        m.role === "user" ? "CUSTOMER" : j?.human ? "HUMAN/echo" : "AGENT";
      console.log(
        `  ${m.createdAt.toISOString()} [${who}] ${(m.contentText ?? "").slice(0, 160)}`,
      );
    }
  }
  await prisma.$disconnect();
})();
