import { Module } from "@nestjs/common";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";
import { MetaOnboardingService } from "./meta-onboarding.service";

/**
 * Channel connect/disconnect + status. Depends on CryptoService (@Global),
 * PrismaService (@Global), and TenantContextService (@Global). The Meta
 * Embedded Signup Graph client (MetaOnboardingService) is local to this module.
 */
@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, MetaOnboardingService],
})
export class ChannelsModule {}
