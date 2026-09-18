-- Retire the real-estate vertical (ADR-019). Exact inverse of
-- 20260610120000_property_model. IRREVERSIBLE: every listing row is dropped
-- with the table — decided 2026-09-18; the data was explicitly not wanted.
-- Applied to production by the next `fly deploy` (release_command).

-- DropTable (foreign key and indexes are dropped with it)
DROP TABLE IF EXISTS "Property";

-- DropEnum (must follow the table that referenced it)
DROP TYPE IF EXISTS "PropertyListingType";
