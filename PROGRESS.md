# PROGRESS

Last updated: 2026-07-30

## Milestones

- [ ] **M1 — Zone data is proven to exist.** **BLOCKED — premise falsified.**
      The Rejseplanen GTFS feed contains no `zone_id` and no fare files. All 8,531
      Greater Copenhagen stops carry zero fare-zone information. Pivot to OSM
      `fare_zone` via Overpass is started but **untested** — the public instance
      returned "server too busy" and the mirror retry was interrupted. Evidence in
      [DATA.md](DATA.md). Nothing downstream can start until this resolves.
- [ ] M2 — The core question is answered, ugly but true
- [ ] M3 — Real map
- [ ] M4 — Journey mode
- [ ] M5 — Transit geometry
- [ ] M6 — Polish and reach
- [ ] M7 — It stays correct without anyone watching
- [ ] M8 — Release-ready

## What exists in this repo

Documentation only. **No application code, no `package.json`, no dependencies
installed, no Next.js scaffold.** Deliberately so — the build was stopped at the
M1 gate rather than scaffolding an app around data that does not exist.

## Log

**2026-07-30**

- Probed three candidate GTFS URLs. `rejseplanen.dk/labs/GTFS.zip` and
  `labs.rejseplanen.dk/GTFS.zip` both 404. Live feed is
  `https://www.rejseplanen.info/labs/GTFS.zip` — different host than the one in
  the build plan.
- Downloaded the feed: 58.7 MB, `Last-Modified` 27 Jul 2026, no auth required.
- Inspected `stops.txt`. **11 columns, none of them `zone_id`.** No
  `fare_attributes.txt` or `fare_rules.txt` in the archive either.
- Confirmed the only `zone` substring matches are stop *names* in Bornholm, Odense,
  and West Zealand — wrong regions, unstructured, unusable.
- Verified the licence claim is not asserted inside the feed. `attributions.txt`
  names Rejseplanen as producer and states no licence. CC BY 4.0 is a portal claim,
  recorded as such.
- Started the M1 pivot to OSM Overpass. Main instance returned a runtime "server
  too busy" error; mirror retry interrupted before returning. **Unresolved.**
- Wrote [DATA.md](DATA.md), [README.md](README.md), [MISSION.md](MISSION.md).
- Skills run: `spec` (invoked; its GitHub-issue path is unavailable on this machine
  since `gh` is not installed, so the output artifact is documentation in this repo
  rather than a filed issue). `apple-design`, `browse`, `emil-design-eng`, `qa`,
  `review`, `ship` not yet reached — all are bound to M2+.

## Next action

Finish the interrupted Overpass probe. Exact commands and the tag schemes worth
testing are in [README.md](README.md) under "Next action". Judge the result on
**coverage**, not mere existence — partial zone mapping fails silently in exactly
the places nobody bothered to map, which is worse than having none.
