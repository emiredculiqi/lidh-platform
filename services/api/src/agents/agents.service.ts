import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { TenantContextService } from "../common/tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../common/auth/access";
import type { AgentResponseDto } from "./dto/agent.dto";

/** Agent config read + persona editing. The chat/whatsapp runtimes read the
 *  persona fresh per request, so edits take effect on the next message. */
@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
  ) {}

  async getByTenant(tenantSlug: string): Promise<AgentResponseDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);

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
      modelOverride: agent.modelOverride,
      personas,
    };
  }

  /**
   * Set the per-tenant model (ADR-011). `model` null/undefined ⇒ clear the
   * override (falls back to the platform default, Haiku). The chat/whatsapp
   * runtimes already read Agent.modelOverride per request, so this takes
   * effect on the next message.
   */
  async setModel(
    tenantSlug: string,
    model: string | null | undefined,
  ): Promise<AgentResponseDto> {
    const db = this.prisma.client;
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException("tenant_not_found");
    assertCanAccessTenant(this.ctx.get(), tenant.id);
    const agent = await db.agent.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
    });
    if (!agent) throw new NotFoundException("agent_not_found");

    await db.agent.update({
      where: { id: agent.id },
      data: { modelOverride: model ?? null },
    });
    return this.getByTenant(tenantSlug);
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
    assertCanAccessTenant(this.ctx.get(), tenant.id);
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
