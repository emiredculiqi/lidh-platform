import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL } from "./constants";
import type { AgentMessage } from "./types";

export type ExtractedContact = {
  name?: string;
  phone?: string;
  email?: string;
};

const RECORD_CONTACT_TOOL: Anthropic.Tool = {
  name: "record_contact",
  description:
    "Record contact details the VISITOR has explicitly provided about " +
    "themselves. Only include a field when the visitor clearly gave it; " +
    "omit anything not provided. Never invent or infer.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The visitor's own name, if they stated it.",
      },
      phone: {
        type: "string",
        description:
          "The visitor's phone number, as they gave it (spacing may be tidied).",
      },
      email: { type: "string", description: "The visitor's email address." },
    },
  },
};

/**
 * One-shot, non-streaming extraction of contact details from a conversation.
 *
 * Used to register a lead while a HUMAN has taken over (the agentic loop is
 * paused, so `capture_lead` never runs). Forces the `record_contact` tool so
 * the result is always structured. Pure: the only I/O is the Anthropic call —
 * no DB, no env reads (the caller supplies the key). Returns `{}` when the
 * visitor provided nothing.
 */
export async function extractContact(opts: {
  anthropicApiKey: string;
  messages: AgentMessage[];
  model?: string;
}): Promise<ExtractedContact> {
  const client = new Anthropic({ apiKey: opts.anthropicApiKey });

  const convo = opts.messages
    .slice(-10)
    .map((m) => `${m.role === "assistant" ? "Agent" : "Visitor"}: ${m.content}`)
    .join("\n");

  const res = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 256,
    tools: [RECORD_CONTACT_TOOL],
    tool_choice: { type: "tool", name: "record_contact" },
    messages: [
      {
        role: "user",
        content:
          "Extract ONLY the contact details the VISITOR provided about " +
          "themselves (their own name, phone, email). Do not infer or guess; " +
          "omit any field not clearly given.\n\n" +
          convo,
      },
    ],
  });

  const use = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  const input = (use?.input ?? {}) as Record<string, unknown>;
  const clean = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  return {
    name: clean(input.name),
    phone: clean(input.phone),
    email: clean(input.email),
  };
}
