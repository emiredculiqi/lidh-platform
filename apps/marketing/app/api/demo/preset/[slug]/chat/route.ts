import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildDemoSystemPrompt,
  DEMO_MAX_MESSAGE_CHARS,
  DEMO_MAX_TOKENS,
  DEMO_MODEL,
} from "@/lib/demo/prompt";
import { loadPreset, presetToCrawl } from "@/lib/demo/preset";
import { checkPresetRateLimit } from "@/lib/demo/presetRateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(DEMO_MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(40),
  locale: z.enum(["al", "en"]).default("al"),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const preset = loadPreset(slug);
  if (!preset) {
    return NextResponse.json({ error: "preset_not_found" }, { status: 404 });
  }

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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = checkPresetRateLimit(slug, ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 },
    );
  }

  const { messages, locale } = parsed.data;

  const systemBlocks = buildDemoSystemPrompt(
    locale,
    {
      firstName: "",
      lastName: "",
      company: preset.company.name,
      email: preset.company.email ?? "",
      phone: preset.company.phone ?? "",
      websiteUrl: preset.origin,
    },
    presetToCrawl(preset),
    { preset: true },
  );

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

        for await (const event of aStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send("text", { delta: event.delta.text });
          }
        }

        await aStream.finalMessage();
        send("done", {});
      } catch (err) {
        console.error("[demo/preset/chat] error", err);
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
