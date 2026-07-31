# DATA.md — zone data provenance and the M1 finding

## Headline

**The Rejseplanen GTFS feed does not contain fare-zone data.** The project's
core premise — that zone identity comes from `zone_id` in `stops.txt` — is
falsified against the live feed.

## Feed of record

| Field | Value |
|-------|-------|
| URL | `https://www.rejseplanen.info/labs/GTFS.zip` |
| Retrieved | 2026-07-30 |
| `Last-Modified` | Mon, 27 Jul 2026 10:29:27 GMT |
| Size | 58,762,403 bytes (58.7 MB) |
| `Content-Type` | `application/x-zip-compressed` |
| Auth required | None. Direct download, no account, no key. |
| Producer | Rejseplanen (`attributions.txt`, `is_producer=1`) |

### URL correction

The URL widely cited for this feed, `https://www.rejseplanen.dk/labs/GTFS.zip`,
is **dead — HTTP 404**. So is `https://labs.rejseplanen.dk/GTFS.zip`. The live
host is `rejseplanen.info`, not `rejseplanen.dk`. Anything in this repo or in
future code must use the `.info` host.

### Licence

Commonly stated as **CC BY 4.0** via the Rejseplanen Labs portal. Recorded here
as a **portal claim, not verified from the feed**: `attributions.txt` contains
only the producer row below and asserts no licence.

```
attribution_id,is_producer,organization_name,attribution_url
rp,1,Rejseplanen,https://www.rejseplanen.dk
```

Confirm the licence terms at https://labs.rejseplanen.dk/ before shipping
anything public that redistributes derived data.

## Archive contents

Eleven files. Note what is **not** there.

| File | Bytes |
|------|-------|
| agency.txt | 2,117 |
| attributions.txt | 105 |
| calendar.txt | 63,868 |
| calendar_dates.txt | 269,712 |
| frequencies.txt | 64 |
| routes.txt | 57,124 |
| shapes.txt | 115,312,417 |
| stops.txt | 3,577,822 |
| stop_times.txt | 258,506,581 |
| transfers.txt | 2,271,353 |
| trips.txt | 12,668,734 |

**Absent: `fare_attributes.txt`, `fare_rules.txt`, `fare_products.txt`,
`areas.txt`, `stop_areas.txt`.** The feed carries no fare information in any
GTFS-Fares form, v1 or v2.

## stops.txt field mapping

Full header, all 11 columns, verbatim:

```
"stop_id","stop_code","stop_name","stop_desc","stop_lat","stop_lon","location_type","parent_station","wheelchair_boarding","platform_code","stop_timezone"
```

| Expected by build plan | Present? |
|------------------------|----------|
| `stop_id` | yes |
| `stop_lat` / `stop_lon` | yes |
| `stop_name` | yes |
| **`zone_id`** | **NO** |

- Total rows: 36,387 (36,386 stops + header).
- Stops within the Greater Copenhagen bounding box (55.4–56.1 N, 11.6–12.7 E):
  **8,531**, none carrying zone information.
- Distinct `zone_id` values: **0**. The field does not exist.

M1's gate required "a non-zero count of distinct zones and 5 real sample stops."
**The gate cannot be met from this source.** Reporting it as met would require
inventing data.

## The one place "zone" does appear, and why it is not usable

A substring search for `zone` in `stops.txt` returns matches — but they are in
`stop_name` free text, not a structured field, and they describe the wrong
regions entirely.

Three groups, all of them dead ends for Copenhagen:

1. **Bornholm zone-boundary bus stops**, e.g.
   `"10/21 Zonegrænse (Hallebakken) (Bornholm)"`,
   `"30/40 Zonegrænse (Borrelyngsvej) (Bornholm)"`. These mark where a bus route
   crosses a boundary in Bornholm's own tariff system — a different island and a
   different fare scheme from DOT's Copenhagen zones.
2. **Two Odense stops literally named for zones**: `"Zone 58 (Odense Kommune)"`,
   `"Zone 01 (Odense Kommune)"`. Fyn, not Sjælland.
3. **Four West Zealand stops**: `"Ind zone 275 (Hammersgårdvej)"`,
   `"Ud zone 277 (Pasbjergvej)"`. Zone numbers in the 200s, outside the
   Copenhagen core, and only at two boundary crossings.

Nothing here covers the Copenhagen DOT zone system the app is about. Parsing zone
numbers out of stop names would produce a map with a few dozen scattered points
in the wrong parts of Denmark. That is not a data source.

## Pivot status — closed

Per the M1 pivot rule, run to completion 2026-07-31:

| Step | Status |
|------|--------|
| `zone_id` in Rejseplanen GTFS | **Failed — field absent.** |
| OSM `fare_zone` via Overpass | **Failed — nothing usable.** |
| Report to user with evidence | Done — this document. |

### Overpass results

Queried against `overpass-api.de`, Sjælland bounding box `(54.4, 10.8, 56.4, 12.9)`:

| Query | Elements returned |
|-------|-------------------|
| `relation/way["boundary"="fare_zone"]` | **0** |
| `node/way/relation["public_transport:zone"]` | **0** |

The reason is structural, not a mapping gap: OpenStreetMap's `fare_zone` is a
**proposed tag that was never adopted**. There is no established OSM scheme for
Danish fare zones, so no amount of further querying will find one.

No municipal or national open-data portal publishes the polygons either.

**Conclusion: no real Copenhagen fare-zone geodata is publicly available.**

## What was built instead

After being shown the above, the project owner chose to build on the closest
defensible approximation rather than shelve the app. That decision is recorded
here so it is not mistaken for an oversight.

The model is concentric rings centred on Rådhuspladsen — see
`src/lib/zone-model.ts`. It reproduces the real system's ring *structure*, which
is public knowledge, but not its real *boundaries*, which are not.

### Accuracy: unknown, and unvalidatable today

M4 called for cross-checking at least 10 known journeys against the Rejseplanen
tariff API. **This was not done, and could not be.**

- No API key is present in `.env.local`.
- More fundamentally, the same missing ground truth that forced the model also
  makes validating it impossible. Checking a model against itself proves nothing.

So the honest accuracy figure is **unknown**. Not "roughly right", not
"approximately 90%" — unknown. Anything else would be a number invented to look
reassuring.

**How to actually validate it**, when someone can:

1. Get a Rejseplanen Labs account and check whether the REST API exposes tariff
   zones per stop.
2. Failing that, hand-check 20–30 stops spread across all nine rings against
   DOT's published zone map, and record the hit rate in this file.
3. Weight the sample toward zone boundaries and toward the outer rings, where a
   circular model is most likely to disagree with a municipal border.

Until one of those happens, treat every zone number the app shows as an
orientation aid and nothing more.

### Known structural errors

These are certain, not hypothetical:

- **Circles vs borders.** Real zones follow municipal boundaries and coastline.
  Any point near a real boundary can fall in the wrong ring.
- **Ring number ≠ DOT zone number.** The app shows a ring 1–9. The real system
  has 97 numbered zones. These are different things and the UI says "zone ring"
  rather than "zone" for that reason.
- **Water is not excluded.** The rings are not clipped to the coastline, so a
  point in Øresund still returns a ring. Clipping is unfinished work.
- **Sweden is inside the rings.** Parts of Malmö fall within 40 km of
  Rådhuspladsen and will return a ring, despite not being in the DOT system at
  all. A coastline/border clip would fix this too.

## What must not happen next

The temptation, having found a 58 MB feed with 36,386 stops in it, is to derive
zones from something else in the feed — route patterns, distance rings from
Rådhuspladsen, clustering. **Do not.**

Copenhagen's DOT zones are an administrative fact with legally binding fare
consequences. They are not recoverable from stop geometry, and an approximation
that is right 90% of the time is a system that quietly hands out ~750 DKK fines
in the 10%. If real zone polygons cannot be sourced, the correct outcome is that
this app does not ship.
