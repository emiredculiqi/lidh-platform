import { ApiProperty } from "@nestjs/swagger";

/**
 * Response shape for GET /v1/health.
 *
 * This DTO is the documented contract — every field carries an `example`
 * so the Swagger UI shows a realistic payload, and the OpenAPI JSON can be
 * fed to client codegen / Postman.
 *
 * Convention for all future endpoints: define a `*-response.dto.ts` like this,
 * decorate every field with `@ApiProperty`, and return the typed class from
 * the controller.
 */
export class HealthResponseDto {
  @ApiProperty({
    description:
      'Overall service status. "ok" when the database is reachable, ' +
      '"degraded" when the API is up but Postgres is unreachable.',
    enum: ["ok", "degraded"],
    example: "ok",
  })
  status!: "ok" | "degraded";

  @ApiProperty({
    description: "Seconds since this API process started.",
    example: 3742,
  })
  uptimeSec!: number;

  @ApiProperty({
    description: "Database reachability from a `SELECT 1` probe.",
    enum: ["ok", "down"],
    example: "ok",
  })
  db!: "ok" | "down";

  @ApiProperty({
    description:
      "Round-trip latency in ms for the database probe. `null` if the probe failed.",
    example: 36,
    nullable: true,
    type: Number,
  })
  dbLatencyMs!: number | null;

  @ApiProperty({
    description: "Total time in ms spent producing this health response.",
    example: 37,
  })
  checkedInMs!: number;
}
