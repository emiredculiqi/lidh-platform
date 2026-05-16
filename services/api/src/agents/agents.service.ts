import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AgentResponseDto } from "./dto/agent.dto";

/** Agent config read + persona editing. The chat/whatsapp runtimes read the
 *  persona fresh per request, so edits take effect on the next message. */
@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByTenant(tenantSlug: string): Promise<AgentResponseDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");

    const agent = await db.agent.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
    });
    if (!agent) throw new NotFoundException("agent_not_found");

    const personas = await db.agentPersona.findMany({
      where: { agentId: agent.id },
      orderBy: { locale: "asc" },
      select: { locale: true, content: true },
    });

    return {
      id: agent.id,
      name: agent.name,
      defaultLocale: agent.defaultLocale,
      toolsEnabled: agent.toolsEnabled,
      personas,
    };
  }

  /** Create or update one language's persona. */
  async upsertPersona(
    tenantSlug: string,
    locale: string,
    content: string,
  ): Promise<AgentResponseDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    const agent = await db.agent.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
    });
    if (!agent) throw new NotFoundException("agent_not_found");

    await db.agentPersona.upsert({
      where: { agentId_locale: { agentId: agent.id, locale } },
      update: { content },
      create: {
        agentId: agent.id,
        tenantId: tenant.id,
        locale,
        content,
      },
    });

    return this.getByTenant(tenantSlug);
  }
}
