-- Per-contact checklist (ADR-024 §4). Additive: a new table, no change to
-- existing rows.

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactTask_contactId_done_createdAt_idx" ON "ContactTask"("contactId", "done", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactTask_tenantId_done_idx" ON "ContactTask"("tenantId", "done");

-- AddForeignKey
ALTER TABLE "ContactTask" ADD CONSTRAINT "ContactTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTask" ADD CONSTRAINT "ContactTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTask" ADD CONSTRAINT "ContactTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactTask" ADD CONSTRAINT "ContactTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
