import { SetMetadata } from "@nestjs/common";

/** Reflector key the global AuthGuard reads to gate platform-admin-only routes. */
export const IS_PLATFORM_ADMIN_KEY = "isPlatformAdminOnly";

/**
 * Mark a controller method (or class) as platform-admin-only. After the
 * AuthGuard verifies the Clerk token and loads memberships (ADR-013), it
 * additionally checks this flag and rejects non-admins with 403.
 *
 * Use for: managing the persona-presets library, creating/listing all
 * tenants, the demo→paid graduation endpoint, etc.
 */
export const PlatformAdminOnly = () => SetMetadata(IS_PLATFORM_ADMIN_KEY, true);
