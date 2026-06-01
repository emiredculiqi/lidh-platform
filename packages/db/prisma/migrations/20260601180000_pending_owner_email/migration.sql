-- Owner-email binding (ADR-015): admin-created tenants need a way to attach
-- to their business owner's Clerk user. We don't run an email/invite flow
-- yet — instead we store the intended owner's email here, and the API's
-- AuthGuard JIT-creates step scans this column on every new sign-in and
-- binds the matching User as `owner`, then nulls the field out.
--
-- Idempotent (IF NOT EXISTS) so the migration also runs cleanly against a
-- DB that was re-seeded mid-development.

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "pendingOwnerEmail" TEXT;

CREATE INDEX IF NOT EXISTS "Tenant_pendingOwnerEmail_idx"
  ON "Tenant"("pendingOwnerEmail");
