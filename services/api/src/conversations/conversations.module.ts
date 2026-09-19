import { Module } from "@nestjs/common";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { WhatsappModule } from "../channels/whatsapp/whatsapp.module";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [
    WhatsappModule, // for WhatsAppOutboundService (operator replies)
    ChatModule, // for ChatService.suggestReply (ADR-024 §5)
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
