import { Module } from "@nestjs/common";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { WhatsappModule } from "../channels/whatsapp/whatsapp.module";

@Module({
  imports: [WhatsappModule], // for WhatsAppOutboundService (operator replies)
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
