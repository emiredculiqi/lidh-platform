import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * @Global so we don't need to re-import PrismaModule in every feature module.
 * Provides PrismaService anywhere in the app via DI.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
