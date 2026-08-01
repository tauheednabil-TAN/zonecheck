# PROGRESS

Last updated: 2026-07-31 (second pass)

## Milestones

- [x] **M1 — Zone data.** Resolved by pivot, not as originally specified. `zone_id`
      does not exist in the Rejseplanen feed and OSM `fare_zone` turned out to be an
      unadopted proposal, so zone identity is **modelled**, not sourced. `scripts/build-zones.ts`
      builds `stops.json` (6,323 real stops) and `zones.geojson` (9 rings) and prints
      distinct zone count plus 5 real sample stops. Evidence in [DATA.md](DATA.md).
- [x] **M2 — Core question answered.** Geolocation → "Zone ring N" with the disclaimer
      on screen. Verified in the running app at 375px: Hellerup (55.7301, 12.5687)
      returns ring 2.
- [x] **M3 — Real map.** MapLibre + OpenFreeMap with a hand-written palette-exact style.
      Nine ring polygons overlaid, active ring highlighted, tap any point to inspect.
      Verified: canvas live, 9 features loaded largest-first, tiles HTTP 200.
      Point-in-polygon covered by 12 geometry tests.
- [x] **M4 — Journey mode.** Stop search over real GTFS names, dashed accent journey
      line, zones crossed, billable count, validity window. Verified: Nørreport (1) →
      Roskilde (8) gives 8 zones, 240 min. **Cross-check against real tariff values was
      NOT possible** — no ground truth available. See DATA.md.
- [ ] **M5 — Transit geometry.** Not built. Metro/S-tog/regional overlays from
      `shapes.txt` (115 MB in the feed).
- [~] **M6 — Polish and reach.** Done: English + Danish, `prefers-reduced-motion`,
      375px one-handed layout, denied/unavailable/outside-coverage states, dark-mode
      styles, tabular numerals. Not done: full screen-reader audit, focus-trap review.
- [~] **M7 — Stays correct unattended.** Done: `npm run data:refresh` re-derives and
      fails loudly on drift; "zone data as of" stamp visible in the footer. Not done:
      monthly GitHub Actions cron.
- [ ] **M8 — Release-ready.** qa / review / ship not yet run.

## Gates

| Gate | Status |
|------|--------|
| `npm run build` | passes |
| `npm test` | 63 passing (2 files) |
| `npm run lint` | no warnings or errors |
| M1: non-zero zone count + 5 real stops | 9 rings, 5 samples printed |
| M3+: 15+ hand-verified point-in-polygon coords | 17 landmarks, distances independently checked |
| Disclaimer on every zone-bearing screen | verified in running app, both languages |

## The honest caveat

Every gate above passes, but passing gates is not the same as being correct. The
zone numbers are modelled and unvalidated. See README.md and DATA.md.

## Log

**2026-07-30**

- Probed three GTFS URLs. `rejseplanen.dk/labs/GTFS.zip` and `labs.rejseplanen.dk`
  both 404. Live feed is `https://www.rejseplanen.info/labs/GTFS.zip`.
- Downloaded the feed (58.7 MB, `Last-Modified` 27 Jul 2026). Inspected `stops.txt`:
  11 columns, **no `zone_id`**, no fare files.
- Confirmed the only `zone` matches are stop *names* in Bornholm, Odense and West
  Zealand — wrong regions, unstructured.
- Verified the CC BY 4.0 licence is a portal claim; `attributions.txt` asserts none.

**2026-07-31**

- Ran the M1 pivot to completion. `boundary=fare_zone` over Sjælland: **0 elements**.
  `public_transport:zone`: **0**. The OSM `fare_zone` tag is a rejected proposal.
  Pivot exhausted — no real zone source exists.
- Decision (user's, after being shown the evidence twice): build anyway on the
  closest defensible approximation, with the limits stated everywhere.
- Built the concentric ring model, the GTFS pipeline, the map, journey mode,
  bilingual copy and 63 tests. All gates pass.
- Verified in the running app at 375×812: geolocation, journey, Danish toggle,
  out-of-coverage state, disclaimer presence.

## Second pass — 2026-07-31

Triggered by user feedback that the zone numbers were wrong and that common
places could not be looked up. Both complaints were correct.

- **Found the real data source.** Rejseplanen's `zoneFromCoordinate` API returns
  genuine DOT zone ids. Wired up behind `REJSEPLANEN_ACCESS_ID`; the app labels
  answers "Official" when it responds and "Estimated" when it falls back. Key is
  server-side only. Needs a free account to activate.
- **Fixed a real accuracy bug.** The old ring radii put the airport in ring 2, so
  Kobenhavn H to the airport reported 2 zones. The real ticket is 3 zones. Radii
  refitted to that anchor; a test now pins it.
- **Restructured zones from rings to cells.** Real DOT zones are discrete
  numbered areas, not bands. Now 65 cells (central disc + 8 sectors x 8 rings)
  with two-digit codes and drawn boundaries.
- **Zone numbers now render on the map**, one per cell, white-haloed.
- **Added place lookup without GPS** in "Find my zone" — the reported gap.
- **Restyled to match the official ticket screens**: large bold count, "Valid
  for: 1 hr, 30 min", bordered info box with a notched badge.
- Verified live: Kobenhavn H to Kobenhavns Lufthavn returns "3 zones / Valid
  for: 1 hr, 30 min", zones 01 to 24 to 34. Matches the reference screenshot.
- 75 tests pass. Build and lint clean.

## Next

1. Add a Rejseplanen key. That turns every estimate into a real zone and is
   worth more than any remaining milestone.
2. `npm run qa`, then `/review`, then `/ship` (M8).
2. M5 transit overlays.
3. Replace `src/lib/zone-model.ts` the moment real zone data can be sourced. That
   single swap is worth more than every remaining milestone combined.
