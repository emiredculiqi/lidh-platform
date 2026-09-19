-- AlterEnum
-- Reply drafts for the team (ADR-024 §5) are recorded as events with their
-- token cost in meta; nothing else is persisted. ADD VALUE cannot run inside
-- a transaction block in older Postgres, and Prisma wraps migrations in one —
-- IF NOT EXISTS keeps this safe to re-run if applied manually.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'reply_suggested';
