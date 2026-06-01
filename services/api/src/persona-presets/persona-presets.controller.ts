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

  @Delete(":id")
  @PlatformAdminOnly()
  @ApiOperation({
    summary: "Deactivate a persona preset (soft)",
    description:
      "Hides it from the New-tenant picker. Not destructive — existing " +
      "tenants keep their personas; reactivate via PUT `{ active: true }`.",
  })
  @ApiOkResponse({ schema: { example: { id: "restaurant", active: false } } })
  remove(@Param("id") id: string): Promise<{ id: string; active: false }> {
    return this.presets.remove(id);
  }
}
