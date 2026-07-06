import { Global, Module } from "@nestjs/common";
import { CryptoService } from "./crypto.service";

/** @Global so any module (whatsapp, channels) can inject CryptoService. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
