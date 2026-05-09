import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildSystemPrompt,
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  MAX_AGENTIC_TURNS,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  type ChatLocale,
} from "@/lib/chat/prompt";
import { emailHandoff, emailLead } from "@/lib/chat/handoff";

export const runtime = "nodejs";
export const maxDuration = 60;

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_HISTORY),
  locale: z.enum(["al", "en"]).default("al"),
});

const TOOLS: Anthropic.Tool[] = [
  {
    name: "capture_lead",
    description:
      "Save the visitor as a sales lead and notify the Lidh.al team by email. Call this when the visitor shows clear interest in becoming a customer (asks for a meeting, demo, pricing, says 'contact me', or shares their contact info unprompted). Pass whatever contact details you have — even partial info is fine.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor's name if given." },
        email: { type: "string", description: "Visitor's email if given." },
        phone: { type: "string", description: "Visitor's phone if given." },
        business: {
          type: "string",
          description: "Visitor's business name if given.",
        },
        preferredTime: {
          type: "string",
          description: "Preferred time for a call/meeting if given.",
        },
        notes: {
          type: "string",
          description:
            "One-paragraph summary of what the visitor needs and why they're interested.",
        },
      },
      required: ["notes"],
    },
  },
  {
    name: "request_human_handoff",
    description:
      "Escalate to a human teammate when you cannot help, when the visitor explicitly asks for a person, or when the question requires specialized knowledge (custom pricing, complex technical integration, legal/contract questions). The team is emailed a summary; the user is also offered a WhatsApp link client-side. Do not call this for casual greetings or simple FAQ questions you can answer.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Short reason for the handoff (e.g. 'pricing question I cannot answer', 'user asked for a human').",
        },
        summary: {
          type: "string",
          description:
            "What the visitor needs and any relevant context from the conversation.",
        },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        business: { type: "string" },
      },
      required: ["reason", "summary"],
    },
  },
];

type ToolEffect = { type: "lead_captured" } | { type: "human_handoff" };

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
    console.error("[chat] ANTHROPIC_API_KEY not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { messages, locale } = parsed.data;

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

        for (let turn = 0; turn < MAX_AGENTIC_TURNS; turn++) {
          const stream = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: CHAT_MAX_TOKENS,
            system: buildSystemPrompt(locale as ChatLocale),
            tools: TOOLS,
            messages: conversation,
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send("text", { delta: event.delta.text });
            }
          }

          const final = await stream.finalMessage();
          conversation.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use") break;

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          const transcript = formatTranscript(conversation);
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          const effects: ToolEffect[] = [];

          for (const use of toolUses) {
            const { result, effect } = await runTool(
              use.name,
              use.input as Record<string, unknown>,
              transcript,
            );
            if (effect) effects.push(effect);
            toolResults.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: result,
            });
          }

          for (const effect of effects) send("effect", effect);

          conversation.push({ role: "user", content: toolResults });
        }

        send("done", {});
      } catch (err) {
        console.error("[chat] error", err);
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

async function runTool(
  name: string,
  input: Record<string, unknown>,
  transcript: string,
): Promise<{ result: string; effect?: ToolEffect }> {
  try {
    if (name === "capture_lead") {
      const notes = String(input.notes ?? "");
      await emailLead({
        contact: {
          name: stringOrUndef(input.name),
          email: stringOrUndef(input.email),
          phone: stringOrUndef(input.phone),
          business: stringOrUndef(input.business),
          preferredTime: stringOrUndef(input.preferredTime),
        },
        notes,
        transcript,
      });
      return {
        result:
          "Lead saved and the team has been notified by email. Thank the visitor and let them know someone will reach out shortly.",
        effect: { type: "lead_captured" },
      };
    }

    if (name === "request_human_handoff") {
      await emailHandoff({
        reason: String(input.reason ?? "unspecified"),
        summary: String(input.summary ?? ""),
        contact: {
          name: stringOrUndef(input.name),
          email: stringOrUndef(input.email),
          phone: stringOrUndef(input.phone),
          business: stringOrUndef(input.business),
        },
        transcript,
      });
      return {
        result:
          "Handoff email sent to the team. Tell the visitor a teammate will reply by email or WhatsApp shortly. Do not promise an exact time.",
        effect: { type: "human_handoff" },
      };
    }

    return { result: `Unknown tool: ${name}` };
  } catch (err) {
    console.error(`[chat] tool ${name} failed`, err);
    return {
      result:
        "The tool failed to run. Apologize briefly and suggest the visitor email info@lidh.al or message us on WhatsApp.",
    };
  }
}

function stringOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function formatTranscript(messages: Anthropic.MessageParam[]): string {
  return messages
    .slice(-12)
    .map((m) => {
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content
              .map((b) => {
                if (b.type === "text") return b.text;
                if (b.type === "tool_use") return `[tool_use:${b.name}]`;
                if (b.type === "tool_result") return `[tool_result]`;
                return "";
              })
              .filter(Boolean)
              .join(" ");
      return `${m.role}: ${text}`;
    })
    .join("\n");
}
