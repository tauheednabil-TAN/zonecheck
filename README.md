# Zonecheck

A free, mobile-first web app that answers two questions for anyone using public
transport around Copenhagen:

1. Which fare zone am I standing in right now?
2. How many zones does my journey cross?

No tickets. No payments. No accounts. No tracking.

## Read this before you trust a number it gives you

**The zone numbers are estimates, not official.** Copenhagen's real DOT fare
zones are not published as open geodata anywhere. Zonecheck therefore models
them, and a model is sometimes wrong.

A wrong zone can cost you a ~750 DKK fine. Use this to orient yourself, not as
proof of valid travel. Always buy the ticket your operator requires.

The app states this on every screen that shows a zone. That is deliberate and
must not be removed.

## What is real and what is modelled

Being precise about this matters more than the app looking finished.

| Part | Status |
|------|--------|
| Stop names and coordinates | **Real.** 6,323 stops from the Rejseplanen GTFS feed. |
| Distance maths | **Real.** Haversine, verified against known distances. |
| 2-zone minimum fare | **Real.** Published DOT rule. |
| Ticket validity (60 min + 30/zone) | **Real.** Published DOT rule. |
| **Which zone a point is in** | **MODELLED. This is the weak link.** |
| **How many zones a journey crosses** | **MODELLED**, since it derives from the above. |

### Why the zones are modelled

The build originally assumed zone identity could be read from `zone_id` in the
Rejseplanen GTFS feed. Checked against the live feed on 30 July 2026, that field
does not exist, and neither do `fare_attributes.txt` or `fare_rules.txt`. All
8,531 Greater Copenhagen stops carry no fare-zone data of any kind.

The fallback, OpenStreetMap's `fare_zone`, turned out to be a *proposed* tag that
was never adopted. A probe of the whole Copenhagen bounding box returned nothing
usable. No municipal or national open-data portal publishes the polygons either.

Full evidence in [DATA.md](DATA.md).

### What the model does

The real DOT system is genuinely concentric: nine coloured zone rings radiating
from central Copenhagen, zone 1 at the centre, fare set by how many you cross.
Zonecheck reproduces that ring structure as geodesic annuli centred on
Rådhuspladsen. Ring radii live in one array in
[`src/lib/zone-model.ts`](src/lib/zone-model.ts).

**Known limits, stated plainly:**

- Real boundaries follow municipal borders and coastline. These are circles.
  Expect errors near any boundary, growing with distance from the centre.
- It produces a **ring number (1–9), not one of the 97 real DOT zone numbers.**
- It has **never been validated against ground truth**, because no ground truth
  is available to validate against. The honest accuracy figure is *unknown*.
- Points beyond ring 9 return "outside the covered area" rather than being
  clamped to 9. A clamped answer would be a confident lie.

### Replacing the model with real data

Everything downstream consumes `ringForPoint()` and `RINGS`. Swap that one file
for real polygons and nothing else changes. The build script already asserts on
every run whether `zone_id` has appeared in the feed, and says so loudly if it
ever does.

Most likely real source: the Rejseplanen Labs REST API (free account at
https://labs.rejseplanen.dk/), which may expose tariff data.

## Running it

```bash
npm install
```

```bash
npm run data:build
```

```bash
npm run dev
```

Then open http://localhost:3000. Geolocation needs HTTPS or localhost.

`data:build` caches the GTFS download in `.gtfs-cache/` (gitignored, ~59 MB), so
only the first run is slow.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (typecheck included) |
| `npm test` | 63 unit tests |
| `npm run lint` | ESLint |
| `npm run data:build` | Rebuild `stops.json` + `zones.geojson` from the feed |
| `npm run data:refresh` | Rebuild and fail loudly if the output drifted |

## How it is built

Next.js 14 (App Router) + TypeScript + Tailwind. MapLibre GL JS over OpenFreeMap
vector tiles — no API key, no token. Vitest. No backend and no database: the zone
data is a static build artifact.

The map style is hand-written in [`src/lib/map-style.ts`](src/lib/map-style.ts)
rather than recolored from a stock style, so the palette is exact.

| File | Role |
|------|------|
| `src/lib/zone-model.ts` | The approximation. Swap this to fix accuracy. |
| `src/lib/zone-geometry.ts` | Ring polygons as GeoJSON |
| `src/lib/map-style.ts` | Palette-exact MapLibre style |
| `scripts/build-zones.ts` | GTFS → static data artifacts |
| `tests/` | 63 tests, incl. 17 hand-verified coordinates |

## Status

Working: zone-from-location, palette-correct map with zone overlay and
tap-to-inspect, journey mode with zone count and validity window, English and
Danish, reduced-motion, out-of-coverage and permission-denied states, data-freshness
stamp.

Not built: transit line overlays (metro/S-tog/regional from `shapes.txt`), the
monthly GitHub Actions refresh cron, and a full screen-reader audit.

## Legal

Stop data from Rejseplanen, retrieved 30 July 2026. Licence stated as CC BY 4.0
by the Rejseplanen Labs portal; the feed itself asserts no licence. Confirm terms
before redistributing derived data.

Map tiles © OpenFreeMap, data © OpenStreetMap contributors (ODbL).

Not affiliated with DOT, Rejsekort, Rejsebillet, or DSB. No logos, branding, or
assets of theirs are used.
