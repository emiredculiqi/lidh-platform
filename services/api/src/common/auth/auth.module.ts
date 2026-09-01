import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { ReadOnlyGuard } from "./read-only.guard";

/** Registers the global guards. Every controller route is protected unless
 *  marked @Public(). PrismaModule is @Global (guards inject PrismaService).
 *
 *  Order matters: AuthGuard runs FIRST (sets req.auth), then ReadOnlyGuard
 *  reads req.auth to reject mutations from a frozen tenant (ADR-017). Global
 *  guards execute in registration order within a module's providers array. */
@Global()
@Module({
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ReadOnlyGuard },
  ],
})
export class AuthModule {}
