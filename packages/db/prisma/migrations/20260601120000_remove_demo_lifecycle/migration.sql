-- Funnel URL refactor (ADR-014): the "demo URL" concept is deprecated.
-- Every tenant now gets a permanent funnel page at app.lidh.al/b/<slug>
-- from creation. The trial is enforced by Tenant.trialEndsAt (already in
-- the schema), not by a separate token+expiry pair.
--
-- Drops:
--   - CHECK constraint tenant_demo_consistency_check (added in
--     20260509193528_integrity_constraints) — depended on the columns
--     we're about to drop, so it must go first.
--   - Unique index Tenant_demoToken_key — same reason.
--   - Plain index Tenant_isDemo_idx — same reason.
--   - Columns isDemo, demoToken, demoExpiresAt.
--
-- Idempotent (IF EXISTS) so the migration also runs cleanly against a
-- DB that's already been reset / re-seeded mid-development.

ALTER TABLE "Tenant" DROP CONSTRAINT IF EXISTS "tenant_demo_consistency_check";

DROP INDEX IF EXISTS "Tenant_demoToken_key";
DROP INDEX IF EXISTS "Tenant_isDemo_idx";

ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "isDemo";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "demoToken";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "demoExpiresAt";

-- Rename the event kind: same semantic (a visitor opened a tenant's hosted
-- agent page), just no longer "demo". DO block makes this idempotent if a
-- prior run already renamed it.
DO $$ BEGIN
  ALTER TYPE "EventKind" RENAME VALUE 'demo_link_visited' TO 'funnel_visited';
EXCEPTION
  WHEN invalid_parameter_value THEN NULL; -- value already renamed
  WHEN undefined_object THEN NULL;        -- enum already missing the old value
END $$;
