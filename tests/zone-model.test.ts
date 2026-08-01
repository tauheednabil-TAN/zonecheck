import { describe, it, expect } from "vitest";
import {
  CENTRE,
  RINGS,
  SECTORS,
  MAX_RING,
  distanceKm,
  bearingDeg,
  ringForPoint,
  zoneForPoint,
  zoneCode,
  zonesCrossed,
  billableZoneCount,
  validityMinutes,
} from "../src/lib/zone-model";

/**
 * Coordinates are real Copenhagen landmarks. Distances were checked against
 * independently known straight-line figures (Roskilde ~30 km, Helsingor ~39 km,
 * Odense ~139 km) before these expectations were written.
 *
 * `ring` is what the MODEL assigns, not an official DOT zone. These tests pin
 * the model's behaviour; they do not prove it matches reality. See DATA.md.
 */
const LANDMARKS: { name: string; lat: number; lon: number; km: number; ring: number | null }[] = [
  { name: "Radhuspladsen", lat: 55.6759, lon: 12.5655, km: 0.0, ring: 1 },
  { name: "Kobenhavn H", lat: 55.6727, lon: 12.5645, km: 0.36, ring: 1 },
  { name: "Norreport St", lat: 55.6832, lon: 12.5714, km: 0.89, ring: 1 },
  { name: "Christiania", lat: 55.6736, lon: 12.5983, km: 2.07, ring: 1 },
  { name: "Frederiksberg Have", lat: 55.6725, lon: 12.5262, km: 2.49, ring: 1 },
  { name: "Bella Center", lat: 55.6386, lon: 12.5789, km: 4.23, ring: 2 },
  { name: "Hellerup St", lat: 55.7301, lon: 12.5687, km: 6.03, ring: 2 },
  { name: "CPH Airport Kastrup", lat: 55.618, lon: 12.6508, km: 8.37, ring: 3 },
  { name: "Lyngby St", lat: 55.7704, lon: 12.5033, km: 11.21, ring: 4 },
  { name: "Ballerup St", lat: 55.7314, lon: 12.3626, km: 14.13, ring: 5 },
  { name: "Hoje Taastrup St", lat: 55.6486, lon: 12.2679, km: 18.91, ring: 6 },
  { name: "Roskilde St", lat: 55.6415, lon: 12.0876, km: 30.22, ring: 8 },
  { name: "Hillerod St", lat: 55.9297, lon: 12.3096, km: 32.44, ring: 8 },
  { name: "Koge St", lat: 55.458, lon: 12.183, km: 34.14, ring: 9 },
  { name: "Helsingor St", lat: 56.0294, lon: 12.6136, km: 39.42, ring: 9 },
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

describe("bearingDeg", () => {
  it("reads 0 due north and 180 due south", () => {
    expect(bearingDeg(CENTRE, { lat: CENTRE.lat + 0.5, lon: CENTRE.lon })).toBeCloseTo(0, 1);
    expect(bearingDeg(CENTRE, { lat: CENTRE.lat - 0.5, lon: CENTRE.lon })).toBeCloseTo(180, 1);
  });

  it("reads about 90 due east", () => {
    expect(bearingDeg(CENTRE, { lat: CENTRE.lat, lon: CENTRE.lon + 0.5 })).toBeCloseTo(90, 0);
  });

  it("always returns 0..360", () => {
    for (const { lat, lon } of LANDMARKS) {
      const b = bearingDeg(CENTRE, { lat, lon });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe("zoneForPoint", () => {
  it("makes the central disc a single undivided zone 01", () => {
    for (const p of LANDMARKS.filter((l) => l.ring === 1)) {
      const z = zoneForPoint({ lat: p.lat, lon: p.lon })!;
      expect(z.code).toBe("01");
      expect(z.sector).toBe(0);
    }
  });

  it("gives outer points a two-digit code whose tens digit is the ring", () => {
    for (const p of LANDMARKS.filter((l) => l.ring !== null && l.ring > 1)) {
      const z = zoneForPoint({ lat: p.lat, lon: p.lon })!;
      expect(z.ring).toBe(p.ring);
      expect(z.code).toHaveLength(2);
      expect(z.code[0]).toBe(String(p.ring));
      expect(z.sector).toBeGreaterThanOrEqual(1);
      expect(z.sector).toBeLessThanOrEqual(SECTORS);
    }
  });

  it("is null outside the covered area", () => {
    expect(zoneForPoint({ lat: 55.4038, lon: 10.4024 })).toBeNull();
  });

  it("changes zone as you move around the same ring", () => {
    const codes = new Set<string>();
    for (let b = 0; b < 360; b += 45) {
      const rad = (b * Math.PI) / 180;
      const km = 12; // inside ring 4
      const lat = CENTRE.lat + (km / 111.195) * Math.cos(rad);
      const lon =
        CENTRE.lon + (km / (111.195 * Math.cos((CENTRE.lat * Math.PI) / 180))) * Math.sin(rad);
      const z = zoneForPoint({ lat, lon });
      if (z) codes.add(z.code);
    }
    expect(codes.size).toBe(SECTORS);
  });
});

describe("zoneCode", () => {
  it("names the centre 01", () => {
    expect(zoneCode(1, 0)).toBe("01");
  });

  it("puts the ring in the tens and the sector in the units", () => {
    expect(zoneCode(3, 2)).toBe("32");
    expect(zoneCode(9, 8)).toBe("98");
  });
});

describe("zonesCrossed", () => {
  it("returns a single zone for a trip inside the central disc", () => {
    expect(zonesCrossed({ lat: 55.6727, lon: 12.5645 }, { lat: 55.6832, lon: 12.5714 })).toEqual([
      "01",
    ]);
  });

  it("returns zones in travel order starting at the origin", () => {
    const z = zonesCrossed({ lat: 55.6727, lon: 12.5645 }, { lat: 55.6415, lon: 12.0876 });
    expect(z[0]).toBe("01");
    expect(new Set(z).size).toBe(z.length);
  });

  it("counts a zone that the path only clips", () => {
    // Sampling the path means a tangential leg still picks up the zone it
    // passes through, which is how DOT actually prices.
    const z = zonesCrossed({ lat: 55.618, lon: 12.6508 }, { lat: 55.7301, lon: 12.5687 });
    expect(z.length).toBeGreaterThan(1);
  });
});

describe("billableZoneCount", () => {
  it("enforces DOT's 2-zone minimum", () => {
    expect(billableZoneCount(1)).toBe(2);
  });

  it("passes larger spans through unchanged", () => {
    expect(billableZoneCount(3)).toBe(3);
    expect(billableZoneCount(8)).toBe(8);
  });
});

describe("validityMinutes", () => {
  it("gives 60 minutes for the 2-zone minimum", () => {
    expect(validityMinutes(2)).toBe(60);
  });

  it("adds 30 minutes per extra zone", () => {
    expect(validityMinutes(3)).toBe(90);
    expect(validityMinutes(8)).toBe(240);
  });

  it("never drops below the 2-zone floor", () => {
    expect(validityMinutes(1)).toBe(60);
    expect(validityMinutes(0)).toBe(60);
  });
});

describe("real-world anchors", () => {
  /**
   * THE CALIBRATION ANCHOR. Verified against a real DOT ticket screen showing
   * "3 zones / Valid for: 1 hr, 30 min". If this goes red, the radii in
   * zone-model.ts have drifted and the app is lying to people again.
   *
   * An earlier ring-only model returned 2 zones here, which was wrong on the
   * commonest journey in the city.
   */
  it("Kobenhavn H to the airport is 3 zones, valid 1 hr 30 min", () => {
    const zones = zonesCrossed({ lat: 55.6727, lon: 12.5645 }, { lat: 55.618, lon: 12.6508 });
    const count = billableZoneCount(zones.length);

    expect(count).toBe(3);
    expect(validityMinutes(count)).toBe(90);
  });

  it("a trip within central Copenhagen bills the 2-zone minimum, valid 1 hr", () => {
    const zones = zonesCrossed({ lat: 55.6727, lon: 12.5645 }, { lat: 55.6832, lon: 12.5714 });
    const count = billableZoneCount(zones.length);

    expect(count).toBe(2);
    expect(validityMinutes(count)).toBe(60);
  });
});

describe("ring structure", () => {
  it("rings are contiguous with no gaps or overlaps", () => {
    for (let i = 1; i < RINGS.length; i++) {
      expect(RINGS[i].innerKm).toBe(RINGS[i - 1].outerKm);
    }
    expect(RINGS[0].innerKm).toBe(0);
    expect(RINGS).toHaveLength(MAX_RING);
  });
});
