import { Module } from "@nestjs/common";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";
import { MetaCallbacksController } from "./meta-callbacks.controller";
import { MetaOnboardingService } from "./meta-onboarding.service";

/**
 * Channel connect/disconnect + status. Depends on CryptoService (@Global),
 * PrismaService (@Global), and TenantContextService (@Global). The Meta
 * Embedded Signup Graph client (MetaOnboardingService) is local to this module.
 *
 * MetaCallbacksController serves the app-level Deauthorize / Data Deletion
 * callbacks; it lives here because revocation is channel state.
 */
@Module({
  controllers: [ChannelsController, MetaCallbacksController],
  providers: [ChannelsService, MetaOnboardingService],
})
export class ChannelsModule {}
