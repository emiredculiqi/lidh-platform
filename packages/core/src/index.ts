// @lidh/core — the framework-agnostic agent runtime ("the chef").
// Consumers (services/api now; WhatsApp/Instagram adapters later) import
// runAgent + types from here. Zero Nest / Prisma / HTTP / env reads.

export { runAgent } from "./runAgent";
export { extractContact, type ExtractedContact } from "./extractContact";
export { buildSystemPrompt } from "./prompt";
export { buildTools } from "./tools";
export {
  PERSONA_PRESETS,
  PRESET_LOCALES,
  PRIMARY_LOCALE,
  getPersonaPreset,
  expandPreset,
  expandPersonas,
} from "./personaPresets";
export type { PresetLocale, PersonaPreset } from "./personaPresets";
export {
  DEFAULT_MODEL,
  SELECTABLE_MODELS,
  isSelectableModel,
  MAX_OUTPUT_TOKENS,
  MAX_AGENTIC_TURNS,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
} from "./constants";
export type { SelectableModelId } from "./constants";
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
