import { Logger, Module } from "@nestjs/common";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";
import { RetrievalService } from "../../chat/retrieval.service";
import { WHATSAPP_TRANSPORT } from "./transport";
import { StubWhatsAppTransport } from "./stub-transport";
import { WhatChimpTransport } from "./whatchimp-transport";

/**
 * WHATSAPP_TRANSPORT factory (ADR-004, validated in M4.4):
 *   WHATCHIMP_API_TOKEN set → WhatChimpTransport (real outbound)
 *   else                    → StubWhatsAppTransport (logs only, dev)
 *
 * Swapping providers = changing env. The service/controller/@lidh/core
 * agent are untouched.
 *
 * RetrievalService is re-provided here (it's not exported by a global
 * module); EmbeddingModule + PrismaModule it depends on are @Global.
 */
@Module({
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    RetrievalService,
    {
      provide: WHATSAPP_TRANSPORT,
      useFactory: () => {
        const log = new Logger("WhatsApp:Transport");
        if (process.env.WHATCHIMP_API_TOKEN) {
          log.log("using WhatChimpTransport (WHATCHIMP_API_TOKEN set)");
          return new WhatChimpTransport();
        }
        log.log("using StubWhatsAppTransport (WHATCHIMP_API_TOKEN unset)");
        return new StubWhatsAppTransport();
      },
    },
  ],
})
export class WhatsappModule {}
