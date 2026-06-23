import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { setupSwagger } from "./swagger";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Trust X-Forwarded-* headers — Fly.io's proxy sets them and we want
      // request.ip to be the real client IP, not the proxy.
      trustProxy: true,
      // Document uploads come as base64 in JSON (no @fastify/multipart
      // plumbing). base64 inflates ~33%, so 20MB covers ~15MB files —
      // ample for SMB brochures / price lists.
      bodyLimit: 20 * 1024 * 1024,
    }),
  );

  // Version every route under /v1. Lets us ship /v2 later without breaking
  // pinned widgets, webhooks, or third-party integrations.
  app.setGlobalPrefix("v1");

  // Validate + strip request bodies against the class-validator DTOs.
  // whitelist: drop unknown props. transform: instantiate the DTO class.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS: reflect ANY origin. The only browser-side cross-origin consumer is
  // the public chat widget (POST /v1/chat/web), which is meant to embed on any
  // website. The dashboard talks to the API server-side via its BFF proxy, and
  // auth is Bearer-token (not cookies), so reflecting origins exposes nothing.
  // WHICH sites may actually use a given tenant's widget is enforced per-tenant
  // via that tenant's allowedOrigins (chat.service) — that is the real gate, so
  // a global CORS allowlist is intentionally not used here.
  app.enableCors({ origin: true, credentials: true });

  // OpenAPI/Swagger docs at /docs (+ /docs-json). Env-gated inside.
  // Mounted after setGlobalPrefix so paths are predictable.
  setupSwagger(app);

  // Bind address depends on environment:
  //  - Local (macOS): "::" — Node's fetch (undici) resolves "localhost" to ::1
  //    first; an IPv4-only bind would refuse it, breaking the dashboard's BFF
  //    proxy. Dual-stack accepts both.
  //  - Fly.io: "0.0.0.0" — Fly's proxy explicitly probes IPv4. On Fly's Linux
  //    machines, binding to "::" did NOT accept v4 connections in practice
  //    (Fly Doctor flagged "machines are not listening on 0.0.0.0:4000").
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.FLY_APP_NAME ? "0.0.0.0" : "::";
  await app.listen(port, host);

  Logger.log(
    `🦊 Lidh.al API running on http://${host}:${port}/v1 (NODE_ENV=${process.env.NODE_ENV ?? "development"})`,
    "Bootstrap",
  );
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_SWAGGER === "true"
  ) {
    Logger.log(
      `📖 API docs at http://0.0.0.0:${port}/docs (spec: /docs-json)`,
      "Bootstrap",
    );
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[bootstrap] fatal:", err);
  process.exit(1);
});
