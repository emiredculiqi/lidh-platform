import { Injectable } from "@nestjs/common";
import type { Prisma } from "@lidh/db";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * Structured real-estate search (ADR-016) backing the `search_properties`
 * agent tool. Unlike RAG, this does exact filtering over the Property table
 * (price/size/rooms/baths ranges, city/area/type) and, when an exact match is
 * empty, widens the search in steps — area → whole city → adjacent city — so
 * the agent can honestly offer "nearest available" alternatives.
 *
 * Geo is approximated by a city-adjacency map (no lat/lng in the v1 ingest);
 * `Property.lat/lng` exist for a future true-distance upgrade.
 */

export interface PropertyFilters {
  listingType?: "sale" | "rent";
  city?: string;
  area?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number; // treated as minimum
  bathrooms?: number; // treated as minimum
  minAreaSqm?: number;
  maxAreaSqm?: number;
}

const MAX_RESULTS = 4;

// Albanian city centroids are far enough apart that "nearest" at the demo's
// scope is really just Tiranë <-> Durrës. Extend as more cities are ingested.
const CITY_ADJACENCY: Record<string, string[]> = {
  Tiranë: ["Durrës"],
  Durrës: ["Tiranë"],
};

/** Fold diacritics + case so "tirana"/"tirane"/"Tiranë" all match. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Map a free-typed city to the canonical stored form, else pass through. */
function canonicalCity(input?: string): string | undefined {
  if (!input) return undefined;
  const n = fold(input);
  if (n.includes("tiran")) return "Tiranë";
  if (n.includes("durr")) return "Durrës";
  return input;
}

@Injectable()
export class PropertySearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a compact, model-ready text block: a header line stating whether
   * results are exact or widened alternatives, then up to MAX_RESULTS lines
   * each ending with the canonical listing URL. Empty-string filters are
   * ignored. The agent is instructed (persona + tool description) to relay
   * the URLs verbatim and to flag alternatives as such.
   */
  async search(tenantId: string, filters: PropertyFilters): Promise<string> {
    const city = canonicalCity(filters.city);

    // 1) Exact: everything the visitor asked for.
    const exact = await this.query(tenantId, { ...filters, city });
    if (exact.length) {
      return this.format(exact, "exact", city);
    }

    // 2) Widen: drop the neighborhood, search the whole city.
    if (filters.area && city) {
      const cityWide = await this.query(tenantId, {
        ...filters,
        city,
        area: undefined,
      });
      if (cityWide.length) {
        return this.format(cityWide, "wider-area", city);
      }
    }

    // 3) Widen: try adjacent cities.
    if (city && CITY_ADJACENCY[city]) {
      for (const near of CITY_ADJACENCY[city]) {
        const nearby = await this.query(tenantId, {
          ...filters,
          city: near,
          area: undefined,
        });
        if (nearby.length) {
          return this.format(nearby, "nearby-city", near);
        }
      }
    }

    // 4) Last resort: relax price/size, keep listingType + city, to show
    //    *something* current rather than a dead end.
    const relaxed = await this.query(tenantId, {
      listingType: filters.listingType,
      city,
    });
    if (relaxed.length) {
      return this.format(relaxed, "relaxed", city);
    }

    return "NO_RESULTS: No matching listings were found, even after widening the search. Tell the visitor honestly and offer to take their details so the team can help, or ask them to relax a criterion (budget, area, size).";
  }

  private async query(
    tenantId: string,
    f: PropertyFilters,
  ): Promise<PropertyRow[]> {
    const where: Prisma.PropertyWhereInput = {
      tenantId,
      status: "available",
    };
    if (f.listingType) where.listingType = f.listingType;
    if (f.city) where.city = { equals: f.city, mode: "insensitive" };
    if (f.area) where.area = { contains: f.area, mode: "insensitive" };
    if (f.propertyType)
      where.propertyType = { contains: f.propertyType, mode: "insensitive" };
    if (f.bedrooms != null) where.bedrooms = { gte: f.bedrooms };
    if (f.bathrooms != null) where.bathrooms = { gte: f.bathrooms };

    const priceFilter: Prisma.IntNullableFilter = {};
    if (f.minPrice != null) priceFilter.gte = Math.round(f.minPrice);
    if (f.maxPrice != null) priceFilter.lte = Math.round(f.maxPrice);
    if (Object.keys(priceFilter).length) where.priceEur = priceFilter;

    const areaFilter: Prisma.IntNullableFilter = {};
    if (f.minAreaSqm != null) areaFilter.gte = Math.round(f.minAreaSqm);
    if (f.maxAreaSqm != null) areaFilter.lte = Math.round(f.maxAreaSqm);
    if (Object.keys(areaFilter).length) where.areaSqm = areaFilter;

    const rows = await this.prisma.client.property.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: MAX_RESULTS,
      select: {
        title: true,
        listingType: true,
        propertyType: true,
        city: true,
        area: true,
        priceEur: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        floor: true,
        sourceUrl: true,
      },
    });
    return rows as PropertyRow[];
  }

  private format(
    rows: PropertyRow[],
    mode: "exact" | "wider-area" | "nearby-city" | "relaxed",
    locationLabel?: string,
  ): string {
    const header: Record<typeof mode, string> = {
      exact: `EXACT_MATCHES (${rows.length}): these match the visitor's criteria. Present them naturally with each link.`,
      "wider-area": `NO_EXACT_IN_AREA — showing other options in ${locationLabel ?? "the same city"}. Tell the visitor there was nothing in their exact neighborhood and these are nearby alternatives.`,
      "nearby-city": `NONE_IN_REQUESTED_CITY — showing the nearest available in ${locationLabel}. Tell the visitor there was nothing in the city they asked for and these are in the nearest area.`,
      relaxed: `NO_EXACT_MATCH — showing the closest available listings after relaxing some filters. Tell the visitor these don't match every criterion and ask which constraint they'd relax.`,
    };

    const lines = rows.map((r) => {
      const lt = r.listingType === "rent" ? "for rent" : "for sale";
      const bits = [
        r.propertyType,
        r.bedrooms != null ? `${r.bedrooms} bed` : null,
        r.bathrooms != null ? `${r.bathrooms} bath` : null,
        r.areaSqm != null ? `${r.areaSqm} m²` : null,
        r.floor != null ? `floor ${r.floor}` : null,
        [r.area, r.city].filter(Boolean).join(", ") || null,
        r.priceEur != null ? `€${r.priceEur.toLocaleString("en-US")}` : null,
        lt,
      ]
        .filter(Boolean)
        .join(" · ");
      return `• ${r.title} — ${bits}\n  ${r.sourceUrl}`;
    });

    return `${header[mode]}\n\n${lines.join("\n")}`;
  }
}

interface PropertyRow {
  title: string;
  listingType: "sale" | "rent";
  propertyType: string;
  city: string;
  area: string | null;
  priceEur: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  floor: number | null;
  sourceUrl: string;
}
