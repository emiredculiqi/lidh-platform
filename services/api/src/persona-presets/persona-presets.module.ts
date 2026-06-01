import { Module } from "@nestjs/common";
import { PersonaPresetsService } from "./persona-presets.service";
import { PersonaPresetsController } from "./persona-presets.controller";

@Module({
  controllers: [PersonaPresetsController],
  providers: [PersonaPresetsService],
})
export class PersonaPresetsModule {}
