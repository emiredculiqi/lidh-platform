import { Module } from "@nestjs/common";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";

// PrismaModule + EmbeddingModule are @Global, so no imports needed here.
@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
