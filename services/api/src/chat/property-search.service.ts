import { Injectable } from "@nestjs/common";
import type { Prisma } from "@lidh/db";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * Structured real-estate search (ADR-016) backing the `search_properties`
 * agent tool. Does exact SQL filtering over the Property table, and when an
 * exact match is empty widens the search:
 *
 *   1. exact (all filters incl. neighborhood)
 *   2. NEAREST neighbourhoods — rank the city-wide candidates by real
 *      distance to the requested area's centroid (from our own geocoded
 *      Property.lat/lng), so we surface genuinely-close listings rather than
 *      random ones across town
 *   3. adjacent city (Tiranë <-> Durrës)
 *   4. relaxed (drop price/size)
 *
 * Output is localized (Albanian / English) so the model stays on-language —
 * the tool text carries Albanian field labels + Albanian instructions when
 * locale is "al", which noticeably improves the agent's Albanian.
 */

export interface PropertyFilters {
  listingType?: "sale" | "rent";
  city?: string;
  area?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number; // minimum
  bathrooms?: number; // minimum
  minAreaSqm?: number;
  maxAreaSqm?: number;
}

const MAX_RESULTS = 4;
const CANDIDATE_POOL = 80; // fetched then distance-ranked for the "nearby" step

const CITY_ADJACENCY: Record<string, string[]> = {
  Tiranë: ["Durrës"],
  Durrës: ["Tiranë"],
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function canonicalCity(input?: string): string | undefined {
  if (!input) return undefined;
  const n = fold(input);
  if (n.includes("tiran")) return "Tiranë";
  if (n.includes("durr")) return "Durrës";
  return input;
}

/** Great-circle distance in km. */
function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface Row {
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
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}

@Injectable()
export class PropertySearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    tenantId: string,
    filters: PropertyFilters,
    locale = "al",
  ): Promise<string> {
    const L = locale === "al" ? AL : EN;
    const city = canonicalCity(filters.city);

    // 1) Exact.
    const exact = await this.query(tenantId, { ...filters, city }, MAX_RESULTS);
    if (exact.length) return render(exact, L.exact(exact.length), L);

    // 2) Nearest neighbourhoods to the requested area, by real distance.
    if (filters.area && city) {
      const ref = await this.areaReference(tenantId, city, filters.area);
      const pool = await this.query(
        tenantId,
        { ...filters, city, area: undefined },
        CANDIDATE_POOL,
      );
      if (ref) {
        const ranked = pool
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => ({
            p,
            d: haversineKm(ref.lat, ref.lng, p.lat as number, p.lng as number),
          }))
          .sort((a, b) => a.d - b.d)
          .slice(0, MAX_RESULTS)
          .map((x) => x.p);
        if (ranked.length) {
          return render(ranked, L.nearby(filters.area, city), L);
        }
      }
      if (pool.length) {
        return render(pool.slice(0, MAX_RESULTS), L.widerArea(filters.area, city), L);
      }
    }

    // 3) Adjacent city.
    if (city && CITY_ADJACENCY[city]) {
      for (const near of CITY_ADJACENCY[city]) {
        const nearby = await this.query(
          tenantId,
          { ...filters, city: near, area: undefined },
          MAX_RESULTS,
        );
        if (nearby.length) return render(nearby, L.nearbyCity(city, near), L);
      }
    }

    // 4) Relaxed: keep listingType + city, drop the rest.
    const relaxed = await this.query(
      tenantId,
      { listingType: filters.listingType, city },
      MAX_RESULTS,
    );
    if (relaxed.length) return render(relaxed, L.relaxed, L);

    return L.none;
  }

  /** Centroid of available listings in the requested area (any other filters),
   *  used as the reference point for distance ranking. */
  private async areaReference(
    tenantId: string,
    city: string,
    area: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const rows = await this.prisma.client.property.findMany({
      where: {
        tenantId,
        status: "available",
        city: { equals: city, mode: "insensitive" },
        area: { contains: area, mode: "insensitive" },
        lat: { not: null },
        lng: { not: null },
      },
      select: { lat: true, lng: true },
      take: 25,
    });
    if (!rows.length) return null;
    const lat =
      rows.reduce((s, r) => s + (r.lat as number), 0) / rows.length;
    const lng =
      rows.reduce((s, r) => s + (r.lng as number), 0) / rows.length;
    return { lat, lng };
  }

  private async query(
    tenantId: string,
    f: PropertyFilters,
    take: number,
  ): Promise<Row[]> {
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
      take,
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
        lat: true,
        lng: true,
        sourceUrl: true,
      },
    });
    return rows as Row[];
  }
}

function render(rows: Row[], header: string, L: Labels): string {
  return `${header}\n\n${rows.map((r) => L.line(r)).join("\n")}`;
}

interface Labels {
  exact: (n: number) => string;
  nearby: (area: string, city: string) => string;
  widerArea: (area: string, city: string) => string;
  nearbyCity: (reqCity: string, nearCity: string) => string;
  relaxed: string;
  none: string;
  line: (r: Row) => string;
}

const AL: Labels = {
  exact: (n) =>
    `LISTIME_EKZAKTE (${n}): këto përputhen me kërkesën — paraqiti natyrshëm te vizitori, secilën me linkun e saj.`,
  nearby: (area, city) =>
    `ASNJE_NE_LAGJEN_E_SAKTE: nuk ka listime pikërisht në "${area}", por ja ${MAX_RESULTS > 0 ? "" : ""}pronat më të AFËRTA me "${area}" (lagje pranë, në ${city}). Thuaji vizitorit hapur se nuk gjete pikërisht në "${area}" dhe se këto janë më të afërtat.`,
  widerArea: (area, city) =>
    `ASNJE_NE_LAGJEN_E_SAKTE: nuk ka listime në "${area}"; ja disa opsione të tjera në ${city}. Thuaji vizitorit se nuk ka në lagjen e saktë dhe këto janë alternativa.`,
  nearbyCity: (reqCity, nearCity) =>
    `ASNJE_NE_QYTETIN_E_KERKUAR: nuk ka listime në ${reqCity}; ja më të afërtat në ${nearCity} (qyteti më i afërt). Thuaji vizitorit se s'ka në ${reqCity} dhe këto janë te qyteti më i afërt.`,
  relaxed:
    `ASNJE_PERPUTHJE_E_SAKTE: ja listimet më të afërta pasi u lehtësuan disa filtra. Thuaji vizitorit se këto nuk i plotësojnë të gjitha kriteret dhe pyet cilin kriter do ta lëshojë (zona, buxheti, sipërfaqja).`,
  none:
    "PA_REZULTAT: Nuk u gjet asnjë listim, edhe pas zgjerimit. Thuaji vizitorit ndershëm dhe ofro t'i marrësh të dhënat që ekipi ta ndihmojë, ose pyet a do ta lehtësojë një kriter.",
  line: (r) => {
    const bits = [
      r.propertyType,
      r.bedrooms != null ? `${r.bedrooms} dhoma` : null,
      r.bathrooms != null ? `${r.bathrooms} banjo` : null,
      r.areaSqm != null ? `${r.areaSqm} m²` : null,
      r.floor != null ? `kati ${r.floor}` : null,
      [r.area, r.city].filter(Boolean).join(", ") || null,
      r.priceEur != null
        ? `€${r.priceEur.toLocaleString("en-US")}${r.listingType === "rent" ? "/muaj" : ""}`
        : null,
      r.listingType === "rent" ? "me qira" : "në shitje",
    ]
      .filter(Boolean)
      .join(" · ");
    return `• ${r.title} — ${bits}\n  ${r.sourceUrl}`;
  },
};

const EN: Labels = {
  exact: (n) =>
    `EXACT_MATCHES (${n}): these match the visitor's criteria — present them naturally, each with its link.`,
  nearby: (area, city) =>
    `NONE_IN_EXACT_AREA: nothing exactly in "${area}", so here are the listings CLOSEST to "${area}" (nearby neighbourhoods in ${city}). Tell the visitor honestly there was nothing in "${area}" and these are the nearest.`,
  widerArea: (area, city) =>
    `NONE_IN_EXACT_AREA: nothing in "${area}"; here are other options in ${city}. Tell the visitor there was nothing in the exact neighbourhood and these are alternatives.`,
  nearbyCity: (reqCity, nearCity) =>
    `NONE_IN_REQUESTED_CITY: nothing in ${reqCity}; here are the nearest in ${nearCity} (the closest city). Tell the visitor there was nothing in ${reqCity} and these are in the nearest city.`,
  relaxed:
    `NO_EXACT_MATCH: here are the closest listings after relaxing some filters. Tell the visitor these don't meet every criterion and ask which one they'd relax (area, budget, size).`,
  none:
    "NO_RESULTS: nothing found even after widening. Tell the visitor honestly and offer to take their details so the team can help, or ask them to relax a criterion.",
  line: (r) => {
    const bits = [
      r.propertyType,
      r.bedrooms != null ? `${r.bedrooms} bed` : null,
      r.bathrooms != null ? `${r.bathrooms} bath` : null,
      r.areaSqm != null ? `${r.areaSqm} m²` : null,
      r.floor != null ? `floor ${r.floor}` : null,
      [r.area, r.city].filter(Boolean).join(", ") || null,
      r.priceEur != null
        ? `€${r.priceEur.toLocaleString("en-US")}${r.listingType === "rent" ? "/mo" : ""}`
        : null,
      r.listingType === "rent" ? "for rent" : "for sale",
    ]
      .filter(Boolean)
      .join(" · ");
    return `• ${r.title} — ${bits}\n  ${r.sourceUrl}`;
  },
};
