import { Global, Module } from "@nestjs/common";
import { LiveController } from "./live.controller";
import { LiveService } from "./live.service";

/** @Global so chat/whatsapp services can inject LiveService to publish events. */
@Global()
@Module({
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
