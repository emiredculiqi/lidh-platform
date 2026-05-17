import { auth } from "@clerk/nextjs/server";

/**
 * BFF proxy (ADR-006). Authenticated dashboard data calls go through here so
 * the Clerk token is attached server-side (client components can't read a
 * server-only token) and there's no cross-origin call from the browser.
 *
 *   /api/proxy/<path>  →  ${API_URL}/v1/<path>   (+ Bearer <clerk token>)
 *
 * Public endpoints (chat SSE, demo resolve) are NOT proxied — the browser
 * hits the API directly (they're @Public + streaming).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function handle(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const target = `${API_URL}/v1/${path.join("/")}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type":
        req.headers.get("content-type") ?? "application/json",
    },
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(target, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
