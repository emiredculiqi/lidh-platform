import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { PersonaPresetsService } from "./persona-presets.service";
import {
  CreatePersonaPresetDto,
  PersonaPresetResponseDto,
  PresetUsageDto,
  UpdatePersonaPresetDto,
} from "./dto/persona-preset.dto";
import { PlatformAdminOnly } from "../common/auth/platform-admin.decorator";

@ApiTags("Persona presets")
@Controller("persona-presets")
export class PersonaPresetsController {
  constructor(private readonly presets: PersonaPresetsService) {}

  @Get()
  @ApiOperation({
    summary: "List persona presets (ADR-010)",
    description:
      "The editable standard-persona library. Backs the New-tenant picker " +
      "(active only) and the dashboard 'Persona presets' admin screen " +
      "(`?all=true` to include deactivated). _Platform-admin._",
  })
  @ApiQuery({ name: "all", required: false, example: "true" })
  @ApiOkResponse({ type: PersonaPresetResponseDto, isArray: true })
  list(@Query("all") all?: string): Promise<PersonaPresetResponseDto[]> {
    return this.presets.list(all === "true");
  }

  @Post()
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Add a new persona preset",
    description:
      "Creates a new standard the operator can apply to future tenants. " +
      "`personas.al` is required; other languages optional. Use `{business}` " +
      "where the tenant name should appear.",
  })
  @ApiCreatedResponse({ type: PersonaPresetResponseDto })
  create(
    @Body() dto: CreatePersonaPresetDto,
  ): Promise<PersonaPresetResponseDto> {
    return this.presets.create(dto);
  }

  @Put(":id")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Edit a persona preset's wording",
    description:
      "Updates label/description/personas/active. Already-created tenants " +
      "are unaffected (presets are copied at create time); future " +
      "`POST /v1/tenants` with this preset uses the new text.",
  })
  @ApiOkResponse({ type: PersonaPresetResponseDto })
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePersonaPresetDto,
  ): Promise<PersonaPresetResponseDto> {
    return this.presets.update(id, dto);
  }

  @Get(":id/usage")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Which businesses use this preset",
    description:
      "Union of personas that record the preset as their source (exact) and " +
      "personas whose text still equals the preset's (older tenants; misses " +
      "edited copies). Shown before deactivating; blocks deleting.",
  })
  @ApiOkResponse({ type: PresetUsageDto })
  usage(@Param("id") id: string): Promise<PresetUsageDto> {
    return this.presets.usage(id);
  }

  @Delete(":id")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Delete a persona preset (hard)",
    description:
      "Permanently removes the preset. Refused with 409 `preset_in_use` while " +
      "any business uses it — deactivate it (PUT `{ active: false }`), migrate " +
      "those businesses, then delete. Businesses' own personas are copies and " +
      "are never touched.",
  })
  @ApiOkResponse({ schema: { example: { id: "restaurant", deleted: true } } })
  remove(@Param("id") id: string): Promise<{ id: string; deleted: true }> {
    return this.presets.remove(id);
  }
}
