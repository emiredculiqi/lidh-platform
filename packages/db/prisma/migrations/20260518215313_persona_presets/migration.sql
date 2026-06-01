-- CreateTable
CREATE TABLE "PersonaPreset" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "personas" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonaPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonaPreset_active_idx" ON "PersonaPreset"("active");
