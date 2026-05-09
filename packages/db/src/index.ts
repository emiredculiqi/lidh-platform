// @lidh/db — single source of truth for the Prisma client + types.
// Consumers: import { prisma, type Tenant, ... } from "@lidh/db".

import { PrismaClient } from "./generated/prisma";

// Cache the client on globalThis so hot-reload (Next HMR, ts-node-dev, Nest watch)
// doesn't leak a new connection pool on every module re-evaluation.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export every generated type/enum so consumers don't reach into ./generated.
// `export type *` keeps runtime imports out (smaller bundles, no accidental side effects).
export type {
  User,
  Tenant,
  Plan,
  Membership,
  Agent,
  AgentPersona,
  Channel,
  KnowledgeSource,
  KnowledgeChunk,
  Contact,
  Conversation,
  Message,
  Lead,
  Event,
  UsageDaily,
  Prisma,
} from "./generated/prisma";

// Enums need a runtime export (they're real values, not just types).
export {
  MembershipRole,
  ChannelKind,
  ChannelStatus,
  KnowledgeSourceKind,
  KnowledgeSourceStatus,
  ConversationStatus,
  ConversationKind,
  MessageRole,
  LeadStatus,
  EventKind,
} from "./generated/prisma";
