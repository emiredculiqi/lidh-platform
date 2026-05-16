import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_MODEL,
  MAX_AGENTIC_TURNS,
  MAX_OUTPUT_TOKENS,
} from "./constants";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";
import type {
  AgentContext,
  AgentDeps,
  AgentEvent,
  ToolName,
} from "./types";

/**
 * The agent runtime. Generalized from the marketing chatbot's agentic loop.
 *
 * Async generator (ADR-001 #1): yields events as they happen — the shell
 * adapts them to SSE for web, or just collects the final text for WhatsApp.
 *
 * Pure-ish: the only I/O is the Anthropic call. All side-effects (saving
 * leads, sending email) go through deps.executeTool (ADR-001 #2). No env
 * reads, no DB, no HTTP here.
 */
export async function* runAgent(
  ctx: AgentContext,
  deps: AgentDeps,
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic({ apiKey: deps.anthropicApiKey });
  const system = buildSystemPrompt(ctx);
  const tools = buildTools(ctx.toolsEnabled);
  const model = ctx.model ?? DEFAULT_MODEL;

  const conversation: Anthropic.MessageParam[] = ctx.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    for (let turn = 0; turn < MAX_AGENTIC_TURNS; turn++) {
      const stream = client.messages.stream({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        tools,
        messages: conversation,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", delta: event.delta.text };
        }
      }

      const final = await stream.finalMessage();

      yield {
        type: "usage",
        tokensIn: final.usage.input_tokens,
        tokensOut: final.usage.output_tokens,
        cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
      };

      conversation.push({ role: "assistant", content: final.content });

      if (final.stop_reason !== "tool_use") break;

      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      const transcript = formatTranscript(conversation);
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const use of toolUses) {
        const outcome = await deps.executeTool({
          name: use.name as ToolName,
          input: (use.input ?? {}) as Record<string, unknown>,
          transcript,
        });
        if (outcome.effect) {
          yield { type: "effect", effect: outcome.effect };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: outcome.result,
        });
      }

      conversation.push({ role: "user", content: toolResults });
    }

    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "agent_failed",
    };
  }
}

/** Last ~12 turns flattened to text, for attaching to a lead/handoff. */
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
                if (b.type === "tool_result") return "[tool_result]";
                return "";
              })
              .filter(Boolean)
              .join(" ");
      return `${m.role}: ${text}`;
    })
    .join("\n");
}
