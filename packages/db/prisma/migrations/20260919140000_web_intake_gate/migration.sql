-- Web intake gate (ADR-021): a new web conversation stays invisible to the
-- business until the visitor has given a name and email. Additive — every
-- existing conversation is grandfathered as visible (false).

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "intakePending" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex (purge of abandoned intakes)
CREATE INDEX IF NOT EXISTS "Conversation_intakePending_lastMsgAt_idx" ON "Conversation"("intakePending", "lastMsgAt");
