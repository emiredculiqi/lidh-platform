-- Customer stage on Contact: where this person stands with the business.
-- Additive: every existing contact becomes `new`. Operator-set from the inbox
-- right panel and the contacts page.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ContactStage" AS ENUM ('new', 'lead', 'client', 'not_a_fit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "stage" "ContactStage" NOT NULL DEFAULT 'new';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_tenantId_stage_idx" ON "Contact"("tenantId", "stage");
