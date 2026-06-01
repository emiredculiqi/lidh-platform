# Lidh.al Platform — Diagrams

Snapshot of the platform as of M1 completion (foundation milestone). Each
diagram is Mermaid — draw.io renders Mermaid natively.

## How to import into draw.io

1. Open https://app.diagrams.net (or the desktop app).
2. **For each diagram below:** Extras → Edit Diagram → paste the Mermaid block
   (everything between the ` ```mermaid ` fences, *including* those fences if
   the import dialog asks for them, otherwise just the inner code).
3. Or, on the menu bar: **+ → Advanced → Mermaid** → paste.
4. Each block becomes its own draw.io page; you can rearrange afterwards.

> **Tip:** If a diagram looks crowded after import, pick "Layout → Hierarchical"
> (or for the ERD, "Layout → Organic") and draw.io re-flows it.

---

## 1. System Architecture (M1 current state)

What's running where, and what talks to what.

```mermaid
graph TB
  classDef user fill:#FFEFD5,stroke:#F97316,color:#0A0A23
  classDef app  fill:#E0F2FE,stroke:#1E5FDB,color:#0A0A23
  classDef svc  fill:#DCFCE7,stroke:#16A34A,color:#0A0A23
  classDef ext  fill:#F3E8FF,stroke:#9333EA,color:#0A0A23
  classDef pkg  fill:#F8FAFC,stroke:#64748B,color:#0A0A23,stroke-dasharray:3 3

  visitor(["Customer / Visitor"]):::user
  smb(["SMB owner / Lidh.al admin"]):::user

  subgraph Vercel
    dashboard["apps/dashboard<br/>Next.js — app.lidh.al<br/>Clerk gate on /inbox*"]:::app
  end

  %% Marketing site (lidh.al) lives in its own repo (ADR-012) — not shown here.

  subgraph FlyIo["Fly.io (Frankfurt)"]
    api["services/api<br/>NestJS + Fastify<br/>GET /v1/health"]:::svc
  end

  subgraph WorkspacePackage["Workspace package"]
    db["packages/db<br/>#64;lidh/db — Prisma client + types"]:::pkg
  end

  subgraph ManagedServices["Managed services"]
    neon[("Neon Postgres<br/>+ pgvector + HNSW")]:::ext
    clerk["Clerk Auth<br/>magic-link email"]:::ext
    anthropic["Anthropic API<br/>claude-haiku-4-5"]:::ext
  end

  visitor -.web widget / demo links.-> dashboard
  smb --> dashboard

  dashboard -- magic-link login --> clerk
  clerk -. webhook user.created/updated/deleted .-> dashboard
  dashboard -.M2: tenant data.-> api

  dashboard -- imports types from --> db
  api       -- imports prisma from --> db
  db        --> neon

  api -.M2: agent runtime.-> anthropic
```

**Solid arrows** = wired in M1. **Dashed arrows** = stubbed (route exists, body
deferred to M2) or planned.

---

## 2. Database schema — full ERD (15 tables, all relationships)

The complete data model committed in `packages/db/prisma/schema.prisma`. Every
domain row has `tenantId` (RLS in M2). Identity (`User`) is global.

```mermaid
erDiagram
  USER ||--o{ MEMBERSHIP : "is member via"
  USER ||--o{ CONVERSATION : "assigned to"

  PLAN ||--o{ TENANT : "subscribed by"

  TENANT ||--o{ MEMBERSHIP : "has members"
  TENANT ||--o{ AGENT : "has agents"
  TENANT ||--o{ AGENT_PERSONA : "scoped to"
  TENANT ||--o{ CHANNEL : "has channels"
  TENANT ||--o{ KNOWLEDGE_SOURCE : "owns"
  TENANT ||--o{ KNOWLEDGE_CHUNK : "owns (denormalized)"
  TENANT ||--o{ CONTACT : "owns"
  TENANT ||--o{ CONVERSATION : "owns"
  TENANT ||--o{ MESSAGE : "owns (denormalized)"
  TENANT ||--o{ LEAD : "owns"
  TENANT ||--o{ EVENT : "owns"
  TENANT ||--o{ USAGE_DAILY : "metered as"

  AGENT ||--o{ AGENT_PERSONA : "has language personas"

  CHANNEL ||--o{ CONVERSATION : "delivered via"

  KNOWLEDGE_SOURCE ||--o{ KNOWLEDGE_CHUNK : "chunks"

  CONTACT ||--o{ CONVERSATION : "participated in"
  CONTACT ||--o{ LEAD : "captured as"

  CONVERSATION ||--o{ MESSAGE : "thread of"
  CONVERSATION ||--o{ LEAD : "produced"
  CONVERSATION ||--o{ EVENT : "audit trail"

  USER {
    string id PK
    string clerkId UK "synced from Clerk"
    string email UK
    string name
    bool   isPlatformAdmin "Lidh.al staff flag"
  }

  TENANT {
    string id PK
    string slug UK
    string name
    string planId FK
    json   planOverrides "per-tenant deals"
    datetime trialEndsAt
    string defaultLocale "al / en / it / ..."
    json   settings
    bool   isDemo
    string demoToken UK "demo.lidh.al/{token}"
    datetime demoExpiresAt
  }

  PLAN {
    string id PK
    string slug UK
    string name
    int    priceLekePerMonth
    int    messagesPerMonth "0 = unlimited"
    int    leadsPerMonth
    int    maxChannels
    int    maxLanguages
    int    maxKnowledgeSources
    int    maxTeamMembers
    json   features "hasInstagram, hasWhatsApp, ..."
    bool   isActive
  }

  MEMBERSHIP {
    string id PK
    string userId FK
    string tenantId FK
    enum   role "owner | admin | agent"
  }

  AGENT {
    string id PK
    string tenantId FK
    string name
    string defaultLocale
    json   tone
    json   fallbackBehavior
    json   toolsEnabled
    string modelOverride
  }

  AGENT_PERSONA {
    string id PK
    string agentId FK
    string tenantId FK
    string locale "al | en | it | de | ..."
    text   content "system prompt body"
  }

  CHANNEL {
    string id PK
    string tenantId FK
    enum   kind "web | whatsapp | instagram"
    enum   status "pending | connected | ..."
    json   config "channel-specific"
    text   credentialsEnc
  }

  KNOWLEDGE_SOURCE {
    string id PK
    string tenantId FK
    enum   kind "url | file | faq | sitemap"
    text   uri
    enum   status "pending | processing | ready | failed"
    datetime lastCrawledAt
  }

  KNOWLEDGE_CHUNK {
    string id PK
    string tenantId FK
    string sourceId FK
    text   content
    string locale
    vector embedding "vector(1536) + HNSW"
    int    tokens
  }

  CONTACT {
    string id PK
    string tenantId FK
    string name
    string phone "unique per tenant"
    string email "unique per tenant"
    string igHandle "unique per tenant"
    string source
  }

  CONVERSATION {
    string id PK
    string tenantId FK
    string channelId FK
    string contactId FK
    enum   kind "customer | preview"
    enum   status "open | paused | resolved"
    bool   aiPaused "human takeover"
    string assignedToUserId FK
    string locale
    string channelRef "platform thread id"
  }

  MESSAGE {
    string id PK
    string tenantId FK
    string conversationId FK
    enum   role "user | assistant | tool"
    text   contentText
    json   contentJson
    string toolName
    json   toolInput
    json   toolOutput
    int    tokensIn "Anthropic usage"
    int    tokensOut
  }

  LEAD {
    string id PK
    string tenantId FK
    string conversationId FK
    string contactId FK
    json   payload "name, email, phone, ..."
    enum   status "new | contacted | won | lost"
  }

  EVENT {
    string id PK
    string tenantId FK
    string conversationId FK
    enum   kind "lead_captured | human_handoff_requested | demo_link_visited | ..."
    json   meta
  }

  USAGE_DAILY {
    string id PK
    string tenantId FK
    date   date
    enum   channel "web | whatsapp | instagram"
    int    messagesIn
    int    messagesOut
    int    conversations
    int    leadsCaptured
    int    toolCalls
    int    tokensIn
    int    tokensOut
  }
```

---

## 3. User actions — sign-up + sign-in (current implementation)

What actually happens when an SMB owner (or you, as platform admin) signs in.
Webhook step is stubbed in M1; real upsert lands in M2.

```mermaid
sequenceDiagram
  autonumber
  actor U as User (SMB owner / admin)
  participant B as Browser
  participant D as apps/dashboard<br/>(Next.js)
  participant MW as Clerk middleware.ts
  participant CK as Clerk
  participant WH as POST /api/webhooks/clerk
  participant DB as Neon Postgres<br/>(via @lidh/db)

  U->>B: open app.lidh.al
  B->>D: GET /
  D->>MW: middleware runs
  MW->>CK: read session
  CK-->>MW: signed-out
  D-->>B: 307 → /sign-in
  B->>D: GET /sign-in
  D-->>B: Clerk SignIn UI

  U->>B: enter email + submit
  B->>CK: POST sign-in (publishable key)
  CK-->>U: email with verification code
  U->>B: paste code
  B->>CK: verify
  CK-->>B: session JWT (cookie)

  Note over CK,WH: M2: Clerk fires webhook user.created
  CK->>WH: POST signed payload
  WH->>WH: svix verify signature
  WH->>DB: M2 → prisma.user.upsert by clerkId
  Note right of WH: M1 just logs; no DB write yet

  B->>D: GET /
  D->>MW: middleware runs
  MW->>CK: verify JWT
  CK-->>MW: signed-in (userId)
  D-->>B: 307 → /inbox

  B->>D: GET /inbox
  D->>MW: middleware runs (protected route)
  MW-->>D: allow (auth.protect passes)
  D-->>B: 200 — Inbox page<br/>(empty stub, header + UserButton)
```

---

## 4. Future flow — admin creates a demo for a prospect (M2 preview)

Diagram for context: this is the flow we built the schema for, but **not yet
implemented**. Worth keeping in the diagrams folder so M2 has a north star.

```mermaid
sequenceDiagram
  autonumber
  actor A as Lidh.al admin (you)
  actor P as Prospect SMB
  participant D as apps/dashboard
  participant API as services/api
  participant R2 as Cloudflare R2 (files)
  participant DB as Neon Postgres
  participant AI as Anthropic API

  rect rgba(220, 252, 231, 0.4)
    Note over A,DB: Admin creates the demo (offline, before sales call)
    A->>D: /tenants → "New tenant" wizard
    D->>API: POST /v1/tenants
    API->>DB: INSERT Tenant {isDemo=true, demoToken, demoExpiresAt}
    API->>DB: INSERT Agent + AgentPersona (al + en)
    API->>DB: INSERT Channel(kind=web, demo origins)

    A->>D: /knowledge → upload menu.pdf
    D->>R2: PUT object
    D->>API: POST /v1/knowledge-sources
    API->>DB: INSERT KnowledgeSource(kind=file)
    API->>API: queue ingest job (Inngest)
    API->>R2: GET file
    API->>API: extract text + chunk
    API->>AI: embed each chunk
    AI-->>API: vectors
    API->>DB: INSERT KnowledgeChunks (with embedding)
    API->>DB: UPDATE Source.status=ready

    D-->>A: copy demo URL: demo.lidh.al/{token}
  end

  rect rgba(254, 226, 226, 0.4)
    Note over P,AI: Prospect opens the demo link
    P->>D: GET demo.lidh.al/{token}
    D->>API: resolve tenant by demoToken
    API->>DB: SELECT Tenant WHERE demoToken=...
    DB-->>API: tenant
    D-->>P: branded chat page (web channel)

    P->>API: POST /v1/chat/web (SSE)
    API->>DB: INSERT Conversation(kind=customer)
    API->>DB: SELECT AgentPersona by locale
    API->>DB: vector retrieval over KnowledgeChunks
    API->>AI: stream messages.create
    AI-->>API: tokens
    API-->>P: SSE: text deltas
    API->>DB: INSERT Messages (incl. tokensIn/Out)
    API->>DB: INSERT Event(kind=demo_link_visited)
  end
```

---

## 5. Monorepo file structure (M1)

A minimap of where things live in the repo as of M1.

```mermaid
graph TD
  classDef workspace fill:#E0F2FE,stroke:#1E5FDB
  classDef config    fill:#F8FAFC,stroke:#64748B
  classDef secret    fill:#FEE2E2,stroke:#DC2626,stroke-dasharray:3 3

  root[lidh-platform/]:::config

  root --> apps[apps/]
  root --> services[services/]
  root --> packages[packages/]
  root --> docs[docs/]
  root --> rootCfg["package.json + pnpm-workspace.yaml<br/>turbo.json + .gitignore + .npmrc"]:::config

  apps --> dashboard["apps/dashboard/<br/>@lidh/dashboard<br/>(Next.js + Clerk — app.lidh.al)"]:::workspace

  services --> api["services/api/<br/>@lidh/api<br/>(NestJS + Fastify — api.lidh.al)"]:::workspace

  packages --> core["packages/core/<br/>@lidh/core<br/>(framework-agnostic agent runtime)"]:::workspace
  packages --> db["packages/db/<br/>@lidh/db<br/>(Prisma client + migrations)"]:::workspace

  docs --> diag[diagrams.md]:::config

  dashboard -. "@lidh/db (workspace)" .-> db
  api       -- "@lidh/db + @lidh/core" --> db
  api       --> core

  dashboard --> dashboardEnv[".env — Clerk keys"]:::secret
  api       --> apiEnv[".env — DATABASE_URL"]:::secret
  db        --> dbEnv[".env — DATABASE_URL"]:::secret

  %% Marketing site (lidh.al) lives in its own repo (ADR-012) — not shown.
```

Red dashed boxes = local secret files (gitignored, not committed).

---

## What each diagram is for

| Diagram | Purpose | Audience |
|---|---|---|
| 1. System Architecture | One-glance answer to "where does the code run?" | New collaborators, you in 6 months |
| 2. ERD | Authoritative reference for any "what data do we have?" question | You while building features |
| 3. Sign-up sequence | Concrete walkthrough of the auth flow as it works today | Debugging Clerk issues |
| 4. Demo flow (planned) | North star for M2 build order | You during M2 sprint |
| 5. Monorepo map | Which folder holds what | You ten minutes into a refactor |

These should evolve with the code. When schema changes (e.g., adding a model
in M2), update Diagram 2. When the agent runtime exists, Diagram 4 becomes
"current state" instead of "planned."
