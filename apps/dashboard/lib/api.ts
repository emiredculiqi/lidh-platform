// Thin client for @lidh/api. Server components call these (server→server, no
// CORS). The API is currently open (ADR-003); the Clerk-gated auth step will
// add an Authorization header here. NEXT_PUBLIC_API_URL works server-side too.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, {
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
  const res = await fetch(`${BASE}/v1${path}`, {
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

export const apiBase = BASE;

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
