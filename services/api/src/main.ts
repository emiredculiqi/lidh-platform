import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Trust X-Forwarded-* headers — Fly.io's proxy sets them and we want
      // request.ip to be the real client IP, not the proxy.
      trustProxy: true,
    }),
  );

  // Version every route under /v1. Lets us ship /v2 later without breaking
  // pinned widgets, webhooks, or third-party integrations.
  app.setGlobalPrefix("v1");

  // CORS — comma-separated allowlist via env. Wildcard "*" only meaningful in dev.
  const corsOrigins = (process.env.CORS_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === "*" ? true : corsOrigins,
    credentials: true,
  });

  // Bind to 0.0.0.0 so Docker/Fly can route traffic in (default 127.0.0.1
  // would only accept loopback connections).
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");

  Logger.log(
    `🦊 Lidh.al API running on http://0.0.0.0:${port}/v1 (NODE_ENV=${process.env.NODE_ENV ?? "development"})`,
    "Bootstrap",
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[bootstrap] fatal:", err);
  process.exit(1);
});
