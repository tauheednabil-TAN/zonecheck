# MISSION — original build spec

Preserved verbatim in substance so a session picking this up cold has full
context. Note that **M1's premise has since been falsified** — see [DATA.md](DATA.md).

## Mission

Build "Zonecheck" — a free, public, mobile-first web app that instantly answers
two questions for anyone using public transport around Copenhagen: "which fare
zone am I standing in right now?" and "how many zones does my journey cross?" It
exists because the official answer today requires either hunting down a zone-map
image and squinting at it, or opening a ticket-buying app and risking an
accidental purchase. Zonecheck never sells anything and never asks anyone to log
in. Done means a public HTTPS URL where a person on a phone taps once, allows
location, and sees their zone number in under three seconds.

## Context

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. MapLibre GL JS for maps
  with OpenFreeMap vector tiles (no API key, no token). Turf.js for
  point-in-polygon. d3-delaunay for tessellation. Vitest for tests. Node scripts
  for the data pipeline.
- **Repo:** new repo at `./zonecheck`
- **Data source of record:** Rejseplanen GTFS feed (CC BY 4.0). Zone identity comes
  from `zone_id` in `stops.txt`. Zone polygons are DERIVED, not official — see M1.
  → **This assumption is false. See [DATA.md](DATA.md).**
- **Constraints:** no `gh` CLI and no `vercel` CLI on this machine — never attempt a
  push, PR, or deploy; prepare the commit and stop. Browser geolocation requires
  HTTPS or localhost.
- **Legal/safety constraint (non-negotiable):** a wrong zone answer can cost a real
  person a ~750 DKK fine. Every screen that states a zone must also state, visibly
  and without needing a tap, that the result is derived from open data, is not an
  official DOT source, and must not be relied on as proof of valid travel. Do not
  use DOT, Rejsekort, Rejsebillet, or DSB logos, names-as-branding, or copied
  assets. The colour palette below is inspiration, not a clone of anyone's identity.
- **Non-goals:** NO ticket purchasing. NO payments. NO user accounts. NO
  trip-time/departure-board features. NO native app. NO backend database — the
  zone data is a static build artifact.

## Palette

Match exactly. Taken from a Danish transit-app reference.

| Token | Hex | Use |
|-------|-----|-----|
| `--green-900` | `#0F4429` | primary, buttons, zone pills, active states |
| `--green-700` | `#1B6B3A` | secondary green, borders on active elements |
| `--map-land` | `#D4E5C1` | base landmass |
| `--map-green` | `#C3DDA9` | parks, forest, open space |
| `--map-urban` | `#E8EDE4` | built-up areas |
| `--map-water` | `#AAD3F0` | sea, lakes, harbour |
| `--map-road` | `#FFFFFF` | ordinary roads |
| `--map-hwy` | `#F5B93F` | motorways and primary routes |
| `--accent` | `#F5851F` | the user's own route / journey line (orange, dotted) |
| `--ink` | `#1A1A1A` | primary text |
| `--ink-muted` | `#6B7280` | secondary text |
| `--surface` | `#FFFFFF` | sheets and cards |

Zone pills are a filled `--green-900` circle with white numerals. The map is muted
and low-contrast so that the route and the zone overlay are the only saturated
things on screen.

## Skills bound to phases

Invoke via the Skill tool, by name. Do not substitute without saying why.

| Skill | When |
|-------|------|
| `spec` | once before M1, to produce SPEC.md pinning the zone-derivation approach |
| `apple-design` | M3 — map + bottom-sheet interaction model (detents, drag, momentum, interruptible transitions, reduced-motion) |
| `browse` | M2 onward — load the running app and screenshot it; judge the palette on actual pixels, never on CSS as written |
| `investigate` | whenever a gate fails twice on the same cause |
| `emil-design-eng` | M6 — component-polish pass |
| `qa` | M8 — find and fix bugs in the running app |
| `review` | M8 — review the full diff before it is called done |
| `ship` | M8 — run tests, bump VERSION, write CHANGELOG, commit. STOP before push. |

## Loop

Repeat until every milestone is checked off:

1. Pick the lowest-numbered unchecked milestone.
2. Run the skill bound to that phase.
3. Implement the smallest change that completes the milestone.
4. Run the gate for that milestone. If it fails, fix before moving on.
5. Check the milestone off in PROGRESS.md with one line on what changed.
6. Stop and ask the user only if a gate fails twice on the same cause.

## Milestones

**M1 — Zone data is proven to exist.** Write `scripts/build-zones.ts`: download the
Rejseplanen GTFS zip, parse `stops.txt`, and report how many distinct `zone_id`
values exist and how many stops carry one. Commit the derived stop→zone table as
`data/stops-zones.json`. Write DATA.md recording the feed URL, licence, retrieval
date, and field mapping.
*PIVOT RULE: if `zone_id` is absent or empty for Sjælland stops, do not fake it —
try OSM `fare_zone` via Overpass, and if that also fails, stop and report to the
user with the evidence. Everything downstream depends on this being real.*

**M2 — The core question is answered, ugly but true.** One page: press a button,
grant geolocation, see "You are in zone N" derived from nearest zoned stop, with
the derived-data disclaimer on screen. No map yet.

**M3 — Real map.** Derive zone polygons (Voronoi over zoned stops, dissolved per
zone, clipped to the Danish coastline), render them as a MapLibre layer over an
OpenFreeMap style restyled to the palette above. Show the user's position,
highlight their zone, allow tapping any zone to inspect it. Bottom sheet per the
apple-design interaction model.

**M4 — Journey mode.** Pick origin and destination (search by stop name, or tap the
map), draw the connection in `--accent`, and state the zones crossed, the zone
count, and the resulting validity window. Cross-check at least 10 known journeys
against the Rejseplanen tariff API if a key is present in `.env.local`; if absent,
cross-check against values the user supplies and record the accuracy in DATA.md.

**M5 — Transit geometry.** Overlay metro, S-tog, and regional rail lines and
stations from GTFS `shapes.txt`, in their real line colours, toggleable, legible at
every zoom.

**M6 — Polish and reach.** Component pass; dark mode; `prefers-reduced-motion`
honoured; keyboard and screen-reader paths work; usable one-handed on a 375px
viewport; graceful states for denied geolocation, no signal, and being outside the
covered area; English and Danish copy.

**M7 — It stays correct without anyone watching.** `npm run data:refresh` re-derives
zone data, diffs it against the committed version, and fails loudly on unexpected
drift. Add a GitHub Actions workflow on a monthly cron that opens a PR when the
feed changes, plus a visible "zone data as of &lt;date&gt;" stamp in the app footer.

**M8 — Release-ready.** qa, then review, then ship. README explains the derivation
method and its known inaccuracy honestly.

## Gates

Must pass before a milestone is checked.

- Typecheck and build succeed: `npm run build`
- Tests pass: `npm test`
- Lint passes: `npm run lint`
- **M1 additionally:** the script prints a non-zero count of distinct zones and 5
  real sample stops
- **M2 onward:** verified in the running app via the browse skill, with a
  screenshot. A milestone is never checked off on the strength of code that was
  only read, never executed.
- **M3 onward:** point-in-polygon has unit tests using at least 15 hand-verified
  coordinates spread across central Copenhagen, the suburbs, and a zone boundary
- No milestone is checked off while the derived-data disclaimer is missing from any
  screen that displays a zone number.

## Done when

`npm run build` is clean, all tests pass, and a phone-sized browser at the local
URL can: grant location and see the correct zone within 3 seconds; pan a
palette-correct map with zone overlays; select two points and get a correct zone
count; and see when the zone data was last refreshed.
