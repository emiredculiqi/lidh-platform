import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { EmbeddingModule } from "./common/embedding/embedding.module";
import { TenantContextModule } from "./common/tenant-context/tenant-context.module";
import { HealthModule } from "./health/health.module";
import { ChatModule } from "./chat/chat.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { TenantsModule } from "./tenants/tenants.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { LeadsModule } from "./leads/leads.module";
import { AgentsModule } from "./agents/agents.module";
import { WhatsappModule } from "./channels/whatsapp/whatsapp.module";

@Module({
  imports: [
    // Global env loader. Reads .env from cwd; in dev that's services/api/.env.
    // In Docker/Fly we inject env via Fly secrets, so .env is dev-only.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    EmbeddingModule,
    TenantContextModule,
    HealthModule,
    ChatModule,
    KnowledgeModule,
    TenantsModule,
    ConversationsModule,
    LeadsModule,
    AgentsModule,
    WhatsappModule,
  ],
})
export class AppModule {}
