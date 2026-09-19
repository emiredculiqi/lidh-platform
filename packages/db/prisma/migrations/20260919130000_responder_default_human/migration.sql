-- Human answers by default; the assistant is a per-business setting (ADR-020,
-- finally landing ADR-018 Decision 2 — "Level 0 Off is the default").
--
-- Conversation: `aiPaused` (a boolean that could not tell "inherited" from
-- "a human took over") becomes a nullable `aiOverride`. Every existing takeover
-- is preserved as an explicit `human` override; everything else inherits.
--
-- Tenant: every business that exists today keeps the assistant answering
-- (responder.mode = 'ai'), so nothing changes for them on deploy. Tenants
-- created afterwards have no `responder` key and resolve to human.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ConversationAiOverride" AS ENUM ('human', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: add the override, carry takeovers across, drop the boolean
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "aiOverride" "ConversationAiOverride";
UPDATE "Conversation" SET "aiOverride" = 'human' WHERE "aiPaused" = true AND "aiOverride" IS NULL;
ALTER TABLE "Conversation" DROP COLUMN IF EXISTS "aiPaused";

-- Backfill: existing businesses keep AI on
UPDATE "Tenant"
   SET "settings" = COALESCE("settings", '{}'::jsonb) || '{"responder":{"mode":"ai"}}'::jsonb
 WHERE NOT (COALESCE("settings", '{}'::jsonb) ? 'responder');
