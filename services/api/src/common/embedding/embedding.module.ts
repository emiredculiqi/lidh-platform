import { Global, Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";

/** @Global so RetrievalService + KnowledgeService share one instance. */
@Global()
@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
