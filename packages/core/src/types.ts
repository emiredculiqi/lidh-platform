// The "chef's" public contract. Plain types — no Prisma, no Nest, no HTTP.
// The API shell maps @lidh/db rows into AgentContext and consumes AgentEvent.

export type AgentRole = "user" | "assistant";

export interface AgentMessage {
  role: AgentRole;
  content: string;
}

/** Tools the platform knows how to run. Per-tenant subset via toolsEnabled.
 *  `search_properties` is the real-estate vertical tool (ADR-016) — enabled
 *  only for agency tenants via Agent.toolsEnabled. */
export type ToolName =
  | "capture_lead"
  | "request_human_handoff"
  | "search_properties";

/**
 * Everything the chef needs to cook one reply. Assembled by the API shell:
 * persona/businessFacts from the tenant's Agent config, knowledgeChunks from
 * the shell's RAG retrieval, history from persisted Messages.
 */
export interface AgentContext {
  /** Lidh.al-internal locale code: "al" | "en" | "it" | "de" | ... */
  locale: string;
  /** AgentPersona.content for `locale` (already resolved by the shell). */
  persona: string;
  /** Stable business facts (hours, contact, policies) for this tenant. */
  businessFacts: string;
  /** Top-k retrieved knowledge passages for THIS user message (RAG). */
  knowledgeChunks: string[];
  /** Prior conversation turns (user/assistant), oldest first. */
  history: AgentMessage[];
  /** Which tools are active for this tenant (from Agent.toolsEnabled). */
  toolsEnabled: ToolName[];
  /** Model override; falls back to DEFAULT_MODEL when omitted. */
  model?: string;
}

/** A tool call the model wants the shell to perform. */
export interface ToolInvocation {
  name: ToolName;
  input: Record<string, unknown>;
  /** Recent transcript text, for the shell to attach to the lead/handoff. */
  transcript: string;
}

/** What the shell returns after performing a tool call. */
export interface ToolOutcome {
  /** Text fed back into the model so it can continue the conversation. */
  result: string;
  /** Optional client-visible effect (banner in the widget). */
  effect?: AgentEffect;
}

/** The injected port — the shell decides how a tool actually takes effect. */
export type ExecuteTool = (inv: ToolInvocation) => Promise<ToolOutcome>;

export type AgentEffect =
  | { type: "lead_captured" }
  | { type: "human_handoff" };

/** The event stream the chef yields. Wire vocabulary preserved from the
 *  existing widget: text / effect / done / error (+ usage for token billing). */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "effect"; effect: AgentEffect }
  | {
      type: "usage";
      tokensIn: number;
      tokensOut: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
    }
  | { type: "done" }
  | { type: "error"; message: string };

/** Injected dependencies — secrets and side-effects, never read from env
 *  inside core (the shell owns config). */
export interface AgentDeps {
  /** Anthropic API key (injected by the shell from its env/secrets). */
  anthropicApiKey: string;
  /** Performs a tool call (writes Lead/Event rows, etc.). */
  executeTool: ExecuteTool;
}
