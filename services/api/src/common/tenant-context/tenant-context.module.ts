import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TenantContextService } from "./tenant-context.service";
import { TenantContextInterceptor } from "./tenant-context.interceptor";

/**
 * @Global so any feature module can inject TenantContextService without
 * re-importing TenantContextModule.
 *
 * The APP_INTERCEPTOR provider registers TenantContextInterceptor across
 * EVERY HTTP route automatically — feature modules don't need to opt in.
 */
@Global()
@Module({
  providers: [
    TenantContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextService],
})
export class TenantContextModule {}
