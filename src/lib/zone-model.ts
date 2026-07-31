/**
 * THE ZONE MODEL — read this before trusting any number this app produces.
 *
 * Copenhagen's real DOT fare zones are an administrative fact with legally
 * binding consequences. They are NOT published as open geodata anywhere:
 *
 *   - Rejseplanen's GTFS feed has no `zone_id` and no fare files at all.
 *     (Verified 2026-07-30 against the live feed — see DATA.md.)
 *   - OpenStreetMap's `fare_zone` tag is a rejected/stale *proposal*, never
 *     adopted. A probe of the whole Copenhagen bounding box returned nothing
 *     usable.
 *   - No municipal or national open-data portal publishes the polygons.
 *
 * So this file contains an APPROXIMATION, and the app says so on every screen.
 *
 * WHAT THE APPROXIMATION IS BASED ON
 * The real system is genuinely concentric: 9 coloured zone rings radiating out
 * from central Copenhagen, zone 1 at the centre, and your fare is set by how
 * many rings your journey crosses. That ring structure is public knowledge and
 * is what this model reproduces.
 *
 * WHAT IT GETS WRONG
 * Real zone boundaries follow municipal borders, coastline, and historical
 * quirks. They are not circles. Expect this model to be wrong near any
 * boundary, and wrong more often the further you get from the centre. It does
 * not reproduce the 97 individual zone numbers, only the ring a point falls in.
 *
 * REPLACING IT
 * Everything downstream consumes `ringForPoint()` and `RINGS`. Swap this one
 * file for real polygons and the rest of the app needs no changes. The most
 * likely real source is the Rejseplanen Labs REST API (free account, may
 * expose tariff data) — see DATA.md.
 */

/** Rådhuspladsen, Copenhagen. The centre the DOT ring system radiates from. */
export const CENTRE = { lat: 55.6759, lon: 12.5655 } as const;

/**
 * Outer radius of each ring, in kilometres, measured from CENTRE.
 *
 * Ring 1 is wider than the rest because central Copenhagen's zone 1 genuinely
 * covers a larger area than a single step outward. Beyond ring 1 the real
 * zones are roughly 4 km across, which is what the even spacing reflects.
 *
 * These are the numbers to tune if better ground truth turns up. They are the
 * single largest source of error in the whole app.
 */
export const RING_OUTER_RADII_KM = [5, 9, 13, 17, 21, 25, 29, 33, 40] as const;

export const MAX_RING = RING_OUTER_RADII_KM.length;

export interface Ring {
  /** Ring number, 1-based. Ring 1 is central Copenhagen. */
  ring: number;
  innerKm: number;
  outerKm: number;
}

export const RINGS: Ring[] = RING_OUTER_RADII_KM.map((outerKm, i) => ({
  ring: i + 1,
  innerKm: i === 0 ? 0 : RING_OUTER_RADII_KM[i - 1],
  outerKm,
}));

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle distance in km. Haversine — accurate to well under a metre at
 * these distances, which is far finer than the model's own error.
 */
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

/**
 * Which ring does this point fall in?
 *
 * Returns `null` when the point is beyond the outermost ring — the app must
 * show an honest "outside the covered area" state rather than clamping to 9,
 * because clamping would silently claim coverage the model does not have.
 */
export function ringForPoint(p: { lat: number; lon: number }): number | null {
  const d = distanceKm(CENTRE, p);
  for (const r of RINGS) {
    if (d <= r.outerKm) return r.ring;
  }
  return null;
}

/**
 * Zones crossed by a journey, as a ring span.
 *
 * The real DOT rule prices a journey on how many zones it passes through, and
 * a radial journey passes through every ring between its endpoints. Returns
 * the inclusive list, so ring 2 -> ring 5 yields [2,3,4,5].
 *
 * This deliberately ignores tangential journeys that skirt a ring without
 * entering it, which is one more way the model is an approximation.
 */
export function ringsCrossed(fromRing: number, toRing: number): number[] {
  const lo = Math.min(fromRing, toRing);
  const hi = Math.max(fromRing, toRing);
  const out: number[] = [];
  for (let r = lo; r <= hi; r++) out.push(r);
  return out;
}

/**
 * DOT's minimum fare is two zones, so a journey inside one ring still counts
 * as 2. This rule is real and public, and applies regardless of the geometry.
 */
export function billableZoneCount(ringsSpanned: number): number {
  return Math.max(2, ringsSpanned);
}

/**
 * Ticket validity in minutes. Real DOT rule: 2 zones = 60 min, and each extra
 * zone adds 30 min. Public, and independent of the zone geometry, so this part
 * is accurate even though the zone it is applied to may not be.
 */
export function validityMinutes(zoneCount: number): number {
  return 60 + Math.max(0, zoneCount - 2) * 30;
}
