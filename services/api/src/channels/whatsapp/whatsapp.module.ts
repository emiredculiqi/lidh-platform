import { Logger, Module } from "@nestjs/common";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";
import { WhatsAppOutboundService } from "./whatsapp-outbound.service";
import { RetrievalService } from "../../chat/retrieval.service";
import { WHATSAPP_TRANSPORT } from "./transport";
import { StubWhatsAppTransport } from "./stub-transport";
import { MetaCloudTransport } from "./meta-cloud-transport";

/**
 * WHATSAPP_TRANSPORT factory (direct Meta Tech Provider):
 *   META_APP_ID set → MetaCloudTransport (real Cloud API outbound)
 *   else            → StubWhatsAppTransport (logs only, dev/local)
 *
 * We gate on META_APP_ID because Meta being configured (app created +
 * Embedded Signup wired) is the signal that real WhatsApp is live; the
 * per-tenant token/phoneNumberId arrive per-send via OutboundContext, so
 * the transport itself needs no per-tenant env.
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
    WhatsAppOutboundService,
    RetrievalService,
    {
      provide: WHATSAPP_TRANSPORT,
      useFactory: () => {
        const log = new Logger("WhatsApp:Transport");
        if (process.env.META_APP_ID) {
          log.log("using MetaCloudTransport (META_APP_ID set)");
          return new MetaCloudTransport();
        }
        log.log("using StubWhatsAppTransport (META_APP_ID unset)");
        return new StubWhatsAppTransport();
      },
    },
  ],
  // Exported so ConversationsService can deliver operator replies to WhatsApp.
  exports: [WhatsAppOutboundService],
})
export class WhatsappModule {}
