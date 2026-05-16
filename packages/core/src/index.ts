// @lidh/core — the framework-agnostic agent runtime ("the chef").
// Consumers (services/api now; WhatsApp/Instagram adapters later) import
// runAgent + types from here. Zero Nest / Prisma / HTTP / env reads.

export { runAgent } from "./runAgent";
export { buildSystemPrompt } from "./prompt";
export { buildTools } from "./tools";
export {
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_AGENTIC_TURNS,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
} from "./constants";
export type {
  AgentRole,
  AgentMessage,
  ToolName,
  AgentContext,
  ToolInvocation,
  ToolOutcome,
  ExecuteTool,
  AgentEffect,
  AgentEvent,
  AgentDeps,
} from "./types";
