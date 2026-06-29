-- Rename the (misnamed) Lek price column to EUR.
ALTER TABLE "Plan" RENAME COLUMN "priceLekePerMonth" TO "priceEurPerMonth";

-- EUR yearly price, one-time setup fee, and the monthly conversations quota.
ALTER TABLE "Plan" ADD COLUMN "priceEurPerYear" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "setupFeeEur" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "conversationsPerMonth" INTEGER NOT NULL DEFAULT 0;
