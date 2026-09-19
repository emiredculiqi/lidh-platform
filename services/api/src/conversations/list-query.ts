import type { Prisma } from "@lidh/db";
import { CONTACT_STAGES, type ContactStageValue } from "../contacts/dto/contact.dto";

export const LIST_CHANNELS = ["web", "whatsapp", "instagram"] as const;
export type ListChannel = (typeof LIST_CHANNELS)[number];

export const LIST_ONLY = ["unanswered"] as const;
export type ListOnly = (typeof LIST_ONLY)[number];

export { CONTACT_STAGES };

/** The inbox filters, already validated by the controller DTO. */
export interface ConversationListFilters {
  q?: string;
  channel?: ListChannel;
  stage?: ContactStageValue;
  only?: ListOnly;
  includePreview?: boolean;
}

/** Longest search string we hand to ILIKE. */
export const MAX_QUERY_CHARS = 100;

/**
 * Build the Prisma `where` for the inbox list. Pure, so the shape is unit
 * tested without a database.
 *
 * - Tenant scoping and the intake gate (ADR-021) are ALWAYS present.
 * - `q` matches the contact (name, phone, email) OR any message body in the
 *   thread, case-insensitive substring. Message search is a correlated EXISTS
 *   over the thread's messages — fine at our scale, and it lets an operator
 *   find "the customer who asked about delivery to Durrës".
 * - `only=unanswered` is expressed as an id list computed by the caller (the
 *   "latest message is from the customer" test is not a Prisma predicate).
 */
export function conversationListWhere(
  tenantId: string,
  f: ConversationListFilters,
  awaitingIds?: string[],
): Prisma.ConversationWhereInput {
  const q = f.q?.trim().slice(0, MAX_QUERY_CHARS);
  const and: Prisma.ConversationWhereInput[] = [];

  if (f.channel) and.push({ channel: { kind: f.channel } });
  if (f.stage) and.push({ contact: { stage: f.stage } });
  if (q) {
    and.push({
      OR: [
        { contact: { name: { contains: q, mode: "insensitive" } } },
        { contact: { phone: { contains: q } } },
        { contact: { email: { contains: q, mode: "insensitive" } } },
        {
          messages: {
            some: { contentText: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  if (f.only === "unanswered") and.push({ id: { in: awaitingIds ?? [] } });

  return {
    tenantId,
    ...(f.includePreview ? {} : { kind: "customer" }),
    // Web intake gate (ADR-021): invisible until name + email given.
    intakePending: false,
    ...(and.length ? { AND: and } : {}),
  };
}
