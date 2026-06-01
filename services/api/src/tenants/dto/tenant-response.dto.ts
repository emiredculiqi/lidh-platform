import { ApiProperty } from "@nestjs/swagger";

export class TenantResponseDto {
  @ApiProperty({ example: "clx_tenant123" })
  id!: string;

  @ApiProperty({ example: "bar-roma" })
  slug!: string;

  @ApiProperty({ example: "Bar Roma" })
  name!: string;

  @ApiProperty({ example: "al" })
  defaultLocale!: string;

  @ApiProperty({
    description:
      "Permanent public funnel page for this tenant. Same URL for the " +
      "whole lifecycle — the *service* (the agent answering) is what gates, " +
      "not the URL. Shows a soft 'currently offline' message if `isActive=false`.",
    example: "https://app.lidh.al/b/bar-roma",
  })
  funnelUrl!: string;

  @ApiProperty({
    description:
      "End of the free trial period. null = trial cleared (paid plan " +
      "assigned, or admin explicitly cleared). When set and in the future, " +
      "tenant is active during the trial regardless of `planId`.",
    example: "2026-06-15T00:00:00.000Z",
    nullable: true,
    type: String,
  })
  trialEndsAt!: Date | null;

  @ApiProperty({
    description:
      "FK to Plan. null = no paid plan assigned (tenant relies on trial or " +
      "is inactive). Set by admin via /grant-plan after payment.",
    example: null,
    nullable: true,
    type: String,
  })
  planId!: string | null;

  @ApiProperty({
    description:
      "True if the tenant's agent is currently allowed to serve customers. " +
      "Computed: status=active AND (trialEndsAt in future OR planId set).",
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description:
      "Service state. `archived` = subscription paused: the agent stops " +
      "serving on every channel, data retained, reversible via reactivate.",
    example: "active",
    enum: ["active", "archived"],
  })
  status!: string;

  @ApiProperty({
    description: "When the tenant was archived (null while active).",
    example: null,
    nullable: true,
    type: String,
  })
  archivedAt!: Date | null;

  @ApiProperty({
    description:
      "Owner's email pre-assigned by admin (ADR-015). Set when the tenant " +
      "was created on the SMB's behalf but no User with that email existed " +
      "yet. AuthGuard JIT-binds them as owner on first sign-in, then nulls " +
      "this. While set, the SMB doesn't yet have dashboard access.",
    example: null,
    nullable: true,
    type: String,
  })
  pendingOwnerEmail!: string | null;

  @ApiProperty({
    description:
      "Email of the currently-bound owner (the User with the oldest " +
      "Membership.role=owner). null if the tenant has no owner yet — in " +
      "which case `pendingOwnerEmail` may still be set, waiting for that " +
      "person's first sign-in.",
    example: "owner@bar-roma.al",
    nullable: true,
    type: String,
  })
  ownerEmail!: string | null;

  @ApiProperty({ example: "2026-05-16T12:00:00.000Z" })
  createdAt!: Date;
}

/**
 * Shape returned by GET /v1/funnel/:slug — what the public funnel page needs
 * to render. No auth required. Includes `isActive` so the page can either
 * boot the chat (active) or show the soft "currently offline" message
 * (inactive — trial expired, no plan, or archived).
 */
export class FunnelResolveResponseDto {
  @ApiProperty({
    description: "Slug to pass to POST /v1/chat/web as tenantSlug.",
    example: "bar-roma",
  })
  tenantSlug!: string;

  @ApiProperty({ example: "Bar Roma" })
  name!: string;

  @ApiProperty({ example: "al" })
  defaultLocale!: string;

  @ApiProperty({
    description: "Languages the agent has personas for.",
    example: ["al", "en"],
    type: [String],
  })
  locales!: string[];

  @ApiProperty({
    description:
      "If false, the funnel page should show 'currently offline' instead of " +
      "booting the chat. Causes: trial expired without a plan, plan lapsed, " +
      "or tenant archived.",
    example: true,
  })
  isActive!: boolean;
}
