-- Record which preset a business persona was copied from (ADR-022), so the
-- admin console can tell whether a preset is in use before deactivating or
-- deleting it. Informational, not a foreign key. Additive; existing rows stay
-- null and are matched by content instead.

-- AlterTable
ALTER TABLE "AgentPersona" ADD COLUMN IF NOT EXISTS "presetId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentPersona_presetId_idx" ON "AgentPersona"("presetId");
