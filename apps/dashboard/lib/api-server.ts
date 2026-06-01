// Server-only API surface. `import "server-only"` makes the build FAIL loudly
// if a client component ever imports this (instead of silently shipping the
// Clerk server SDK to the browser — the bug ADR-007 fixes). Only server
// components import this module.
//
// A server component already holds the Clerk session, so it calls the API
// DIRECTLY with a Bearer token — it must NOT round-trip through /api/proxy
// (cookie-less server fetch + middleware gate → 404). See ADR-007.
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { makeApi, unwrap, type Transport } from "./api-core";

export * from "./api-core";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function authedFetch(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    throw new Error(
      `AUTH: no Clerk session in this server render (path ${path}). ` +
        `Likely not signed in, or middleware didn't run for this route.`,
    );
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const url = `${API_URL}/v1${path}`;
  try {
    return await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(
      `NETWORK: could not reach ${url} (${(e as Error).message})`,
    );
  }
}

const serverTransport: Transport = {
  async get<T>(path: string): Promise<T> {
    return unwrap<T>(await authedFetch("GET", path), path);
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    return unwrap<T>(await authedFetch("POST", path, body), path);
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    return unwrap<T>(await authedFetch("PUT", path, body), path);
  },
  async del<T>(path: string): Promise<T> {
    return unwrap<T>(await authedFetch("DELETE", path), path);
  },
};

export const api = makeApi(serverTransport);
