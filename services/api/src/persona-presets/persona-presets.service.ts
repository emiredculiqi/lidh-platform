import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PERSONA_PRESETS, expandPersonas } from "@lidh/core";
import { PrismaService } from "../common/prisma/prisma.service";
import type {
  CreatePersonaPresetDto,
  PersonaPresetResponseDto,
  PresetUsageDto,
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
    // Seed is idempotent (CREATE-IF-MISSING). If the DB is unreachable at
    // boot — common when both Fly and Neon are scale-to-zero and waking from
    // idle at the same time — we log and continue. The next boot retries; in
    // the meantime requests that need presets either succeed (rows already
    // exist from a prior boot) or return 404, which is recoverable. Crashing
    // the whole API for a transient DB hiccup is worse than missing seed.
    try {
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
    } catch (err) {
      this.logger.warn(
        `preset seed skipped — DB unreachable at boot (${(err as Error).message}). Will retry next boot.`,
      );
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

  /**
   * Which businesses use this preset (ADR-022). Two signals, unioned:
   *   - reference: AgentPersona.presetId — exact, for tenants created since
   *     the column exists;
   *   - content: a persona whose text equals the preset's text for that
   *     locale with {business} expanded to the tenant's name — catches older
   *     tenants, but misses copies the owner has since edited (stated in the
   *     admin UI).
   */
  async usage(id: string): Promise<PresetUsageDto> {
    const db = this.prisma.client;
    const preset = await db.personaPreset.findUnique({ where: { id } });
    if (!preset) throw new NotFoundException("persona_preset_not_found");

    const byRef = await db.agentPersona.findMany({
      where: { presetId: id },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });
    const refIds = new Set(byRef.map((r) => r.tenantId));

    // Content match: compare each tenant's personas against the preset
    // expanded with that tenant's name. Bounded by the number of tenants,
    // which is small; personas are read once per tenant.
    const tenants = await db.tenant.findMany({
      where: { status: { not: "archived" } },
      select: {
        id: true,
        slug: true,
        name: true,
        agents: {
          select: { personas: { select: { locale: true, content: true, presetId: true } } },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const personasJson = preset.personas as Record<string, unknown>;
    const contentIds = new Set<string>();
    for (const t of tenants) {
      const expanded = expandPersonas(personasJson, t.name);
      const own = t.agents[0]?.personas ?? [];
      const hit = own.some((p) =>
        expanded.some(
          (e) => e.locale === p.locale && e.content.trim() === p.content.trim(),
        ),
      );
      if (hit) contentIds.add(t.id);
    }

    const bySlug = new Map(tenants.map((t) => [t.id, t]));
    const all = new Set([...refIds, ...contentIds]);
    const rows: PresetUsageDto["tenants"] = [];
    for (const tid of all) {
      const t = bySlug.get(tid);
      if (!t) continue; // archived or gone — not "in use" for this purpose
      rows.push({
        slug: t.slug,
        name: t.name,
        matchedBy: refIds.has(tid) ? "reference" : "content",
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { presetId: id, inUse: rows.length > 0, tenants: rows };
  }

  /** Soft remove — hidden from the picker, existing tenants unaffected. */
  async deactivate(id: string): Promise<{ id: string; active: false }> {
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

  /**
   * Hard delete (ADR-022). Refused while any business uses the preset — the
   * admin deactivates it, migrates those businesses, then deletes. Existing
   * personas are copies and would survive regardless; the refusal protects
   * the SOURCE text the admin may still need.
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const usage = await this.usage(id);
    if (usage.inUse) {
      throw new ConflictException({
        error: "preset_in_use",
        tenants: usage.tenants,
      });
    }
    await this.prisma.client.personaPreset.delete({ where: { id } });
    this.logger.log(`persona preset deleted: ${id}`);
    return { id, deleted: true };
  }
}
