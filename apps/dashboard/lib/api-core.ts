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
// (/v1/chat/web) used by TestChat/FunnelChat. Not proxied (@Public + SSE).
export const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  defaultLocale: string;
  // Permanent public funnel page — shape: ${APP_BASE_URL}/b/<slug>
  funnelUrl: string;
  // End of free trial (30d on signup). null = trial cleared by a paid plan.
  trialEndsAt: string | null;
  // FK to Plan when admin has assigned one (manual, post-payment).
  planId: string | null;
  // Computed server-side: chatEnabled — trialing/grace/subscribed (grace-aware).
  isActive: boolean;
  // Entitlement state (ADR-017): trialing | grace | expired | subscribed | archived.
  state: "trialing" | "grace" | "expired" | "subscribed" | "archived";
  // Dashboard access mode: full | read_only (frozen — reads ok, writes 403) | none (archived).
  dashboard: "full" | "read_only" | "none";
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

// Who answers a thread. `aiOverride` is the per-thread manual choice (null =
// inherit the business setting); `aiEffective` is the resolved answer now.
export type Responder = "human" | "ai";

export type ConversationListItem = {
  id: string;
  channelKind: string;
  status: string;
  aiOverride: Responder | null;
  aiEffective: Responder;
  locale: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactStage: ContactStage;
  // "user" = customer spoke last → waiting on the business.
  lastMessageRole: string | null;
  lastMessagePreview: string;
  messageCount: number;
  unreadCount: number;
  lastMsgAt: string;
};

export type ConversationListParams = {
  q?: string;
  channel?: "web" | "whatsapp" | "instagram";
  stage?: ContactStage;
  only?: "unanswered";
};

export type ConversationList = {
  items: ConversationListItem[];
  // Tenant-wide "customer spoke last" count, independent of the filters.
  awaitingCount: number;
};

export type UnreadItem = {
  conversationId: string;
  contactName: string | null;
  channelKind: string;
  unreadCount: number;
  lastMsgAt: string;
};

export type UnreadSummary = {
  total: number; // conversations with unread messages
  items: UnreadItem[];
};

export type Notification = {
  id: string;
  kind: "conversation_started" | "contact_registered" | "lead_captured";
  conversationId: string | null;
  contactName: string | null;
  createdAt: string;
};

export type TeamMember = {
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "agent";
  joinedAt: string;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: "admin" | "agent";
  status: string;
  createdAt: string;
  expiresAt: string;
};

export type TeamOverview = {
  seats: { used: number; max: number };
  members: TeamMember[];
  invitations: TeamInvitation[];
};

export type Thread = {
  id: string;
  channelKind: string;
  status: string;
  aiOverride: Responder | null;
  aiEffective: Responder;
  // What the business setting resolves to right now, ignoring the override.
  aiDefault: Responder;
  locale: string | null;
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactStage: ContactStage;
  messages: {
    role: string;
    contentText: string | null;
    toolName: string | null;
    createdAt: string;
  }[];
};

// Business-level responder setting (Tenant.settings.responder, ADR-020).
export type ResponderMode = "human" | "ai" | "schedule";
export type ResponderWindow = { days: number[]; from: string; to: string };
export type ResponderSettings = {
  mode: ResponderMode;
  timezone: string;
  windows: ResponderWindow[];
};

// Where a contact stands with the business (Contact.stage). Fixed set.
export type ContactStage = "new" | "lead" | "client" | "not_a_fit";
export const CONTACT_STAGES: ContactStage[] = ["new", "lead", "client", "not_a_fit"];

export type ContactListParams = {
  q?: string;
  stage?: ContactStage;
  has?: "phone" | "email";
  sort?: "name" | "recent";
};

export type ContactListItem = {
  id: string;
  stage: ContactStage;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  conversationCount: number;
  noteCount: number;
  lastSeenAt: string;
};

export type ContactConversation = {
  id: string;
  channelKind: string;
  status: string;
  locale: string | null;
  lastMessagePreview: string;
  messageCount: number;
  lastMsgAt: string;
};

export type ContactNote = {
  id: string;
  // intent = written by the assistant when it detected interest; manual = by the team.
  kind: "intent" | "manual";
  body: string;
  conversationId: string | null;
  authorName: string | null;
  createdAt: string;
};

export type ContactDetail = {
  id: string;
  stage: ContactStage;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  locale: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  conversations: ContactConversation[];
  notes: ContactNote[];
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

export type PresetUsage = {
  presetId: string;
  inUse: boolean;
  tenants: { slug: string; name: string; matchedBy: "reference" | "content" }[];
};

export type PersonaPresetInput = {
  label: string;
  description: string;
  personas: Record<string, string>;
};


export type Usage = {
  monthStart: string;
  conversations: number;
  messagesIn: number;
  messagesOut: number;
  // Contacts with an identity first seen this month.
  newContacts: number;
  handoffs: number;
  tokensIn: number;
  tokensOut: number;
  // Live: open customer conversations whose latest message is the customer's.
  awaitingReply: number;
  // This month, customer message → reply; null until something was answered.
  avgResponseSeconds: number | null;
};

export type ChannelStatus = {
  kind: string; // "web" | "whatsapp" | "instagram"
  status: string; // "pending" | "connected" | "disconnected" | "error"
  displayPhoneNumber?: string;
  coexistence?: boolean;
};

export type ConnectWhatsAppInput = {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  coexistence?: boolean;
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
    getPersonaPresetUsage: (id: string) =>
      t.get<PresetUsage>(`/persona-presets/${id}/usage`),
    deletePersonaPreset: (id: string) =>
      t.del<{ id: string; deleted: true }>(`/persona-presets/${id}`),
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
    listConversations: (slug: string, params: ConversationListParams = {}) => {
      const qs = new URLSearchParams({ tenantSlug: slug });
      if (params.q) qs.set("q", params.q);
      if (params.channel) qs.set("channel", params.channel);
      if (params.stage) qs.set("stage", params.stage);
      if (params.only) qs.set("only", params.only);
      return t.get<ConversationList>(`/conversations?${qs.toString()}`);
    },
    getThread: (id: string) => t.get<Thread>(`/conversations/${id}`),
    setConversationResponder: (id: string, mode: Responder | "inherit") =>
      t.post<{ aiOverride: Responder | null; aiEffective: Responder }>(
        `/conversations/${id}/ai`,
        { mode },
      ),
    getResponder: (slug: string) =>
      t.get<ResponderSettings>(`/tenants/${slug}/responder`),
    setResponder: (slug: string, body: ResponderSettings) =>
      t.put<ResponderSettings>(`/tenants/${slug}/responder`, body),
    replyToConversation: (id: string, text: string) =>
      t.post<{ ok: true }>(`/conversations/${id}/reply`, { text }),
    markConversationRead: (id: string) =>
      t.post<{ ok: true }>(`/conversations/${id}/read`, {}),
    getUnread: (slug: string) =>
      t.get<UnreadSummary>(`/conversations/unread?tenantSlug=${slug}`),
    listNotifications: (slug: string) =>
      t.get<Notification[]>(`/notifications?tenantSlug=${slug}`),
    getTeam: (slug: string) => t.get<TeamOverview>(`/tenants/${slug}/team`),
    inviteMember: (slug: string, email: string, role: "admin" | "agent") =>
      t.post<{ ok: true }>(`/tenants/${slug}/team/invite`, { email, role }),
    setMemberRole: (slug: string, userId: string, role: "admin" | "agent") =>
      t.post<{ ok: true }>(`/tenants/${slug}/team/members/${userId}/role`, {
        role,
      }),
    removeMember: (slug: string, userId: string) =>
      t.del<{ ok: true }>(`/tenants/${slug}/team/members/${userId}`),
    resendInvite: (slug: string, id: string) =>
      t.post<{ ok: true }>(`/tenants/${slug}/team/invitations/${id}/resend`, {}),
    revokeInvite: (slug: string, id: string) =>
      t.del<{ ok: true }>(`/tenants/${slug}/team/invitations/${id}`),
    listContacts: (slug: string, params: ContactListParams = {}) => {
      const qs = new URLSearchParams({ tenantSlug: slug });
      if (params.q) qs.set("q", params.q);
      if (params.stage) qs.set("stage", params.stage);
      if (params.has) qs.set("has", params.has);
      if (params.sort) qs.set("sort", params.sort);
      return t.get<ContactListItem[]>(`/contacts?${qs.toString()}`);
    },
    getContact: (id: string) => t.get<ContactDetail>(`/contacts/${id}`),
    addContactNote: (id: string, body: string) =>
      t.post<ContactNote>(`/contacts/${id}/notes`, { body }),
    setContactStage: (id: string, stage: ContactStage) =>
      t.post<{ stage: ContactStage }>(`/contacts/${id}/stage`, { stage }),
    getUsage: (slug: string) => t.get<Usage>(`/usage?tenantSlug=${slug}`),
    getChannels: (slug: string) =>
      t.get<ChannelStatus[]>(`/tenants/${slug}/channels`),
    connectWhatsApp: (slug: string, body: ConnectWhatsAppInput) =>
      t.post<ChannelStatus>(`/tenants/${slug}/channels/whatsapp/connect`, body),
    disconnectWhatsApp: (slug: string) =>
      t.post<ChannelStatus>(
        `/tenants/${slug}/channels/whatsapp/disconnect`,
        {},
      ),
    getWebOrigins: (slug: string) =>
      t.get<{ allowedOrigins: string[] }>(`/tenants/${slug}/web-origins`),
    setWebOrigins: (slug: string, allowedOrigins: string[]) =>
      t.put<{ allowedOrigins: string[] }>(`/tenants/${slug}/web-origins`, {
        allowedOrigins,
      }),
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
