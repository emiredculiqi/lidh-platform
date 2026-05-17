import { SetMetadata } from "@nestjs/common";

/**
 * Mark a route as PUBLIC — the global AuthGuard skips it. Use only for
 * genuinely unauthenticated endpoints: health, the web-chat SSE (anonymous
 * visitors), public demo resolution, channel webhooks.
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
