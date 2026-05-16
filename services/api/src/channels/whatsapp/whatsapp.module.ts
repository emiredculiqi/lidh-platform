import { Module } from "@nestjs/common";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";
import { RetrievalService } from "../../chat/retrieval.service";
import { WHATSAPP_TRANSPORT } from "./transport";
import { StubWhatsAppTransport } from "./stub-transport";

/**
 * WHATSAPP_TRANSPORT is bound to the stub for now. M4.4 swaps this one line
 * to WhatChimpTransport (after validating WhatChimp is a pass-through) — the
 * service/controller/@lidh/core agent are untouched by the swap.
 *
 * RetrievalService is re-provided here (it's not exported by a global
 * module); EmbeddingModule + PrismaModule it depends on are @Global.
 */
@Module({
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    RetrievalService,
    { provide: WHATSAPP_TRANSPORT, useClass: StubWhatsAppTransport },
  ],
})
export class WhatsappModule {}
