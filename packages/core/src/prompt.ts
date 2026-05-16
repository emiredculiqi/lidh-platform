import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "./types";

/**
 * Builds the system prompt as Anthropic text blocks, with SPLIT caching
 * (ADR-001 #7 — the pricing-critical decision):
 *
 *  - Block 1 (persona + business facts): identical for every message in a
 *    conversation → tagged `cache_control: ephemeral` so Anthropic bills the
 *    cheap cache-read rate on turns 2..n instead of re-charging full input.
 *
 *  - Block 2 (retrieved knowledge): different for every user message (RAG
 *    pulls different passages each time) → NOT cached; caching it would never
 *    hit and would just add cache-write cost.
 *
 * If knowledge retrieval returned nothing, block 2 is omitted entirely.
 */
export function buildSystemPrompt(
  ctx: AgentContext,
): Anthropic.TextBlockParam[] {
  const stable = `${ctx.persona}\n\n${ctx.businessFacts}`.trim();

  const blocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: stable,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (ctx.knowledgeChunks.length > 0) {
    const knowledge = [
      "Relevant business knowledge (use this to answer; do not invent facts):",
      "",
      ...ctx.knowledgeChunks.map((c, i) => `[${i + 1}] ${c}`),
    ].join("\n");

    blocks.push({ type: "text", text: knowledge });
  }

  return blocks;
}
