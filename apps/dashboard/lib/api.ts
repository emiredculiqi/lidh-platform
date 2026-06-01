// Client-safe API surface (BFF proxy transport). This is what CLIENT
// components import (NewTenantForm, AddKnowledge, AgentEditor) and anything
// that only needs types or `apiBase` (TestChat/DemoChat, the public demo
// page). It has NO server-only imports, so it never poisons a client bundle.
//
// SERVER components must import `@/lib/api-server` instead — same `api`
// shape, but a direct-call + Clerk-token transport. See ADR-007.

export * from "./api-core";

import { makeApi, proxyTransport } from "./api-core";

export const api = makeApi(proxyTransport);
