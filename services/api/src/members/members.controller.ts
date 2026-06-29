import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { MembersService } from "./members.service";
import {
  InviteDto,
  SetRoleDto,
  TeamOverviewDto,
} from "./dto/member.dto";

@ApiTags("Team")
@Controller("tenants/:slug/team")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: "Team overview: members, pending invites, seat usage" })
  @ApiOkResponse({ type: TeamOverviewDto })
  overview(@Param("slug") slug: string): Promise<TeamOverviewDto> {
    return this.members.overview(slug);
  }

  @Post("invite")
  @ApiOperation({ summary: "Invite a member (plan-gated by seats)" })
  invite(
    @Param("slug") slug: string,
    @Body() dto: InviteDto,
  ): Promise<{ ok: true }> {
    return this.members.invite(slug, dto.email, dto.role);
  }

  @Post("members/:userId/role")
  @ApiOperation({ summary: "Promote/demote a member (admin↔agent)" })
  setRole(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() dto: SetRoleDto,
  ): Promise<{ ok: true }> {
    return this.members.setRole(slug, userId, dto.role);
  }

  @Delete("members/:userId")
  @ApiOperation({ summary: "Remove a member (not the owner)" })
  remove(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
  ): Promise<{ ok: true }> {
    return this.members.remove(slug, userId);
  }

  @Post("invitations/:id/resend")
  @ApiOperation({ summary: "Resend a pending invitation" })
  resend(
    @Param("slug") slug: string,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    return this.members.resendInvite(slug, id);
  }

  @Delete("invitations/:id")
  @ApiOperation({ summary: "Revoke a pending invitation" })
  revoke(
    @Param("slug") slug: string,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    return this.members.revokeInvite(slug, id);
  }
}
