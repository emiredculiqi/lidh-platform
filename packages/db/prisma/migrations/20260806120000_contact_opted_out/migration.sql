-- AlterTable
-- Opt-out state for a contact. Set when they reply STOP/UNSUBSCRIBE/ÇREGJISTROHU
-- on WhatsApp; while set, the agent must not reply. Required by the published
-- privacy policy and by the WhatsApp Business terms (consent obligation flows to
-- the Solution Provider).
ALTER TABLE "Contact" ADD COLUMN "optedOutAt" TIMESTAMP(3);

-- AlterEnum
-- Consent trail events. ADD VALUE cannot run inside a transaction block in
-- older Postgres, and Prisma wraps migrations in one — IF NOT EXISTS keeps this
-- safe to re-run if the statement has to be applied manually.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'contact_opted_out';
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'contact_opted_in';
