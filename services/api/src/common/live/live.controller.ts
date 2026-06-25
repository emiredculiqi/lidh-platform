import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenant-context/tenant-context.service";
import { assertCanAccessTenant } from "../auth/access";
import { Public } from "../auth/public.decorator";
import { LiveService } from "./live.service";

@ApiTags("Live")
@Controller("live")
export class LiveController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContextService,
    private readonly live: LiveService,
  ) {}

  /**
   * Authenticated SSE stream of a tenant's live events (new conversations,
   * new messages) — backs the dashboard's real-time inbox + notifications.
   * Frames: `event: ready` once, then `event: live` per event, `: ping` beats.
   */
  @Get()
  @ApiOperation({ summary: "Live tenant events (SSE)" })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  async stream(
    @Query("tenantSlug") tenantSlug: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      reply.code(404).send({ message: "tenant_not_found" });
      return;
    }
    try {
      assertCanAccessTenant(this.ctx.get(), tenant.id);
    } catch {
      reply.code(403).send({ message: "forbidden" });
      return;
    }

    const origin = (req.headers.origin as string | undefined) ?? "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });
    reply.raw.write("event: ready\ndata: {}\n\n");

    const unsubscribe = this.live.subscribe(tenant.id, (e) => {
      reply.raw.write(`event: live\ndata: ${JSON.stringify(e)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 25_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  }

  /**
   * PUBLIC widget receive-stream: an anonymous visitor's widget subscribes by
   * its conversationId to receive agent (human) messages pushed during a
   * takeover. Scoped to one conversation (cuid — unguessable).
   */
  @Public()
  @Get("widget")
  @ApiOperation({ summary: "Widget receive-stream for agent messages (SSE)" })
  @ApiQuery({ name: "conversationId" })
  widget(
    @Query("conversationId") conversationId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): void {
    if (!conversationId) {
      reply.code(400).send({ message: "conversationId_required" });
      return;
    }
    const origin = (req.headers.origin as string | undefined) ?? "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });
    reply.raw.write("event: ready\ndata: {}\n\n");

    const unsubscribe = this.live.subscribe(`conv:${conversationId}`, (e) => {
      reply.raw.write(`event: agent\ndata: ${JSON.stringify(e)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 25_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  }
}
