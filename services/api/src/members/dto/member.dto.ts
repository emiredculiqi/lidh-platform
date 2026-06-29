import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn } from "class-validator";

export class TeamMemberDto {
  @ApiProperty({ example: "clx_user1" }) userId!: string;
  @ApiProperty({ example: "ana@example.com" }) email!: string;
  @ApiProperty({ example: "Ana B.", nullable: true, type: String })
  name!: string | null;
  @ApiProperty({ example: "admin", enum: ["owner", "admin", "agent"] })
  role!: string;
  @ApiProperty({ example: "2026-06-01T10:00:00.000Z" }) joinedAt!: Date;
}

export class TeamInvitationDto {
  @ApiProperty({ example: "clx_inv1" }) id!: string;
  @ApiProperty({ example: "new@example.com" }) email!: string;
  @ApiProperty({ example: "agent", enum: ["admin", "agent"] }) role!: string;
  @ApiProperty({ example: "pending" }) status!: string;
  @ApiProperty({ example: "2026-06-27T10:00:00.000Z" }) createdAt!: Date;
  @ApiProperty({ example: "2026-07-11T10:00:00.000Z" }) expiresAt!: Date;
}

export class TeamSeatsDto {
  @ApiProperty({ example: 3, description: "active members + pending invites" })
  used!: number;
  @ApiProperty({ example: 5, description: "effective cap (trial = Premium)" })
  max!: number;
}

export class TeamOverviewDto {
  @ApiProperty({ type: TeamSeatsDto }) seats!: TeamSeatsDto;
  @ApiProperty({ type: [TeamMemberDto] }) members!: TeamMemberDto[];
  @ApiProperty({ type: [TeamInvitationDto] }) invitations!: TeamInvitationDto[];
}

export class InviteDto {
  @ApiProperty({ example: "new@example.com" })
  @IsEmail()
  email!: string;
  @ApiProperty({ enum: ["admin", "agent"] })
  @IsIn(["admin", "agent"])
  role!: "admin" | "agent";
}

export class SetRoleDto {
  @ApiProperty({ enum: ["admin", "agent"] })
  @IsIn(["admin", "agent"])
  role!: "admin" | "agent";
}
