import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { TenantsModule } from "../tenants/tenants.module";

/**
 * Hosts the self-serve signup endpoints (`/me`, `/onboarding/business`).
 * Reuses TenantsService for the actual create — adds atomic Membership
 * creation in the same transaction (ADR-013).
 */
@Module({
  imports: [TenantsModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
