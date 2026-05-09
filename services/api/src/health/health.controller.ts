import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * GET /v1/health
 * Smoke-test endpoint used by:
 *   - Fly.io health checks (returns 200 to keep the machine in rotation)
 *   - You / monitoring during dev
 *
 * Pings Postgres with `SELECT 1` so a DB outage is reflected here.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
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
