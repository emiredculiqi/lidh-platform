import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { TenantContextModule } from "./common/tenant-context/tenant-context.module";
import { HealthModule } from "./health/health.module";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [
    // Global env loader. Reads .env from cwd; in dev that's services/api/.env.
    // In Docker/Fly we inject env via Fly secrets, so .env is dev-only.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    TenantContextModule,
    HealthModule,
    ChatModule,
  ],
})
export class AppModule {}
