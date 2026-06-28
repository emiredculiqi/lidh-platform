-- AlterTable: shared "last read" marker per conversation (inbox unread counts).
ALTER TABLE "Conversation" ADD COLUMN "lastReadAt" TIMESTAMP(3);

-- AlterEnum: new activity-feed event kinds.
ALTER TYPE "EventKind" ADD VALUE 'conversation_started';
ALTER TYPE "EventKind" ADD VALUE 'contact_registered';
