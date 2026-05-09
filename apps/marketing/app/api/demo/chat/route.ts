import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildDemoSystemPrompt,
  DEMO_MAX_MESSAGE_CHARS,
  DEMO_MAX_TOKENS,
  DEMO_MODEL,
} from "@/lib/demo/prompt";
import {
  MAX_PROMPTS,
  appendMessages,
  getSession,
  incrementPrompts,
  markSummarySent,
} from "@/lib/demo/store";
import { sendDemoSummary } from "@/lib/demo/summaryEmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const ChatSchema = z.object({
  demoId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(DEMO_MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(20),
  locale: z.enum(["al", "en"]).default("al"),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { demoId, messages, locale } = parsed.data;
  const session = getSession(demoId);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.status === "crawling") {
    return NextResponse.json({ error: "session_not_ready" }, { status: 409 });
  }
  if (session.status === "failed" || !session.crawl) {
    return NextResponse.json({ error: "session_failed" }, { status: 410 });
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > MAX_PROMPTS) {
    return NextResponse.json(
      { error: "limit_reached", limit: MAX_PROMPTS },
      { status: 429 },
    );
  }
  if (session.promptsUsed >= MAX_PROMPTS) {
    return NextResponse.json(
      { error: "limit_reached", limit: MAX_PROMPTS },
      { status: 429 },
    );
  }

  const systemBlocks = buildDemoSystemPrompt(locale, session.lead, session.crawl);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const conversation: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const aStream = client.messages.stream({
          model: DEMO_MODEL,
          max_tokens: DEMO_MAX_TOKENS,
          system: systemBlocks,
          messages: conversation,
        });

        let assistantText = "";
        for await (const event of aStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            send("text", { delta: event.delta.text });
          }
        }

        await aStream.finalMessage();

        const lastUserMessage = messages[messages.length - 1];
        appendMessages(demoId, [
          { role: "user", content: lastUserMessage.content },
          { role: "assistant", content: assistantText },
        ]);

        const promptsUsed = incrementPrompts(demoId);
        send("usage", {
          promptsUsed,
          promptsRemaining: Math.max(0, MAX_PROMPTS - promptsUsed),
        });
        send("done", {});

        if (promptsUsed >= MAX_PROMPTS) {
          const finalSession = getSession(demoId);
          if (finalSession && !finalSession.summarySent) {
            markSummarySent(demoId);
            sendDemoSummary(finalSession).catch((err) => {
              console.error("[demo/chat] summary email failed", err);
            });
          }
        }
      } catch (err) {
        console.error("[demo/chat] error", err);
        send("error", { message: "chat_failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
