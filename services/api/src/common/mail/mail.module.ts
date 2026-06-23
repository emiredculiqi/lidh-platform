import { Global, Module } from "@nestjs/common";
import { MailService } from "./mail.service";

/** @Global so any channel (web chat, WhatsApp) can inject MailService to send
 *  lead/handoff notifications without re-importing the module. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
