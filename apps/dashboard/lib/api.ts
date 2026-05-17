// Authenticated dashboard data calls go through the BFF proxy (ADR-006):
// the proxy attaches the Clerk token server-side and forwards to the API.
// Same-origin absolute URL → works in both server and client components.
// `apiBase` (direct API URL) is exported separately for the PUBLIC chat SSE
// (TestChat/DemoChat) which must NOT be proxied.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const PROXY = `${APP_URL}/api/proxy`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PROXY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PROXY}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// Direct API origin — ONLY for the public, streaming chat endpoint
// (/v1/chat/web) used by TestChat/DemoChat. Not proxied (it's @Public + SSE).
export const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  defaultLocale: string;
  isDemo: boolean;
  demoUrl: string | null;
  demoExpiresAt: string | null;
  createdAt: string;
};

export type KnowledgeSource = {
  id: string;
  kind: string;
  uri: string;
  status: string;
  error: string | null;
  lastCrawledAt: string | null;
  createdAt: string;
  _count?: { chunks: number };
};

export type ConversationListItem = {
  id: string;
  channelKind: string;
  status: string;
  aiPaused: boolean;
  locale: string | null;
  contactName: string | null;
  contactPhone: string | null;
  lastMessagePreview: string;
  messageCount: number;
  lastMsgAt: string;
};

export type Thread = {
  id: string;
  channelKind: string;
  status: string;
  aiPaused: boolean;
  contactName: string | null;
  contactPhone: string | null;
  messages: {
    role: string;
    contentText: string | null;
    toolName: string | null;
    createdAt: string;
  }[];
};

export type Agent = {
  id: string;
  name: string;
  defaultLocale: string;
  toolsEnabled: Record<string, boolean>;
  personas: { locale: string; content: string }[];
};

export type Lead = {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  contactName: string | null;
  contactPhone: string | null;
  conversationId: string | null;
  capturedAt: string;
};

export const api = {
  listTenants: () => get<Tenant[]>("/tenants"),
  getTenant: (slug: string) => get<Tenant>(`/tenants/${slug}`),
  createTenant: (body: unknown) => post<Tenant>("/tenants", body),
  listKnowledge: (slug: string) =>
    get<KnowledgeSource[]>(`/knowledge/sources?tenantSlug=${slug}`),
  addKnowledge: (body: unknown) =>
    post<KnowledgeSource>("/knowledge/sources", body),
  addText: (body: { tenantSlug: string; title?: string; content: string }) =>
    post<KnowledgeSource>("/knowledge/sources/text", body),
  uploadDoc: (body: {
    tenantSlug: string;
    filename: string;
    contentBase64: string;
  }) => post<KnowledgeSource>("/knowledge/sources/upload", body),
  listConversations: (slug: string) =>
    get<ConversationListItem[]>(`/conversations?tenantSlug=${slug}`),
  getThread: (id: string) => get<Thread>(`/conversations/${id}`),
  listLeads: (slug: string) => get<Lead[]>(`/leads?tenantSlug=${slug}`),
  getAgent: (slug: string) => get<Agent>(`/agents?tenantSlug=${slug}`),
  upsertPersona: (body: {
    tenantSlug: string;
    locale: string;
    content: string;
  }) => put<Agent>("/agents/personas", body),
};
