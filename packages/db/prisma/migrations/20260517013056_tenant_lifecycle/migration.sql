-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'archived');

-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'active';
