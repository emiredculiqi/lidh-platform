import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext } from "./types";

/**
 * Platform-wide response-style directive. Applied to EVERY tenant/channel so
 * agents read like a helpful person, not a formatted document — regardless of
 * how short/unspecified a tenant's persona is. Lives in the stable (cached)
 * block, so it costs ~nothing per message. A persona can refine tone but
 * shouldn't need to repeat these mechanics.
 */
const RESPONSE_STYLE = `
RESPONSE STYLE (always follow):
- Write in natural, flowing conversational prose, like a helpful person replying in chat. Usually 1–3 short sentences.
- Use markdown sparingly: **bold** only to highlight a single key term; a short bullet list ONLY when genuinely enumerating 3+ distinct items (use "- ", never emoji as bullets).
- Never use markdown headings (#, ##), horizontal rules (---), or block quotes (>).
- At most one emoji, and only in an opening greeting or when confirming a captured contact — never decorative emoji, never an emoji per line.
- Write contact actions as links: [text](url) (e.g. [WhatsApp](https://wa.me/...)), never raw URLs or bare email addresses.
- Do not structure replies like a brochure or feature list unless explicitly asked. Answer the question, then optionally offer a next step in one sentence.
`.trim();

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
  const stable = `${ctx.persona}\n\n${ctx.businessFacts}\n\n${RESPONSE_STYLE}`.trim();

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
