import { CENTRE, RINGS, SECTORS, zoneCode } from "./zone-model";

/**
 * Zone cells as GeoJSON, shaped to look like a real fare-zone map: discrete
 * numbered areas with drawn boundaries, not concentric bands.
 *
 * When real polygons replace the model, this file becomes a loader instead of
 * a generator and nothing else changes.
 */

const EARTH_RADIUS_KM = 6371.0088;

export interface ZoneFeature {
  type: "Feature";
  properties: { code: string; ring: number; sector: number };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface ZoneCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

/** Point at `radiusKm` from `centre` along `bearingDeg`. */
export function destinationPoint(
  centre: { lat: number; lon: number },
  radiusKm: number,
  bearingDeg: number,
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(centre.lat);
  const lon1 = toRad(centre.lon);
  const angular = radiusKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [toDeg(lon2), toDeg(lat2)];
}

/** Full geodesic circle, used for the central disc. */
export function geodesicCircle(
  centre: { lat: number; lon: number },
  radiusKm: number,
  steps = 128,
): number[][] {
  const coords: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    coords.push(destinationPoint(centre, radiusKm, (360 * i) / steps));
  }
  return coords;
}

/** Bearing range covered by a sector, centred on the compass point. */
export function sectorBearings(sector: number): { start: number; end: number } {
  const width = 360 / SECTORS;
  const centreBearing = (sector - 1) * width;
  return { start: centreBearing - width / 2, end: centreBearing + width / 2 };
}

/**
 * One zone cell. The central disc is a plain circle; every other cell is an
 * annular sector — an arc out at the far radius, back along the near radius.
 */
export function zoneCellPolygon(
  ring: number,
  sector: number,
  innerKm: number,
  outerKm: number,
): ZoneFeature {
  const props = { code: zoneCode(ring, sector), ring, sector };

  if (sector === 0) {
    return {
      type: "Feature",
      properties: props,
      geometry: { type: "Polygon", coordinates: [geodesicCircle(CENTRE, outerKm)] },
    };
  }

  const { start, end } = sectorBearings(sector);
  const steps = 24;
  const outer: number[][] = [];
  const inner: number[][] = [];

  for (let i = 0; i <= steps; i++) {
    const b = start + ((end - start) * i) / steps;
    outer.push(destinationPoint(CENTRE, outerKm, b));
    inner.push(destinationPoint(CENTRE, innerKm, b));
  }

  const ringCoords = [...outer, ...inner.reverse()];
  ringCoords.push(ringCoords[0]);

  return {
    type: "Feature",
    properties: props,
    geometry: { type: "Polygon", coordinates: [ringCoords] },
  };
}

export function buildZoneCollection(): ZoneCollection {
  const features: ZoneFeature[] = [];

  for (const r of RINGS) {
    if (r.ring === 1) {
      features.push(zoneCellPolygon(1, 0, 0, r.outerKm));
      continue;
    }
    for (let s = 1; s <= SECTORS; s++) {
      features.push(zoneCellPolygon(r.ring, s, r.innerKm, r.outerKm));
    }
  }

  // Largest rings first so the small central cell paints on top.
  return { type: "FeatureCollection", features: features.reverse() };
}

export interface LabelFeature {
  type: "Feature";
  properties: { code: string; ring: number };
  geometry: { type: "Point"; coordinates: [number, number] };
}

/**
 * One number per cell, at the cell's centre — the way a printed fare-zone map
 * puts the zone number inside its own area.
 *
 * A polygon centroid is no good for annular sectors, so the point is placed
 * analytically at mid-radius, mid-bearing.
 */
export function buildZoneLabels(): { type: "FeatureCollection"; features: LabelFeature[] } {
  const features: LabelFeature[] = [];

  for (const r of RINGS) {
    const mid = (r.innerKm + r.outerKm) / 2;

    if (r.ring === 1) {
      features.push({
        type: "Feature",
        properties: { code: zoneCode(1, 0), ring: 1 },
        geometry: { type: "Point", coordinates: [CENTRE.lon, CENTRE.lat] },
      });
      continue;
    }

    for (let s = 1; s <= SECTORS; s++) {
      const { start, end } = sectorBearings(s);
      features.push({
        type: "Feature",
        properties: { code: zoneCode(r.ring, s), ring: r.ring },
        geometry: { type: "Point", coordinates: destinationPoint(CENTRE, mid, (start + end) / 2) },
      });
    }
  }

  return { type: "FeatureCollection", features };
}
