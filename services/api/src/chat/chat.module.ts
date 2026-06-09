import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { RetrievalService } from "./retrieval.service";
import { PropertySearchService } from "./property-search.service";

@Module({
  controllers: [ChatController],
  providers: [ChatService, RetrievalService, PropertySearchService],
})
export class ChatModule {}
