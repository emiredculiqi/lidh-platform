import { ApiProperty } from "@nestjs/swagger";

/** This-month usage figures for a tenant (customer conversations only). */
export class UsageDto {
  @ApiProperty({ description: "Start of the counted month (UTC, ISO)." })
  monthStart!: string;

  @ApiProperty({ description: "Customer conversations active this month." })
  conversations!: number;

  @ApiProperty({ description: "Messages from visitors this month." })
  messagesIn!: number;

  @ApiProperty({ description: "Replies from the agent this month." })
  messagesOut!: number;

  @ApiProperty({ description: "Leads captured this month." })
  leads!: number;

  @ApiProperty({ description: "Human-handoff requests this month." })
  handoffs!: number;

  @ApiProperty({ description: "Input tokens this month (AI cost signal)." })
  tokensIn!: number;

  @ApiProperty({ description: "Output tokens this month (AI cost signal)." })
  tokensOut!: number;
}
