/**
 * Builds the app's static data artifacts from the Rejseplanen GTFS feed.
 *
 *   public/data/stops.json     real stops, Greater Copenhagen, ring-tagged
 *   public/data/zones.geojson  ring polygons from the approximate model
 *
 * The stop coordinates and names are REAL open data. The ring assigned to each
 * stop is an APPROXIMATION — see src/lib/zone-model.ts for exactly how and why.
 *
 *   npm run data:build     rebuild artifacts
 *   npm run data:refresh   rebuild and fail loudly if the output drifted
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";
import { ringForPoint, MAX_RING } from "../src/lib/zone-model";
import { buildRingCollection } from "../src/lib/zone-geometry";
import type { Stop, StopsFile } from "../src/lib/types";

const FEED_URL = "https://www.rejseplanen.info/labs/GTFS.zip";
const CACHE_DIR = path.join(process.cwd(), ".gtfs-cache");
const OUT_DIR = path.join(process.cwd(), "public", "data");

/** Greater Copenhagen. Wide enough to cover every ring plus a margin. */
const BBOX = { minLat: 55.2, maxLat: 56.2, minLon: 11.4, maxLon: 12.8 };

const isDiffMode = process.argv.includes("--diff");

/** Minimal RFC4180-ish splitter. The feed quotes most fields but not all. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function getStopsText(): Promise<{ text: string; lastModified: string }> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachedStops = path.join(CACHE_DIR, "stops.txt");
  const metaPath = path.join(CACHE_DIR, "meta.json");

  if (fs.existsSync(cachedStops)) {
    const meta = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
      : { lastModified: "unknown" };
    console.log(`Using cached stops.txt (${cachedStops})`);
    return { text: fs.readFileSync(cachedStops, "utf8"), lastModified: meta.lastModified };
  }

  console.log(`Downloading ${FEED_URL} (~59 MB, this takes a minute)...`);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed download failed: HTTP ${res.status}`);

  const lastModified = res.headers.get("last-modified") ?? "unknown";
  const buf = Buffer.from(await res.arrayBuffer());

  const zip = new AdmZip(buf);
  const entry = zip.getEntry("stops.txt");
  if (!entry) throw new Error("stops.txt missing from the GTFS archive");

  const text = entry.getData().toString("utf8");
  fs.writeFileSync(cachedStops, text);
  fs.writeFileSync(metaPath, JSON.stringify({ lastModified, url: FEED_URL }, null, 2));

  return { text, lastModified };
}

async function main() {
  const { text, lastModified } = await getStopsText();

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/"/g, "").trim());

  const idx = {
    id: header.indexOf("stop_id"),
    name: header.indexOf("stop_name"),
    lat: header.indexOf("stop_lat"),
    lon: header.indexOf("stop_lon"),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error(`Unexpected stops.txt header: ${header.join(",")}`);
  }

  // The check that started this whole project. Kept as a live assertion so the
  // day Rejseplanen adds zone_id, the build tells us instead of us finding out
  // by accident.
  const hasZoneId = header.includes("zone_id");
  console.log(
    hasZoneId
      ? "*** zone_id IS PRESENT — real zone data is available, replace the model! ***"
      : "zone_id absent from feed (expected — app runs on the approximate ring model)",
  );

  const stops: Stop[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    const lat = parseFloat(f[idx.lat]?.replace(/"/g, ""));
    const lon = parseFloat(f[idx.lon]?.replace(/"/g, ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < BBOX.minLat || lat > BBOX.maxLat) continue;
    if (lon < BBOX.minLon || lon > BBOX.maxLon) continue;

    stops.push({
      id: f[idx.id].replace(/"/g, "").trim(),
      name: f[idx.name].replace(/"/g, "").trim(),
      lat,
      lon,
      ring: ringForPoint({ lat, lon }),
    });
  }

  // Deduplicate: the feed lists a separate stop per platform, which would make
  // stop search a wall of near-identical names.
  const seen = new Map<string, Stop>();
  for (const s of stops) {
    const key = `${s.name}|${s.ring}`;
    if (!seen.has(key)) seen.set(key, s);
  }
  const deduped = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "da"));

  const byRing = new Map<number | null, number>();
  for (const s of deduped) byRing.set(s.ring, (byRing.get(s.ring) ?? 0) + 1);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const stopsFile: StopsFile = {
    generatedAt: new Date().toISOString().slice(0, 10),
    feedLastModified: lastModified,
    source: FEED_URL,
    count: deduped.length,
    stops: deduped,
  };

  const zones = buildRingCollection();
  const stopsPath = path.join(OUT_DIR, "stops.json");
  const zonesPath = path.join(OUT_DIR, "zones.geojson");

  const stopsJson = JSON.stringify(stopsFile);
  const zonesJson = JSON.stringify(zones);

  if (isDiffMode) {
    const drifted: string[] = [];
    for (const [p, next] of [
      [stopsPath, stopsJson],
      [zonesPath, zonesJson],
    ] as const) {
      if (!fs.existsSync(p)) {
        drifted.push(`${path.basename(p)} missing`);
        continue;
      }
      // Compare ignoring generatedAt, which changes on every run by design.
      const norm = (s: string) => s.replace(/"generatedAt":"[^"]*"/, "");
      const before = crypto.createHash("sha256").update(norm(fs.readFileSync(p, "utf8"))).digest("hex");
      const after = crypto.createHash("sha256").update(norm(next)).digest("hex");
      if (before !== after) drifted.push(path.basename(p));
    }
    if (drifted.length > 0) {
      console.error(`\nDRIFT DETECTED in: ${drifted.join(", ")}`);
      console.error("The upstream feed changed. Review the diff before committing.");
      process.exitCode = 1;
    } else {
      console.log("\nNo drift. Committed data matches the feed.");
    }
  }

  fs.writeFileSync(stopsPath, stopsJson);
  fs.writeFileSync(zonesPath, zonesJson);

  console.log(`\nFeed last modified: ${lastModified}`);
  console.log(`Stops in Greater Copenhagen bbox: ${deduped.length} (deduplicated by name+ring)`);
  console.log(`Ring polygons written: ${zones.features.length} (rings 1..${MAX_RING})`);
  console.log("\nStops per ring:");
  for (let r = 1; r <= MAX_RING; r++) {
    console.log(`  ring ${r}: ${byRing.get(r) ?? 0}`);
  }
  console.log(`  outside coverage: ${byRing.get(null) ?? 0}`);

  console.log("\n5 real sample stops:");
  const samples = deduped.filter((s) => s.ring !== null).slice(0, 5);
  for (const s of samples) {
    console.log(`  ${s.id}  ring ${s.ring}  ${s.name}  (${s.lat.toFixed(5)}, ${s.lon.toFixed(5)})`);
  }

  console.log(`\nWrote ${stopsPath}`);
  console.log(`Wrote ${zonesPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
