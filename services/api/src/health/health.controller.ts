import { Controller, Get } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PrismaService } from "../common/prisma/prisma.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: "Liveness + database probe",
    description:
      "Returns service status and pings Postgres with `SELECT 1`.\n\n" +
      "**How to consume:** unauthenticated `GET /v1/health`. Used by Fly.io " +
      'health checks and uptime monitors. Treat HTTP 200 + `status: "ok"` as ' +
      'healthy. `status: "degraded"` means the API is up but the database is ' +
      "unreachable — still HTTP 200 so the machine stays in rotation, so " +
      "alert on the response body, not the status code.\n\n" +
      "```bash\ncurl https://api.lidh.al/v1/health\n```",
  })
  @ApiOkResponse({
    description: "Service reachable. Inspect the `db` field for DB state.",
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      "Only if the process itself is down (then nothing responds). A " +
      'reachable-but-DB-down state is 200 with `status: "degraded"`, not 503.',
  })
  async check(): Promise<HealthResponseDto> {
    const startedAt = Date.now();
    let db: "ok" | "down" = "down";
    let dbLatencyMs: number | null = null;

    try {
      const t0 = Date.now();
      await this.prisma.client.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - t0;
      db = "ok";
    } catch {
      // db stays "down"
    }

    return {
      status: db === "ok" ? "ok" : "degraded",
      uptimeSec: Math.round(process.uptime()),
      db,
      dbLatencyMs,
      checkedInMs: Date.now() - startedAt,
    };
  }
}
