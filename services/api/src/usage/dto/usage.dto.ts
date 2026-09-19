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

  @ApiProperty({ description: "Contacts with an identity (name/phone/email) first seen this month." })
  newContacts!: number;

  @ApiProperty({ description: "Human-handoff requests this month." })
  handoffs!: number;

  @ApiProperty({ description: "Input tokens this month (AI cost signal)." })
  tokensIn!: number;

  @ApiProperty({ description: "Output tokens this month (AI cost signal)." })
  tokensOut!: number;

  @ApiProperty({
    description:
      "Open customer conversations whose most recent message is from the " +
      "customer — i.e. someone is waiting on the business right now. Not " +
      "month-scoped; it is a live figure.",
  })
  awaitingReply!: number;

  @ApiProperty({
    description:
      "Average seconds from a customer message to the business's reply " +
      "(agent or human), over this month. Null when nothing has been " +
      "answered yet.",
    nullable: true,
  })
  avgResponseSeconds!: number | null;
}
