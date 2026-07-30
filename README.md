# Zonecheck

A free, public, mobile-first web app that answers two questions for anyone using
public transport around Copenhagen:

1. Which fare zone am I standing in right now?
2. How many zones does my journey cross?

It never sells anything and never asks anyone to log in.

## Status: BLOCKED at M1 — do not start building yet

**No application code exists yet.** This repo currently holds the M1 data
investigation and its result. Read [DATA.md](DATA.md) before writing any code.

The short version: **the data source the project was designed around does not
contain the field the project depends on.**

The build plan assumed Copenhagen fare-zone identity could be read from `zone_id`
in `stops.txt` of the Rejseplanen GTFS feed. It was checked against the live feed
on 30 July 2026. `zone_id` is not in the file. Neither is `fare_attributes.txt`
nor `fare_rules.txt`. All 8,531 Greater Copenhagen stops in the feed carry no
fare-zone information of any kind.

This is not a bug to work around. Without real zone data the app cannot honestly
answer its own core question, and a wrong answer costs a real person a ~750 DKK
fine. **Do not synthesise, guess, or interpolate zone numbers to unblock the
build.**

## The open decision

The M1 pivot rule says: if `zone_id` is absent, try OSM `fare_zone` via Overpass;
if that also fails, stop and report.

- `zone_id` absent — **settled, will not change.**
- OSM `fare_zone` — **untested.** The Overpass query was started but the public
  instance returned a "server too busy" runtime error and the mirror retry was
  interrupted. There is currently no evidence either way.

Three ways forward, in the order I'd try them:

1. **Finish the Overpass check.** Cheap, and it decides whether M1 pivots cleanly
   or is genuinely blocked. Do this first. See "Next action" below.
2. **Rejseplanen Labs REST API.** May expose tariff/zone data behind a free key.
   Would also make the M4 accuracy cross-check real instead of manual. Requires
   creating an account at https://labs.rejseplanen.dk/.
3. **Shelve the project.** Legitimate outcome if 1 and 2 both come up empty. The
   honest failure mode is not shipping, not shipping something that fines people.

## Next action

Run the Overpass probe that was interrupted. Candidate tag schemes to test, since
Danish fare-zone tagging in OSM is not standardised:

```bash
# boundary=fare_zone over Sjaelland
curl -sS --max-time 120 -X POST \
  -d '[out:json][timeout:90];(relation["boundary"="fare_zone"](54.4,10.8,56.4,12.9);way["boundary"="fare_zone"](54.4,10.8,56.4,12.9););out tags 40;' \
  https://overpass-api.de/api/interpreter
```

If the main instance is busy, mirrors: `https://overpass.kumi.systems/api/interpreter`,
`https://overpass.private.coffee/api/interpreter`.

Also worth testing before concluding OSM has nothing: keys `fare_zone`,
`public_transport:zone`, `zone:DOT`, `network=DOT` + `ref`.

Judge the result on coverage, not existence. A handful of hand-mapped zone
relations is not the same as complete, current coverage of the DOT zone system,
and partial coverage is arguably worse than none because it fails silently in the
places nobody mapped.

## Ground rules that survive any pivot

These are non-negotiable regardless of where zone data ends up coming from.

- Every screen that states a zone must also state, visibly and without needing a
  tap, that the result is derived from open data, is not an official DOT source,
  and must not be relied on as proof of valid travel.
- No DOT, Rejsekort, Rejsebillet, or DSB logos, names-as-branding, or copied
  assets. The palette in [MISSION.md](MISSION.md) is inspiration, not a clone of
  anyone's identity.
- No ticket purchasing. No payments. No accounts. No departure boards
  (Rejseplanen already does that well). No native app. No backend database — zone
  data is a static build artifact.

## Intended stack

Next.js (App Router) + TypeScript + Tailwind. MapLibre GL JS with OpenFreeMap
vector tiles (no API key). Turf.js for point-in-polygon. d3-delaunay for
tessellation. Vitest. Node scripts for the data pipeline.

Nothing above is installed yet. There is no `package.json`.

## Files here

| File | What it is |
|------|------------|
| [MISSION.md](MISSION.md) | The full original build spec: palette, milestones, gates |
| [DATA.md](DATA.md) | M1 findings and the evidence behind them |
| [PROGRESS.md](PROGRESS.md) | Milestone checklist and current state |
| `evidence/` | Raw proof artifacts from the feed inspection |
