import { CENTRE, RINGS, type Ring } from "./zone-model";

/**
 * Ring polygons as GeoJSON.
 *
 * Built here rather than pulled from a source file because the model is
 * analytic (see zone-model.ts). When real polygons replace the model, this
 * file becomes a loader instead of a generator and nothing else changes.
 */

export interface RingFeature {
  type: "Feature";
  properties: { ring: number; innerKm: number; outerKm: number };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface RingCollection {
  type: "FeatureCollection";
  features: RingFeature[];
}

const EARTH_RADIUS_KM = 6371.0088;

/**
 * A geodesic circle as a ring of [lon, lat] pairs, wound counter-clockwise.
 *
 * Uses the proper destination-point formula rather than scaling degrees, so
 * the circles stay round at Copenhagen's latitude instead of squashing.
 */
export function geodesicCircle(
  centre: { lat: number; lon: number },
  radiusKm: number,
  steps = 128,
): number[][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(centre.lat);
  const lon1 = toRad(centre.lon);
  const angular = radiusKm / EARTH_RADIUS_KM;

  const coords: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;

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

    coords.push([toDeg(lon2), toDeg(lat2)]);
  }
  return coords;
}

/**
 * One ring as a polygon. Ring 1 is a disc; every ring beyond it is an annulus,
 * built as an outer boundary with the previous ring punched out as a hole.
 * Winding is reversed on the hole so renderers fill the band, not the middle.
 */
export function ringToPolygon(r: Ring): RingFeature {
  const outer = geodesicCircle(CENTRE, r.outerKm);
  const coordinates: number[][][] = [outer];

  if (r.innerKm > 0) {
    coordinates.push(geodesicCircle(CENTRE, r.innerKm).slice().reverse());
  }

  return {
    type: "Feature",
    properties: { ring: r.ring, innerKm: r.innerKm, outerKm: r.outerKm },
    geometry: { type: "Polygon", coordinates },
  };
}

export function buildRingCollection(): RingCollection {
  return {
    type: "FeatureCollection",
    // Painted largest first so the small central rings land on top.
    features: RINGS.slice().reverse().map(ringToPolygon),
  };
}
