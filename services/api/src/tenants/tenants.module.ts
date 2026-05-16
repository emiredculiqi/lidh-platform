import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

// PrismaModule is @Global — no imports needed.
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
