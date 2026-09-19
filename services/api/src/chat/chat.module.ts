import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { RetrievalService } from "./retrieval.service";
import { IntakePurgeService } from "./intake-purge.service";

@Module({
  controllers: [ChatController],
  providers: [ChatService, RetrievalService, IntakePurgeService],
  // ConversationsModule drafts replies through ChatService (ADR-024 §5) —
  // one brain, not a third copy of the orchestration (ADR-004).
  exports: [ChatService],
})
export class ChatModule {}
