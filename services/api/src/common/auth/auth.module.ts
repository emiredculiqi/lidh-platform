import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";

/** Registers AuthGuard globally. Every controller route is protected unless
 *  marked @Public(). PrismaModule is @Global (guard injects PrismaService). */
@Global()
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
