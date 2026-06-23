// Client-safe API core: types, the public API origin, the shared response
// handler, the API method map (makeApi), and the BROWSER transport (BFF
// proxy). ZERO server-only imports — safe to pull into any client bundle.
//
// Server components must NOT use proxyTransport (a server-side fetch carries
// no browser cookies and middleware gates /api/proxy → 404). They import
// lib/api-server.ts, which injects a direct-call + Clerk-token transport into
// the same makeApi() factory. See ADR-007.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const PROXY = `${APP_URL}/api/proxy`;

// Direct API origin — ONLY for the public, streaming chat endpoint
// (/v1/chat/web) used by TestChat/DemoChat. Not proxied (@Public + SSE).
export const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  defaultLocale: string;
  // Permanent public funnel page — shape: ${APP_BASE_URL}/b/<slug>
  funnelUrl: string;
  // End of free trial (15d on signup). null = trial cleared by a paid plan.
  trialEndsAt: string | null;
  // FK to Plan when admin has assigned one (manual, post-payment).
  planId: string | null;
  // Computed server-side: status=active AND (trialEndsAt>now OR planId set).
  isActive: boolean;
  status: "active" | "archived";
  archivedAt: string | null;
  // ADR-015: email pre-assigned by admin while the owner hasn't signed up
  // yet. Null after the AuthGuard JIT-binds them on first sign-in.
  pendingOwnerEmail: string | null;
  // Email of the currently-bound owner (oldest Membership.role=owner).
  // Null when the tenant has no owner yet.
  ownerEmail: string | null;
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
  modelOverride: string | null; // null ⇒ platform default (Haiku)
  personas: { locale: string; content: string }[];
};

export type PersonaPreset = {
  id: string;
  label: string;
  description: string;
  // locale → persona text ({business} still embedded; server fills it in)
  personas: Record<string, string>;
  active: boolean;
  createdAt: string;
};

export type PersonaPresetInput = {
  label: string;
  description: string;
  personas: Record<string, string>;
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

export type Usage = {
  monthStart: string;
  conversations: number;
  messagesIn: number;
  messagesOut: number;
  leads: number;
  handoffs: number;
  tokensIn: number;
  tokensOut: number;
};

export type Transport = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
};

// Shared response → typed-value / error mapping so both transports behave
// identically. Surfaces the real HTTP status + body (not a blanket message).
export async function unwrap<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// Browser transport: same-origin BFF proxy. The Clerk cookie rides along
// automatically; the proxy attaches the token server-side.
export const proxyTransport: Transport = {
  async get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${PROXY}${path}`, { cache: "no-store" });
    } catch (e) {
      throw new Error(
        `NETWORK: could not reach ${PROXY}${path} (${(e as Error).message})`,
      );
    }
    return unwrap<T>(res, path);
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${PROXY}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return unwrap<T>(res, path);
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${PROXY}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return unwrap<T>(res, path);
  },
  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${PROXY}${path}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return unwrap<T>(res, path);
  },
};

// ADR-013: who-am-i shape returned by GET /v1/me.
export type Me = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isPlatformAdmin: boolean;
  };
  memberships: Array<{
    role: string;
    tenant: { id: string; slug: string; name: string };
  }>;
};

export type OnboardBusinessInput = {
  name: string;
  slug: string;
  defaultLocale?: string;
  businessFacts?: string;
  presetId?: string;
  customAlbanianPersona?: string;
};

// The API surface, parameterised by transport. Identical method list whether
// it runs in the browser (proxy) or a server component (direct + token).
export function makeApi(t: Transport) {
  return {
    me: () => t.get<Me>("/me"),
    onboardBusiness: (body: OnboardBusinessInput) =>
      t.post<Tenant>("/onboarding/business", body),
    listTenants: () => t.get<Tenant[]>("/tenants"),
    listPersonaPresets: (all?: boolean) =>
      t.get<PersonaPreset[]>(`/persona-presets${all ? "?all=true" : ""}`),
    createPersonaPreset: (body: PersonaPresetInput) =>
      t.post<PersonaPreset>("/persona-presets", body),
    updatePersonaPreset: (
      id: string,
      body: Partial<PersonaPresetInput> & { active?: boolean },
    ) => t.put<PersonaPreset>(`/persona-presets/${id}`, body),
    deletePersonaPreset: (id: string) =>
      t.del<{ id: string; active: false }>(`/persona-presets/${id}`),
    getTenant: (slug: string) => t.get<Tenant>(`/tenants/${slug}`),
    createTenant: (body: unknown) => t.post<Tenant>("/tenants", body),
    listKnowledge: (slug: string) =>
      t.get<KnowledgeSource[]>(`/knowledge/sources?tenantSlug=${slug}`),
    addKnowledge: (body: unknown) =>
      t.post<KnowledgeSource>("/knowledge/sources", body),
    addText: (body: { tenantSlug: string; title?: string; content: string }) =>
      t.post<KnowledgeSource>("/knowledge/sources/text", body),
    uploadDoc: (body: {
      tenantSlug: string;
      filename: string;
      contentBase64: string;
    }) => t.post<KnowledgeSource>("/knowledge/sources/upload", body),
    listConversations: (slug: string) =>
      t.get<ConversationListItem[]>(`/conversations?tenantSlug=${slug}`),
    getThread: (id: string) => t.get<Thread>(`/conversations/${id}`),
    listLeads: (slug: string) => t.get<Lead[]>(`/leads?tenantSlug=${slug}`),
    getUsage: (slug: string) => t.get<Usage>(`/usage?tenantSlug=${slug}`),
    getAgent: (slug: string) => t.get<Agent>(`/agents?tenantSlug=${slug}`),
    upsertPersona: (body: {
      tenantSlug: string;
      locale: string;
      content: string;
    }) => t.put<Agent>("/agents/personas", body),
    setAgentModel: (tenantSlug: string, model: string | null) =>
      t.put<Agent>("/agents/model", { tenantSlug, model }),
    archiveTenant: (id: string) =>
      t.post<Tenant>(`/tenants/${id}/archive`, {}),
    reactivateTenant: (id: string) =>
      t.post<Tenant>(`/tenants/${id}/reactivate`, {}),
    deleteTenant: (id: string) =>
      t.del<{ id: string; slug: string; deleted: true }>(`/tenants/${id}`),
    grantPlan: (id: string, planId: string) =>
      t.post<Tenant>(`/tenants/${id}/grant-plan`, { planId }),
    extendTrial: (id: string, days: number) =>
      t.post<Tenant>(`/tenants/${id}/extend-trial`, { days }),
    setOwner: (id: string, email: string) =>
      t.post<Tenant>(`/tenants/${id}/set-owner`, { email }),
  };
}
