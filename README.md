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

### Get real zones with a free key

Rejseplanen exposes a `zoneFromCoordinate` API — the same tariff engine behind
the official journey planner, returning genuine DOT zone ids. The app already
speaks it.

1. Create a free account at https://labs.rejseplanen.dk/ and request an
   `accessId` for API 2.0.
2. `cp .env.local.example .env.local` and paste the key in.
3. Restart. Answers now read **"Official zone · Rejseplanen"** instead of
   **"Estimated · not official"**.

The key is read server-side only and never reaches the browser
([`src/app/api/zone/route.ts`](src/app/api/zone/route.ts)). Without it the app
falls back to the model below and says so on every answer.

### What the model does (the fallback)

Real DOT zones are ~211 discrete numbered cells, not rings. Observed structure:
zone 01 is central Copenhagen, and other zones carry two-digit codes whose tens
digit grows with distance and whose units digit varies with compass direction
(4x lies west of 3x, which lies west of 1x).

Zonecheck reproduces that ring-and-sector structure: a central disc plus eight
sectors per ring, 65 cells in all, each drawn with a boundary and labelled with
its number on the map. Geometry lives in
[`src/lib/zone-model.ts`](src/lib/zone-model.ts).

**Calibration.** Ring radii are fitted to the one hard public anchor available:
central Copenhagen to the airport is a 3-zone ticket, valid 1 hr 30 min. The app
reproduces exactly that. An earlier version used wider rings, returned 2 zones,
and was wrong on the commonest journey in the city — there is a test pinning
this so it cannot silently regress.

**Known limits, stated plainly:**

- Real boundaries follow municipal borders and coastline. These are circles.
  Expect errors near any boundary, growing with distance from the centre.
- Codes like `32` are **structurally plausible but are not the real DOT numbers.**
  Do not read "32" here as DOT zone 32. Only the API path returns real ids.
- Beyond the airport anchor it is **not validated against ground truth**. One
  anchor cannot validate 65 cells. The honest accuracy figure is *unknown*.
- Points beyond ring 9 return "outside the covered area" rather than being
  clamped to 9. A clamped answer would be a confident lie.

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

For real zone numbers rather than estimates, add a Rejseplanen key first — see
"Get real zones with a free key" above.

`data:build` caches the GTFS download in `.gtfs-cache/` (gitignored, ~59 MB), so
only the first run is slow.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (typecheck included) |
| `npm test` | 75 unit tests |
| `npm run lint` | ESLint |
| `npm run data:build` | Rebuild `stops.json`, `zones.geojson`, `zone-labels.geojson` |
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
| `src/app/api/zone/route.ts` | Real zones via Rejseplanen, model fallback |
| `src/lib/zone-geometry.ts` | Zone cells + number labels as GeoJSON |
| `src/lib/map-style.ts` | Palette-exact MapLibre style |
| `scripts/build-zones.ts` | GTFS → static data artifacts |
| `tests/` | 75 tests, incl. 17 hand-verified coordinates |

## Status

Working: zone-from-location, look up any stop by name without GPS, a
palette-correct map with numbered zone cells and drawn boundaries, tap-to-inspect,
journey mode with zones crossed / zone count / validity window, optional real
zones via the Rejseplanen API, English and Danish, reduced-motion,
out-of-coverage and permission-denied states, data-freshness stamp.

Not built: transit line overlays (metro/S-tog/regional from `shapes.txt`), the
monthly GitHub Actions refresh cron, and a full screen-reader audit.

## Legal

Stop data from Rejseplanen, retrieved 30 July 2026. Licence stated as CC BY 4.0
by the Rejseplanen Labs portal; the feed itself asserts no licence. Confirm terms
before redistributing derived data.

Map tiles © OpenFreeMap, data © OpenStreetMap contributors (ODbL).

Not affiliated with DOT, Rejsekort, Rejsebillet, or DSB. No logos, branding, or
assets of theirs are used.
