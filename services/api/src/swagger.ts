import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/**
 * Mounts Swagger/OpenAPI docs.
 *
 *   - Swagger UI:  GET /docs
 *   - OpenAPI JSON: GET /docs-json   (import into Postman / client codegen)
 *
 * Gating: enabled when NODE_ENV !== "production", OR when ENABLE_SWAGGER=true.
 * An internal B2B API shouldn't publish its full surface publicly by default;
 * flip ENABLE_SWAGGER=true on Fly when you want it in production.
 *
 * Called from main.ts AFTER setGlobalPrefix so paths are predictable. The
 * /docs path is intentionally outside the /v1 prefix — docs describe all
 * versions, they aren't a versioned resource.
 */
export function setupSwagger(app: INestApplication): void {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_SWAGGER === "true";

  if (!enabled) return;

  const config = new DocumentBuilder()
    .setTitle("Lidh.al Platform API")
    .setDescription(
      "Backend for the Lidh.al multi-tenant agent platform.\n\n" +
        "All routes are versioned under `/v1`. Authentication (Clerk-issued " +
        "JWT) lands in M2 — until then endpoints are open and tenant context " +
        "is taken from `x-tenant-id` / `x-user-id` dev headers.\n\n" +
        "**Consuming an endpoint:** each operation below documents its " +
        "request shape, every response status, and a realistic example " +
        "payload. Use `GET /docs-json` for the raw OpenAPI spec.",
    )
    .setVersion("1.0")
    .addServer("http://localhost:4000", "Local dev")
    .addServer("https://api.lidh.al", "Production")
    // Pre-registers the bearer scheme so M2 auth'd endpoints just add
    // @ApiBearerAuth() and the "Authorize" button works in the UI.
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "clerk-jwt",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
    swaggerOptions: {
      // Keeps the auth token across page reloads while testing.
      persistAuthorization: true,
      docExpansion: "list",
    },
    customSiteTitle: "Lidh.al API — Docs",
  });
}
