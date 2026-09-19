-- Personal stars on conversations (ADR-024 §2). Additive: a new table, no
-- change to existing rows.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConversationStar" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationStar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationStar_userId_conversationId_key" ON "ConversationStar"("userId", "conversationId");
CREATE INDEX IF NOT EXISTS "ConversationStar_tenantId_userId_idx" ON "ConversationStar"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "ConversationStar" ADD CONSTRAINT "ConversationStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationStar" ADD CONSTRAINT "ConversationStar_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
