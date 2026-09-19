import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { RetrievalService } from "./retrieval.service";
import { IntakePurgeService } from "./intake-purge.service";

@Module({
  controllers: [ChatController],
  providers: [ChatService, RetrievalService, IntakePurgeService],
})
export class ChatModule {}
