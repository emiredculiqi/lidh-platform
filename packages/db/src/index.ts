// @lidh/db — single source of truth for the Prisma client + types.
// Consumers: import { prisma, type Tenant, ... } from "@lidh/db".

import { PrismaClient } from "@prisma/client";

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

// Re-export every generated type/enum so consumers don't reach into @prisma/client.
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
} from "@prisma/client";

// Re-export the client class so consumers can type their own references
// without taking a direct dep on @prisma/client.
export { PrismaClient } from "@prisma/client";

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
} from "@prisma/client";
