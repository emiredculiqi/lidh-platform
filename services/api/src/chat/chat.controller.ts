import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { ChatService } from "./chat.service";
import { ChatWebRequestDto } from "./dto/chat-web-request.dto";

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
    @Res() reply: FastifyReply,
  ): Promise<void> {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      );
    };

    try {
      for await (const ev of this.chat.runWeb(dto)) {
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
