import { describe, it, expect } from "vitest";
import {
  CENTRE,
  RINGS,
  MAX_RING,
  distanceKm,
  ringForPoint,
  ringsCrossed,
  billableZoneCount,
  validityMinutes,
} from "../src/lib/zone-model";

/**
 * Coordinates are real Copenhagen landmarks. The distance column was checked
 * against independently known straight-line distances before these expectations
 * were written (Roskilde ~30 km, Helsingor ~39 km, Odense ~139 km), which is
 * what makes them hand-verified rather than snapshots of whatever the code
 * happened to output.
 *
 * NOTE: `ring` here is the ring the MODEL assigns, not the official DOT zone.
 * These tests pin the model's behaviour; they do not prove it matches reality.
 * See DATA.md for why no ground truth is available to test against.
 */
const LANDMARKS: { name: string; lat: number; lon: number; km: number; ring: number | null }[] = [
  // Central Copenhagen — all ring 1.
  { name: "Radhuspladsen", lat: 55.6759, lon: 12.5655, km: 0.0, ring: 1 },
  { name: "Kobenhavn H", lat: 55.6727, lon: 12.5645, km: 0.36, ring: 1 },
  { name: "Norreport St", lat: 55.6832, lon: 12.5714, km: 0.89, ring: 1 },
  { name: "Christiania", lat: 55.6736, lon: 12.5983, km: 2.07, ring: 1 },
  { name: "Frederiksberg Have", lat: 55.6725, lon: 12.5262, km: 2.49, ring: 1 },
  { name: "Bella Center", lat: 55.6386, lon: 12.5789, km: 4.23, ring: 1 },

  // Inner suburbs.
  { name: "Hellerup St", lat: 55.7301, lon: 12.5687, km: 6.03, ring: 2 },
  { name: "CPH Airport Kastrup", lat: 55.618, lon: 12.6508, km: 8.37, ring: 2 },
  { name: "Lyngby St", lat: 55.7704, lon: 12.5033, km: 11.21, ring: 3 },
  { name: "Ballerup St", lat: 55.7314, lon: 12.3626, km: 14.13, ring: 4 },
  { name: "Hoje Taastrup St", lat: 55.6486, lon: 12.2679, km: 18.91, ring: 5 },

  // Outer edge of coverage.
  { name: "Roskilde St", lat: 55.6415, lon: 12.0876, km: 30.22, ring: 8 },
  { name: "Hillerod St", lat: 55.9297, lon: 12.3096, km: 32.44, ring: 8 },
  { name: "Koge St", lat: 55.458, lon: 12.183, km: 34.14, ring: 9 },
  { name: "Helsingor St", lat: 56.0294, lon: 12.6136, km: 39.42, ring: 9 },

  // Beyond coverage — must be null, never clamped to 9.
  { name: "Kalundborg", lat: 55.6794, lon: 11.0896, km: 92.53, ring: null },
  { name: "Odense", lat: 55.4038, lon: 10.4024, km: 139.41, ring: null },
];

describe("distanceKm", () => {
  it("is zero at the centre", () => {
    expect(distanceKm(CENTRE, CENTRE)).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const a = { lat: 55.7301, lon: 12.5687 };
    expect(distanceKm(CENTRE, a)).toBeCloseTo(distanceKm(a, CENTRE), 9);
  });

  it.each(LANDMARKS)("$name is ~$km km from the centre", ({ lat, lon, km }) => {
    expect(distanceKm(CENTRE, { lat, lon })).toBeCloseTo(km, 1);
  });
});

describe("ringForPoint — 17 hand-verified coordinates", () => {
  it.each(LANDMARKS)("$name -> ring $ring", ({ lat, lon, ring }) => {
    expect(ringForPoint({ lat, lon })).toBe(ring);
  });

  it("never clamps a far-away point into the outermost ring", () => {
    // Berlin. Must be null, not 9 — a clamped answer would be a confident lie.
    expect(ringForPoint({ lat: 52.52, lon: 13.405 })).toBeNull();
  });
});

describe("ring boundaries", () => {
  it("treats the outer radius as inside the ring, not outside", () => {
    // Exactly 5 km due north of centre is ring 1's outer edge.
    const outer = RINGS[0].outerKm;
    const latPerKm = 1 / 111.195;
    const onEdge = { lat: CENTRE.lat + outer * latPerKm * 0.9999, lon: CENTRE.lon };
    expect(ringForPoint(onEdge)).toBe(1);
  });

  it("steps to the next ring just past the boundary", () => {
    const outer = RINGS[0].outerKm;
    const latPerKm = 1 / 111.195;
    const justPast = { lat: CENTRE.lat + outer * latPerKm * 1.001, lon: CENTRE.lon };
    expect(ringForPoint(justPast)).toBe(2);
  });

  it("rings are contiguous with no gaps or overlaps", () => {
    for (let i = 1; i < RINGS.length; i++) {
      expect(RINGS[i].innerKm).toBe(RINGS[i - 1].outerKm);
    }
    expect(RINGS[0].innerKm).toBe(0);
    expect(RINGS).toHaveLength(MAX_RING);
  });

  it("assigns every ring 1..MAX_RING to some point going outward", () => {
    const latPerKm = 1 / 111.195;
    const seen = new Set<number | null>();
    for (const r of RINGS) {
      const mid = (r.innerKm + r.outerKm) / 2;
      seen.add(ringForPoint({ lat: CENTRE.lat + mid * latPerKm, lon: CENTRE.lon }));
    }
    expect([...seen].sort((a, b) => (a as number) - (b as number))).toEqual(
      RINGS.map((r) => r.ring),
    );
  });
});

describe("ringsCrossed", () => {
  it("returns the inclusive span outward", () => {
    expect(ringsCrossed(2, 5)).toEqual([2, 3, 4, 5]);
  });

  it("is direction-independent", () => {
    expect(ringsCrossed(5, 2)).toEqual(ringsCrossed(2, 5));
  });

  it("returns a single ring for a journey inside one ring", () => {
    expect(ringsCrossed(3, 3)).toEqual([3]);
  });
});

describe("billableZoneCount", () => {
  it("enforces DOT's 2-zone minimum for a same-ring journey", () => {
    expect(billableZoneCount(1)).toBe(2);
  });

  it("passes larger spans through unchanged", () => {
    expect(billableZoneCount(2)).toBe(2);
    expect(billableZoneCount(4)).toBe(4);
  });
});

describe("validityMinutes", () => {
  it("gives 60 minutes for the 2-zone minimum", () => {
    expect(validityMinutes(2)).toBe(60);
  });

  it("adds 30 minutes per extra zone", () => {
    expect(validityMinutes(3)).toBe(90);
    expect(validityMinutes(4)).toBe(120);
    expect(validityMinutes(9)).toBe(270);
  });

  it("never drops below the 2-zone floor", () => {
    expect(validityMinutes(1)).toBe(60);
    expect(validityMinutes(0)).toBe(60);
  });
});

describe("end-to-end journey", () => {
  it("central Copenhagen to the airport", () => {
    const from = ringForPoint({ lat: 55.6759, lon: 12.5655 })!;
    const to = ringForPoint({ lat: 55.618, lon: 12.6508 })!;
    const rings = ringsCrossed(from, to);
    const count = billableZoneCount(rings.length);

    expect(rings).toEqual([1, 2]);
    expect(count).toBe(2);
    expect(validityMinutes(count)).toBe(60);
  });

  it("a trip within central Copenhagen still bills 2 zones", () => {
    const from = ringForPoint({ lat: 55.6727, lon: 12.5645 })!;
    const to = ringForPoint({ lat: 55.6832, lon: 12.5714 })!;
    const count = billableZoneCount(ringsCrossed(from, to).length);

    expect(count).toBe(2);
    expect(validityMinutes(count)).toBe(60);
  });
});
