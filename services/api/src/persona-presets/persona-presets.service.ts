import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PERSONA_PRESETS } from "@lidh/core";
import { PrismaService } from "../common/prisma/prisma.service";
import type { PersonaPresetResponseDto } from "./dto/persona-preset.dto";
import type {
  CreatePersonaPresetDto,
  UpdatePersonaPresetDto,
} from "./dto/persona-preset.dto";

/**
 * The DB-backed persona preset library (ADR-010, revises ADR-009 storage).
 *
 * On first boot the code-shipped `PERSONA_PRESETS` (@lidh/core) are seeded
 * CREATE-IF-MISSING: a new code preset appears automatically, but an existing
 * row is NEVER overwritten so operator edits survive deploys. Thereafter the
 * DB is the source of truth and the dashboard edits it directly.
 */
@Injectable()
export class PersonaPresetsService implements OnModuleInit {
  private readonly logger = new Logger(PersonaPresetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const db = this.prisma.client;
    let seeded = 0;
    for (const p of PERSONA_PRESETS) {
      const res = await db.personaPreset.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          label: p.label,
          description: p.description,
          personas: p.personas,
          active: true,
        },
        update: {}, // exists → leave operator edits untouched
      });
      if (res.createdAt.getTime() === res.updatedAt.getTime()) seeded++;
    }
    if (seeded > 0) {
      this.logger.log(`seeded ${seeded} default persona preset(s)`);
    }
  }

  async list(all = false): Promise<PersonaPresetResponseDto[]> {
    const rows = await this.prisma.client.personaPreset.findMany({
      where: all ? {} : { active: true },
      orderBy: { createdAt: "asc" },
    });
    return rows as unknown as PersonaPresetResponseDto[];
  }

  async create(
    dto: CreatePersonaPresetDto,
  ): Promise<PersonaPresetResponseDto> {
    const row = await this.prisma.client.personaPreset.create({
      data: {
        label: dto.label,
        description: dto.description,
        personas: { ...dto.personas },
        active: true,
      },
    });
    this.logger.log(`persona preset created: ${row.id} (${row.label})`);
    return row as unknown as PersonaPresetResponseDto;
  }

  async update(
    id: string,
    dto: UpdatePersonaPresetDto,
  ): Promise<PersonaPresetResponseDto> {
    const existing = await this.prisma.client.personaPreset.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("persona_preset_not_found");
    const row = await this.prisma.client.personaPreset.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.personas !== undefined
          ? { personas: { ...dto.personas } }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    this.logger.log(`persona preset updated: ${id}`);
    return row as unknown as PersonaPresetResponseDto;
  }

  /** Soft remove — hidden from the picker, existing tenants unaffected. */
  async remove(id: string): Promise<{ id: string; active: false }> {
    const existing = await this.prisma.client.personaPreset.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("persona_preset_not_found");
    await this.prisma.client.personaPreset.update({
      where: { id },
      data: { active: false },
    });
    this.logger.log(`persona preset deactivated: ${id}`);
    return { id, active: false };
  }
}
