import { describe, it, expect } from "vitest";
import { geodesicCircle, ringToPolygon, buildRingCollection } from "../src/lib/zone-geometry";
import { CENTRE, RINGS, distanceKm } from "../src/lib/zone-model";

/**
 * Point-in-polygon correctness for the rendered zone polygons.
 *
 * These matter because the map draws the polygons while the readout uses the
 * analytic model. If the two ever disagree, the app shows a user a zone number
 * that contradicts the shape highlighted under their own dot.
 */

/** Standard ray-casting. Deliberately independent of the app's own maths. */
function pointInPolygon(pt: [number, number], ringCoords: number[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ringCoords.length - 1; i < ringCoords.length; j = i++) {
    const [xi, yi] = ringCoords[i];
    const [xj, yj] = ringCoords[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

describe("geodesicCircle", () => {
  it("closes the ring", () => {
    const c = geodesicCircle(CENTRE, 5);
    expect(c[0]).toEqual(c[c.length - 1]);
  });

  it("puts every vertex at the requested radius", () => {
    for (const radius of [1, 5, 13, 40]) {
      for (const [lon, lat] of geodesicCircle(CENTRE, radius, 32)) {
        expect(distanceKm(CENTRE, { lat, lon })).toBeCloseTo(radius, 3);
      }
    }
  });

  it("stays round at Copenhagen's latitude rather than squashing", () => {
    // A naive degree-scaled circle collapses in longitude this far north.
    const c = geodesicCircle(CENTRE, 20, 4);
    const north = c[0];
    const east = c[1];
    expect(distanceKm(CENTRE, { lat: north[1], lon: north[0] })).toBeCloseTo(20, 3);
    expect(distanceKm(CENTRE, { lat: east[1], lon: east[0] })).toBeCloseTo(20, 3);
  });
});

describe("ringToPolygon", () => {
  it("makes ring 1 a solid disc with no hole", () => {
    const f = ringToPolygon(RINGS[0]);
    expect(f.geometry.coordinates).toHaveLength(1);
    expect(f.properties.ring).toBe(1);
  });

  it("makes every outer ring an annulus with exactly one hole", () => {
    for (const r of RINGS.slice(1)) {
      const f = ringToPolygon(r);
      expect(f.geometry.coordinates).toHaveLength(2);
      expect(f.properties.innerKm).toBeGreaterThan(0);
    }
  });

  it("winds the hole opposite to the outer boundary", () => {
    const f = ringToPolygon(RINGS[2]);
    const [outer, hole] = f.geometry.coordinates;
    const signedArea = (ring: number[][]) => {
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
      }
      return a;
    };
    expect(Math.sign(signedArea(outer))).not.toBe(Math.sign(signedArea(hole)));
  });
});

describe("polygons agree with the analytic model", () => {
  const latPerKm = 1 / 111.195;

  it("the centre falls inside ring 1's polygon and no other", () => {
    const pt: [number, number] = [CENTRE.lon, CENTRE.lat];
    for (const r of RINGS) {
      const f = ringToPolygon(r);
      const inOuter = pointInPolygon(pt, f.geometry.coordinates[0]);
      const inHole =
        f.geometry.coordinates[1] !== undefined &&
        pointInPolygon(pt, f.geometry.coordinates[1]);
      expect(inOuter && !inHole).toBe(r.ring === 1);
    }
  });

  it("a midpoint of each ring lands in that ring's band only", () => {
    for (const r of RINGS) {
      const mid = (r.innerKm + r.outerKm) / 2;
      const pt: [number, number] = [CENTRE.lon, CENTRE.lat + mid * latPerKm];

      const f = ringToPolygon(r);
      const inOuter = pointInPolygon(pt, f.geometry.coordinates[0]);
      const inHole =
        f.geometry.coordinates[1] !== undefined &&
        pointInPolygon(pt, f.geometry.coordinates[1]);

      expect(inOuter, `ring ${r.ring} midpoint inside outer boundary`).toBe(true);
      expect(inHole, `ring ${r.ring} midpoint outside the hole`).toBe(false);
    }
  });

  it("a point beyond the outermost ring is in no polygon", () => {
    const pt: [number, number] = [CENTRE.lon, CENTRE.lat + 60 * latPerKm];
    for (const r of RINGS) {
      const f = ringToPolygon(r);
      expect(pointInPolygon(pt, f.geometry.coordinates[0])).toBe(false);
    }
  });
});

describe("buildRingCollection", () => {
  it("emits one feature per ring", () => {
    const fc = buildRingCollection();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(RINGS.length);
  });

  it("orders largest first so small central rings paint on top", () => {
    const rings = buildRingCollection().features.map((f) => f.properties.ring);
    expect(rings).toEqual([...rings].sort((a, b) => b - a));
  });

  it("is valid GeoJSON geometry throughout", () => {
    for (const f of buildRingCollection().features) {
      expect(f.geometry.type).toBe("Polygon");
      for (const ring of f.geometry.coordinates) {
        expect(ring.length).toBeGreaterThan(3);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const [lon, lat] of ring) {
          expect(Number.isFinite(lon) && Number.isFinite(lat)).toBe(true);
          expect(Math.abs(lat)).toBeLessThanOrEqual(90);
          expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        }
      }
    }
  });
});
