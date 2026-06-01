// Runtime defaults. A tenant can override `model` via Agent.modelOverride;
// the rest are platform-wide guards (kept tight — see the pricing ADR).

/** Cheap + fast; the right default for FAQ + lead capture. */
export const DEFAULT_MODEL = "claude-haiku-4-5";

/**
 * Models an operator may pick per tenant (ADR-011). Kept deliberately small:
 * Haiku is the cost-efficient default; Sonnet trades cost for quality on
 * harder conversations. Stored in Agent.modelOverride; null ⇒ DEFAULT_MODEL.
 */
export const SELECTABLE_MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku — fast & low-cost (default)",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet — higher quality, higher cost",
  },
] as const;

export type SelectableModelId = (typeof SELECTABLE_MODELS)[number]["id"];

/** True if `id` is an allowed per-tenant model choice. */
export function isSelectableModel(id: unknown): id is SelectableModelId {
  return (
    typeof id === "string" &&
    SELECTABLE_MODELS.some((m) => m.id === id)
  );
}

/** Max tokens the model may generate per turn. */
export const MAX_OUTPUT_TOKENS = 1024;

/** Max agentic loop iterations (model → tool → model → …). Bounds cost. */
export const MAX_AGENTIC_TURNS = 4;

/** Max prior messages accepted as history (older are dropped by the shell). */
export const MAX_HISTORY = 40;

/** Max characters per user message (the shell validates against this). */
export const MAX_MESSAGE_CHARS = 4000;
