import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Public } from "../common/auth/public.decorator";
import { ChatService } from "./chat.service";
import { ChatOpenerDto, ChatWebRequestDto } from "./dto/chat-web-request.dto";

@ApiTags("Chat")
@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /**
   * Manual SSE (ADR-001 #6) — we control the exact bytes so the wire format
   * stays identical to the existing widget contract:
   *
   *   event: meta\ndata: {"conversationId":"..."}\n\n
   *   event: text\ndata: {"delta":"..."}\n\n
   *   event: effect\ndata: {"type":"lead_captured"}\n\n
   *   event: done\ndata: {}\n\n
   *   event: error\ndata: {"message":"..."}\n\n
   *
   * @Res() opts out of Nest's auto-response so we own the FastifyReply.
   */
  /**
   * What the chat says before the visitor types anything (ADR-021): the
   * intake opener, plus who answers right now so the widget's header and
   * disclosure tell the truth. Public, read-only, no event.
   */
  @Public()
  @Get("opener")
  @ApiOperation({
    summary: "The chat's opening line and who answers (public)",
    description:
      "The widget and the public page call this when the panel opens with " +
      "no history, show the line word by word, and send `intakeAsked: true` " +
      "with the visitor's first message. Writes nothing.",
  })
  @ApiQuery({ name: "tenantSlug", example: "acme-coffee" })
  @ApiQuery({ name: "locale", required: false, example: "al" })
  @ApiOkResponse({ type: ChatOpenerDto })
  opener(
    @Query("tenantSlug") tenantSlug: string,
    @Query("locale") locale?: string,
  ): Promise<ChatOpenerDto> {
    return this.chat.opener(tenantSlug, locale);
  }

  @Public()
  @Post("web")
  @ApiOperation({
    summary: "Web-channel chat (SSE stream)",
    description:
      "**How to consume:** `POST /v1/chat/web` with a JSON body, read the " +
      "response as an SSE stream (`text/event-stream`).\n\n" +
      "Events: `meta` (once, carries conversationId) → `text` (many, reply " +
      "deltas) → optional `effect` (e.g. lead_captured) → `done`. `error` " +
      "may arrive instead of `done`.\n\n" +
      "```bash\ncurl -N -X POST http://localhost:4000/v1/chat/web \\\n" +
      '  -H "Content-Type: application/json" \\\n' +
      '  -d \'{"tenantSlug":"acme-coffee","message":"Hi"}\'\n```',
  })
  async web(
    @Body() dto: ChatWebRequestDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return this.stream(dto, req, reply, { preview: false });
  }

  /**
   * The dashboard's test chat. NOT @Public — the global AuthGuard requires a
   * Clerk token, so only a signed-in member (or platform admin) reaches it.
   * Same handler, but conversations are `kind: preview`: no intake gate
   * (ADR-021), never in the inbox, never counted in usage. Previously the
   * test chat used /chat/web and its sessions counted as real customers.
   */
  @Post("preview")
  @ApiOperation({
    summary: "Authenticated preview chat (dashboard test chat, SSE stream)",
    description:
      "Same stream contract as `POST /v1/chat/web`, but requires a Clerk " +
      "Bearer token and creates preview conversations that skip the intake " +
      "gate and are excluded from the inbox and usage.",
  })
  async preview(
    @Body() dto: ChatWebRequestDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    return this.stream(dto, req, reply, { preview: true });
  }

  private async stream(
    dto: ChatWebRequestDto,
    req: FastifyRequest,
    reply: FastifyReply,
    opts: { preview: boolean },
  ): Promise<void> {
    // Manual raw writeHead bypasses Fastify's CORS plugin, so the browser
    // would block this cross-origin stream ("Failed to fetch"). Re-apply CORS
    // here, mirroring the global config: reflect the request Origin (the
    // global allowlist is "*" in dev) so the widget/dashboard can read it.
    const origin = (req.headers.origin as string | undefined) ?? "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      );
    };

    try {
      const reqOrigin =
        typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      for await (const ev of this.chat.runWeb(dto, reqOrigin, opts)) {
        switch (ev.kind) {
          case "meta":
            send("meta", { conversationId: ev.conversationId });
            break;
          case "text":
            send("text", { delta: ev.delta });
            break;
          case "effect":
            send("effect", ev.effect);
            break;
          case "done":
            send("done", {});
            break;
          case "error":
            send("error", { message: ev.message });
            break;
        }
      }
    } catch {
      send("error", { message: "chat_failed" });
    } finally {
      reply.raw.end();
    }
  }
}
