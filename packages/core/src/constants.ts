// Runtime defaults. A tenant can override `model` via Agent.modelOverride;
// the rest are platform-wide guards (kept tight — see the pricing ADR).

/** Cheap + fast; the right default for FAQ + lead capture. */
export const DEFAULT_MODEL = "claude-haiku-4-5";

/** Max tokens the model may generate per turn. */
export const MAX_OUTPUT_TOKENS = 1024;

/** Max agentic loop iterations (model → tool → model → …). Bounds cost. */
export const MAX_AGENTIC_TURNS = 4;

/** Max prior messages accepted as history (older are dropped by the shell). */
export const MAX_HISTORY = 40;

/** Max characters per user message (the shell validates against this). */
export const MAX_MESSAGE_CHARS = 4000;
