import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { EmbeddingModule } from "./common/embedding/embedding.module";
import { StorageModule } from "./common/storage/storage.module";
import { MailModule } from "./common/mail/mail.module";
import { LiveModule } from "./common/live/live.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { AuthModule } from "./common/auth/auth.module";
import { TenantContextModule } from "./common/tenant-context/tenant-context.module";
import { HealthModule } from "./health/health.module";
import { ChatModule } from "./chat/chat.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { TenantsModule } from "./tenants/tenants.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { LeadsModule } from "./leads/leads.module";
import { AgentsModule } from "./agents/agents.module";
import { WhatsappModule } from "./channels/whatsapp/whatsapp.module";
import { ChannelsModule } from "./channels/channels.module";
import { PersonaPresetsModule } from "./persona-presets/persona-presets.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { UsageModule } from "./usage/usage.module";
import { ContactsModule } from "./contacts/contacts.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MembersModule } from "./members/members.module";

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
    StorageModule,
    MailModule,
    LiveModule,
    CryptoModule,
    AuthModule,
    TenantContextModule,
    HealthModule,
    ChatModule,
    KnowledgeModule,
    TenantsModule,
    ConversationsModule,
    LeadsModule,
    AgentsModule,
    WhatsappModule,
    ChannelsModule,
    PersonaPresetsModule,
    OnboardingModule,
    UsageModule,
    ContactsModule,
    NotificationsModule,
    MembersModule,
  ],
})
export class AppModule {}
