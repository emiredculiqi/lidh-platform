/**
 * One-time geocode backfill (ADR-016): fill Property.lat/lng for a tenant so
 * the search "nearby" step can rank by real distance. Geocodes DISTINCT
 * (area, city) pairs via OpenStreetMap Nominatim (free, ~1 req/s) and updates
 * all matching rows — so ~hundreds of listings cost only a few dozen calls.
 *
 *   TENANT_SLUG=bela-real-estate \
 *     packages/db/node_modules/.bin/tsx services/api/scripts/geocode-properties.ts
 */
import { PrismaClient } from "@lidh/db";

const SLUG = process.env.TENANT_SLUG ?? "bela-real-estate";
const UA = "LidhBot/1.0 (https://lidh.al; geocode backfill)";
const DELAY_MS = 1100; // Nominatim usage policy: <= 1 req/s
const MAX_CALLS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Nominatim resolves Tirana neighborhoods reliably only with the English
// exonyms ("<area>, Tirana, Albania"); the Albanian "Tiranë, Shqipëri" form
// collapses many neighborhoods to the city centroid.
function cityExonym(city: string): string {
  const n = city.toLowerCase();
  if (n.includes("tiran")) return "Tirana";
  if (n.includes("durr")) return "Durres";
  return city;
}

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: SLUG },
      select: { id: true, name: true },
    });
    if (!tenant) throw new Error(`Tenant "${SLUG}" not found`);

    // Distinct (area, city) pairs still missing coordinates.
    const groups = await prisma.property.groupBy({
      by: ["area", "city"],
      where: { tenantId: tenant.id, lat: null },
      _count: true,
    });
    // Geocode the busiest areas first (best coverage per call).
    groups.sort((a, b) => b._count - a._count);
    console.log(
      `${groups.length} distinct (area, city) pairs to geocode for ${tenant.name}`,
    );

    let calls = 0;
    let updated = 0;
    for (const g of groups) {
      if (calls >= MAX_CALLS) {
        console.log(`hit MAX_CALLS=${MAX_CALLS}, stopping`);
        break;
      }
      const exo = cityExonym(g.city);
      const q = [g.area, exo, "Albania"].filter(Boolean).join(", ");
      let pt = await geocode(q);
      calls++;
      await sleep(DELAY_MS);
      // Fallback to the city centroid if the neighborhood didn't resolve.
      if (!pt && g.city) {
        pt = await geocode(`${exo}, Albania`);
        calls++;
        await sleep(DELAY_MS);
      }
      if (!pt) {
        console.log(`  · no geocode: ${q} (${g._count})`);
        continue;
      }
      const res = await prisma.property.updateMany({
        where: {
          tenantId: tenant.id,
          city: g.city,
          area: g.area,
          lat: null,
        },
        data: { lat: pt.lat, lng: pt.lng },
      });
      updated += res.count;
      console.log(
        `  ✓ ${q} -> ${pt.lat.toFixed(4)},${pt.lng.toFixed(4)} (${res.count} rows)`,
      );
    }

    const withCoords = await prisma.property.count({
      where: { tenantId: tenant.id, lat: { not: null } },
    });
    const total = await prisma.property.count({
      where: { tenantId: tenant.id },
    });
    console.log(
      `\nDone. ${calls} geocode calls, ${updated} rows updated. ${withCoords}/${total} properties now have coordinates.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
