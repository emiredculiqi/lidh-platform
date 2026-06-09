import type Anthropic from "@anthropic-ai/sdk";
import type { ToolName } from "./types";

/**
 * Tool *definitions* live in core (the schema the model sees). Tool
 * *execution* is injected by the shell via AgentDeps.executeTool — core
 * never writes to a database or sends email.
 *
 * `buildTools` returns only the tools enabled for the tenant, in a
 * deterministic order. Deterministic order matters: tools render before the
 * system prompt in the Anthropic request, so a stable order keeps the cached
 * prefix stable across requests.
 */
const ALL_TOOLS: Record<ToolName, Anthropic.Tool> = {
  capture_lead: {
    name: "capture_lead",
    description:
      "Save the visitor as a sales lead and notify the business. Call this " +
      "when the visitor shows clear interest (asks for a meeting, demo, " +
      "pricing, says 'contact me', or shares contact info unprompted). Pass " +
      "whatever contact details you have — partial info is fine.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor's name if given." },
        email: { type: "string", description: "Visitor's email if given." },
        phone: { type: "string", description: "Visitor's phone if given." },
        notes: {
          type: "string",
          description:
            "One-paragraph summary of what the visitor needs and why they're interested.",
        },
      },
      required: ["notes"],
    },
  },
  request_human_handoff: {
    name: "request_human_handoff",
    description:
      "Escalate to a human when you cannot help, the visitor explicitly asks " +
      "for a person, or the question needs specialized knowledge (custom " +
      "pricing, complex integration, legal/contract). Do not call this for " +
      "greetings or simple FAQ you can answer.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short reason for the handoff.",
        },
        summary: {
          type: "string",
          description: "What the visitor needs and relevant context.",
        },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
      required: ["reason", "summary"],
    },
  },
  // Real-estate vertical (ADR-016). Server-executed against the structured
  // Property table — exact filtering + a "nearest area" fallback the shell
  // computes. Returns matches WITH their canonical listing URLs so the model
  // can hand the visitor a verbatim link.
  search_properties: {
    name: "search_properties",
    description:
      "Search this agency's real-estate listings by structured criteria and " +
      "get back matching properties, each WITH its exact listing-page URL. " +
      "Call this whenever the visitor is looking for a property, asks what's " +
      "available, or refines their preferences. Pass ONLY the filters the " +
      "visitor has actually expressed — omit everything else. If there is no " +
      "exact match the tool automatically returns the nearest alternatives " +
      "(nearby areas / closest options); when it does, tell the visitor these " +
      "are alternatives, not exact matches. Always show each result's URL " +
      "exactly as returned; never invent or alter a link.",
    input_schema: {
      type: "object",
      properties: {
        listingType: {
          type: "string",
          enum: ["sale", "rent"],
          description:
            "Buy vs rent. Albanian cues: 'me qera'/'qera' = rent; " +
            "'shitje'/'në shitje'/'blej' = sale.",
        },
        city: {
          type: "string",
          description: "City, e.g. 'Tiranë' or 'Durrës'.",
        },
        area: {
          type: "string",
          description:
            "Neighborhood / zone if named, e.g. 'Pazari i Ri', 'Bllok', 'Ali Demi'.",
        },
        propertyType: {
          type: "string",
          description:
            "Category if specified, e.g. 'Apartament', 'Vile', 'Magazine', 'Zyrë', 'Tokë', 'Dyqan'.",
        },
        minPrice: { type: "number", description: "Minimum price in EUR." },
        maxPrice: {
          type: "number",
          description: "Maximum price / budget in EUR.",
        },
        bedrooms: {
          type: "number",
          description: "Desired bedrooms (treated as a minimum).",
        },
        bathrooms: {
          type: "number",
          description: "Desired bathrooms (treated as a minimum).",
        },
        minAreaSqm: {
          type: "number",
          description: "Minimum area in square meters.",
        },
        maxAreaSqm: {
          type: "number",
          description: "Maximum area in square meters.",
        },
      },
      required: [],
    },
  },
};

const TOOL_ORDER: ToolName[] = [
  "capture_lead",
  "request_human_handoff",
  "search_properties",
];

export function buildTools(enabled: ToolName[]): Anthropic.Tool[] {
  const set = new Set(enabled);
  return TOOL_ORDER.filter((name) => set.has(name)).map(
    (name) => ALL_TOOLS[name],
  );
}
