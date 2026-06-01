import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

// PrismaModule is @Global — no imports needed.
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  // Exported so OnboardingModule can call createTenant() for self-serve signup.
  exports: [TenantsService],
})
export class TenantsModule {}
