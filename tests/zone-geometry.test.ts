import { describe, it, expect } from "vitest";
import {
  geodesicCircle,
  destinationPoint,
  sectorBearings,
  zoneCellPolygon,
  buildZoneCollection,
  buildZoneLabels,
} from "../src/lib/zone-geometry";
import { CENTRE, RINGS, SECTORS, distanceKm, zoneForPoint } from "../src/lib/zone-model";

/**
 * Point-in-polygon correctness for the rendered zone cells.
 *
 * This matters because the map draws the polygons while the readout uses the
 * analytic model. If they ever disagree, a user sees a zone number that
 * contradicts the shape highlighted under their own dot.
 */

/** Standard ray-casting, deliberately independent of the app's own maths. */
function pointInPolygon(pt: [number, number], ring: number[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hits = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (hits) inside = !inside;
  }
  return inside;
}

describe("destinationPoint", () => {
  it("lands exactly the requested distance away", () => {
    for (const km of [1, 8.37, 42]) {
      for (const b of [0, 90, 180, 270]) {
        const [lon, lat] = destinationPoint(CENTRE, km, b);
        expect(distanceKm(CENTRE, { lat, lon })).toBeCloseTo(km, 3);
      }
    }
  });

  it("goes north at bearing 0 and south at 180", () => {
    expect(destinationPoint(CENTRE, 10, 0)[1]).toBeGreaterThan(CENTRE.lat);
    expect(destinationPoint(CENTRE, 10, 180)[1]).toBeLessThan(CENTRE.lat);
  });
});

describe("geodesicCircle", () => {
  it("closes the ring", () => {
    const c = geodesicCircle(CENTRE, 5);
    expect(c[0]).toEqual(c[c.length - 1]);
  });

  it("stays round at Copenhagen's latitude rather than squashing", () => {
    for (const [lon, lat] of geodesicCircle(CENTRE, 20, 32)) {
      expect(distanceKm(CENTRE, { lat, lon })).toBeCloseTo(20, 3);
    }
  });
});

describe("sectorBearings", () => {
  it("covers the full circle with no gaps", () => {
    const width = 360 / SECTORS;
    for (let s = 1; s <= SECTORS; s++) {
      const { start, end } = sectorBearings(s);
      expect(end - start).toBeCloseTo(width, 6);
    }
  });

  it("centres each sector on its compass point", () => {
    const { start, end } = sectorBearings(1);
    expect((start + end) / 2).toBeCloseTo(0, 6);
  });
});

describe("zoneCellPolygon", () => {
  it("makes the central cell a closed disc", () => {
    const f = zoneCellPolygon(1, 0, 0, RINGS[0].outerKm);
    expect(f.properties.code).toBe("01");
    const ring = f.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("makes outer cells closed annular sectors", () => {
    const f = zoneCellPolygon(3, 2, RINGS[2].innerKm, RINGS[2].outerKm);
    expect(f.properties.code).toBe("32");
    const ring = f.geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring.length).toBeGreaterThan(8);
  });

  it("keeps every vertex between the inner and outer radius", () => {
    const r = RINGS[3];
    const f = zoneCellPolygon(r.ring, 5, r.innerKm, r.outerKm);
    for (const [lon, lat] of f.geometry.coordinates[0]) {
      const d = distanceKm(CENTRE, { lat, lon });
      expect(d).toBeGreaterThanOrEqual(r.innerKm - 0.01);
      expect(d).toBeLessThanOrEqual(r.outerKm + 0.01);
    }
  });
});

describe("polygons agree with the analytic model", () => {
  it("every cell's own label point falls inside that cell's polygon", () => {
    const cells = buildZoneCollection().features;
    const labels = buildZoneLabels().features;

    for (const label of labels) {
      const cell = cells.find((c) => c.properties.code === label.properties.code);
      expect(cell, `polygon exists for ${label.properties.code}`).toBeDefined();
      expect(
        pointInPolygon(label.geometry.coordinates, cell!.geometry.coordinates[0]),
        `label ${label.properties.code} inside its own polygon`,
      ).toBe(true);
    }
  });

  it("the model assigns each label point to the zone it is labelled with", () => {
    for (const label of buildZoneLabels().features) {
      const [lon, lat] = label.geometry.coordinates;
      expect(zoneForPoint({ lat, lon })?.code).toBe(label.properties.code);
    }
  });

  it("a point past the outermost ring is in no cell", () => {
    const pt: [number, number] = destinationPoint(CENTRE, 60, 45);
    for (const cell of buildZoneCollection().features) {
      expect(pointInPolygon(pt, cell.geometry.coordinates[0])).toBe(false);
    }
  });
});

describe("buildZoneCollection", () => {
  it("emits one central cell plus SECTORS cells for every outer ring", () => {
    const fc = buildZoneCollection();
    expect(fc.features).toHaveLength(1 + (RINGS.length - 1) * SECTORS);
  });

  it("gives every cell a unique code", () => {
    const codes = buildZoneCollection().features.map((f) => f.properties.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("orders outermost first so the centre paints on top", () => {
    const rings = buildZoneCollection().features.map((f) => f.properties.ring);
    expect(rings[0]).toBe(RINGS.length);
    expect(rings[rings.length - 1]).toBe(1);
  });

  it("is valid GeoJSON throughout", () => {
    for (const f of buildZoneCollection().features) {
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

describe("buildZoneLabels", () => {
  it("emits exactly one label per cell", () => {
    expect(buildZoneLabels().features).toHaveLength(buildZoneCollection().features.length);
  });

  it("puts the central label at the centre", () => {
    const centre = buildZoneLabels().features.find((f) => f.properties.code === "01")!;
    expect(centre.geometry.coordinates[0]).toBeCloseTo(CENTRE.lon, 6);
    expect(centre.geometry.coordinates[1]).toBeCloseTo(CENTRE.lat, 6);
  });
});
