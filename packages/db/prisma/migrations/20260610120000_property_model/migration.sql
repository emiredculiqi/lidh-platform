-- Real-estate vertical (ADR-016): structured Property inventory + listing-type enum.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PropertyListingType" AS ENUM ('sale', 'rent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "listingType" "PropertyListingType" NOT NULL,
    "propertyType" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "priceEur" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" INTEGER,
    "floor" INTEGER,
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Property_tenantId_externalId_key" ON "Property"("tenantId", "externalId");
CREATE INDEX IF NOT EXISTS "Property_tenantId_status_city_listingType_idx" ON "Property"("tenantId", "status", "city", "listingType");
CREATE INDEX IF NOT EXISTS "Property_tenantId_status_listingType_priceEur_idx" ON "Property"("tenantId", "status", "listingType", "priceEur");
CREATE INDEX IF NOT EXISTS "Property_tenantId_status_bedrooms_idx" ON "Property"("tenantId", "status", "bedrooms");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
