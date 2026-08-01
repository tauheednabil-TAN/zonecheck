/**
 * THE ZONE MODEL — read this before trusting any number this app produces.
 *
 * Copenhagen's real DOT fare zones are ~211 discrete numbered areas. They are
 * NOT published as open geodata anywhere:
 *
 *   - Rejseplanen's GTFS feed has no `zone_id` and no fare files at all.
 *     (Verified 2026-07-30 against the live feed — see DATA.md.)
 *   - OpenStreetMap's `fare_zone` tag is a stale *proposal*, never adopted.
 *     A probe of the whole Copenhagen bounding box returned nothing usable.
 *   - No municipal or national open-data portal publishes the polygons.
 *
 * So this file is an APPROXIMATION and the app says so on every screen.
 *
 * WHAT THE APPROXIMATION IS BASED ON
 * Observed structure of the real zone map:
 *   - Zone 01 is central Copenhagen.
 *   - Other zones carry two-digit numbers whose TENS digit grows with distance
 *     from the centre and whose UNITS digit varies with compass direction.
 *     (e.g. 4x lies west of 3x, which lies west of 1x.)
 *   - Zones are discrete cells with boundaries, not concentric bands.
 * This model reproduces that ring-and-sector structure.
 *
 * CALIBRATION ANCHOR
 * Central Copenhagen to the airport is a 3-ZONE ticket in real life. The ring
 * radii below are fitted so that journey returns 3. An earlier version used
 * wider rings and returned 2, which was wrong on the city's commonest trip.
 *
 * WHAT IT STILL GETS WRONG
 * Real boundaries follow municipal borders, coastline and history. These are
 * circular sectors. The two-digit codes are STRUCTURALLY plausible but are NOT
 * the real DOT numbers — do not read "32" here as DOT zone 32.
 *
 * THE REAL FIX
 * Rejseplanen's `zoneFromCoordinate` API returns the genuine DOT zone (the
 * `DOT001`-style ids). Set REJSEPLANEN_ACCESS_ID and the app uses it instead of
 * this file, labelling the answer as official. See src/app/api/zone/route.ts.
 */

/** Rådhuspladsen, Copenhagen. The centre the zone system radiates from. */
export const CENTRE = { lat: 55.6759, lon: 12.5655 } as const;

/**
 * Outer radius of each ring, in km. Ring index 1 is the innermost band around
 * the central disc. Fitted to the airport anchor: the airport is 8.37 km out
 * and must land in the 3rd zone step.
 */
export const RING_OUTER_RADII_KM = [4, 7, 10.5, 14, 18, 23, 28, 34, 42] as const;

export const MAX_RING = RING_OUTER_RADII_KM.length;

/** Compass sectors per ring. The central disc is a single undivided zone. */
export const SECTORS = 8;

export interface Ring {
  ring: number;
  innerKm: number;
  outerKm: number;
}

export const RINGS: Ring[] = RING_OUTER_RADII_KM.map((outerKm, i) => ({
  ring: i + 1,
  innerKm: i === 0 ? 0 : RING_OUTER_RADII_KM[i - 1],
  outerKm,
}));

export interface Zone {
  ring: number;
  /** 0 for the central disc, otherwise 1..SECTORS running clockwise from north. */
  sector: number;
  /** Display code, e.g. "01" for the centre, "32" for ring 3 sector 2. */
  code: string;
}

const EARTH_RADIUS_KM = 6371.0088;

export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Initial bearing from `a` to `b`, degrees clockwise from north, 0..360. */
export function bearingDeg(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Two-digit code. Centre is "01"; elsewhere tens = ring, units = sector. */
export function zoneCode(ring: number, sector: number): string {
  if (sector === 0) return "01";
  return `${ring}${sector}`;
}

export function ringForPoint(p: { lat: number; lon: number }): number | null {
  const d = distanceKm(CENTRE, p);
  for (const r of RINGS) {
    if (d <= r.outerKm) return r.ring;
  }
  return null;
}

/**
 * Which zone cell does this point fall in?
 *
 * Returns `null` beyond the outermost ring — the app shows an honest "outside
 * the covered area" state rather than clamping, because a clamped answer would
 * be a confident lie.
 */
export function zoneForPoint(p: { lat: number; lon: number }): Zone | null {
  const ring = ringForPoint(p);
  if (ring === null) return null;

  // The central disc is one undivided zone, like the real zone 01.
  if (ring === 1) return { ring: 1, sector: 0, code: zoneCode(1, 0) };

  const b = bearingDeg(CENTRE, p);
  // Offset by half a sector so boundaries fall between compass points rather
  // than exactly on due-north, which would split the map awkwardly.
  const sector = (Math.floor((b + 360 / SECTORS / 2) / (360 / SECTORS)) % SECTORS) + 1;

  return { ring, sector, code: zoneCode(ring, sector) };
}

/**
 * Distinct zones a straight journey passes through.
 *
 * Samples along the great-circle path and collects each distinct cell, which
 * matches how DOT actually prices: you pay for the zones you travel through,
 * not the difference between two zone numbers. A tangential trip that clips a
 * corner therefore counts that zone, as it should.
 */
export function zonesCrossed(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  samples = 400,
): string[] {
  const seen: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const p = { lat: from.lat + (to.lat - from.lat) * f, lon: from.lon + (to.lon - from.lon) * f };
    const z = zoneForPoint(p);
    if (z && !seen.includes(z.code)) seen.push(z.code);
  }
  return seen;
}

/** DOT's minimum fare is two zones, so a trip inside one zone still counts 2. */
export function billableZoneCount(zonesSpanned: number): number {
  return Math.max(2, zonesSpanned);
}

/**
 * Ticket validity in minutes. Real DOT rule: 2 zones = 60 min, each extra zone
 * adds 30. Confirmed against a real ticket screenshot: 3 zones = 1 hr 30 min.
 */
export function validityMinutes(zoneCount: number): number {
  return 60 + Math.max(0, zoneCount - 2) * 30;
}

/** Kept for the ring-span view; journeys now use zonesCrossed. */
export function ringsCrossed(fromRing: number, toRing: number): number[] {
  const lo = Math.min(fromRing, toRing);
  const hi = Math.max(fromRing, toRing);
  const out: number[] = [];
  for (let r = lo; r <= hi; r++) out.push(r);
  return out;
}
