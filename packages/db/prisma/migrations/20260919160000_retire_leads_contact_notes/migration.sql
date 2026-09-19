-- Retire the Lead module (ADR-023): a "lead" is a contact the team (or the
-- assistant, by suggestion) has marked as such, plus what they wanted — not a
-- separate object with its own status ladder.
--
-- Order matters and everything runs in one release:
--   1. create ContactNote
--   2. copy every Lead onto its contact as an intent note
--   3. move those contacts New → Lead (never downgrading a Client)
--   4. drop Lead and LeadStatus
-- Leads without a contact (orphaned by an earlier contact delete) carry no
-- usable identity and are dropped with the table.

-- 1. CreateEnum + CreateTable
DO $$ BEGIN
  CREATE TYPE "ContactNoteKind" AS ENUM ('intent', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ContactNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "kind" "ContactNoteKind" NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContactNote_contactId_createdAt_idx" ON "ContactNote"("contactId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContactNote_tenantId_createdAt_idx" ON "ContactNote"("tenantId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Copy leads onto their contacts as intent notes. The note body is the
--    assistant's summary when it wrote one; otherwise a line composed from the
--    captured fields so nothing silently disappears.
INSERT INTO "ContactNote" ("id", "tenantId", "contactId", "conversationId", "kind", "body", "createdAt")
SELECT
  'note_' || l."id",
  l."tenantId",
  l."contactId",
  l."conversationId",
  'intent',
  COALESCE(
    NULLIF(TRIM(l."payload"->>'notes'), ''),
    CONCAT_WS(' · ',
      NULLIF(TRIM(l."payload"->>'name'), ''),
      NULLIF(TRIM(l."payload"->>'email'), ''),
      NULLIF(TRIM(l."payload"->>'phone'), '')
    ),
    'Interest detected'
  ),
  l."capturedAt"
FROM "Lead" l
WHERE l."contactId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ContactNote" n WHERE n."id" = 'note_' || l."id");

-- 3. Those contacts are leads (unless already further along).
UPDATE "Contact" c
   SET "stage" = 'lead'
 WHERE c."stage" = 'new'
   AND EXISTS (SELECT 1 FROM "Lead" l WHERE l."contactId" = c."id");

-- 4. Drop the module's storage.
DROP TABLE IF EXISTS "Lead";
DROP TYPE IF EXISTS "LeadStatus";
