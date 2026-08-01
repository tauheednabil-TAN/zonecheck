import { NextResponse } from "next/server";
import { ringForPoint } from "@/lib/zone-model";

/**
 * Resolves a coordinate to a fare zone.
 *
 * Two sources, and the app tells the user which one answered:
 *
 *   "rejseplanen" — REAL. Rejseplanen's own zoneFromCoordinate service, the
 *                   same tariff engine behind the official journey planner.
 *                   Requires REJSEPLANEN_ACCESS_ID.
 *   "model"       — ESTIMATE. The concentric ring approximation. Used only
 *                   when no key is configured, or when upstream fails.
 *
 * The key is read server-side and never reaches the browser. That is the whole
 * reason this is a route handler rather than a direct fetch from the client.
 */

export const dynamic = "force-dynamic";

const UPSTREAM = "https://www.rejseplanen.dk/api/zoneFromCoordinate";

interface ZoneAnswer {
  source: "rejseplanen" | "model";
  /** Official DOT zone number when source is rejseplanen. */
  zone: number | null;
  zoneName: string | null;
  /** Ring from the approximate model. Always populated as a fallback. */
  ring: number | null;
  /** Present when the real source was tried and failed. */
  note?: string;
}

/**
 * Pull a zone number out of the upstream payload.
 *
 * Written defensively on purpose: the exact response shape could not be
 * observed during development because no access key was available. It walks the
 * JSON for the first plausible zone field rather than assuming one path, and
 * returns null rather than guessing if nothing matches.
 */
function extractZone(payload: unknown): { zone: number | null; name: string | null } {
  let zone: number | null = null;
  let name: string | null = null;

  const visit = (node: unknown): void => {
    if (zone !== null || node === null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const k = key.toLowerCase();

      if (zone === null && /^(zone|zonenr|zonenumber|number|id)$/.test(k)) {
        const n = typeof value === "number" ? value : parseInt(String(value), 10);
        if (Number.isFinite(n) && n > 0 && n < 10000) zone = n;
      }
      if (name === null && /^(zonename|name|title)$/.test(k) && typeof value === "string") {
        name = value;
      }
      if (value !== null && typeof value === "object") visit(value);
    }
  };

  visit(payload);
  return { zone, name };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  const ring = ringForPoint({ lat, lon });
  const accessId = process.env.REJSEPLANEN_ACCESS_ID;

  if (!accessId) {
    const answer: ZoneAnswer = { source: "model", zone: null, zoneName: null, ring };
    return NextResponse.json(answer);
  }

  try {
    const url = `${UPSTREAM}?accessId=${encodeURIComponent(accessId)}&lat=${lat}&long=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });

    if (!res.ok) {
      const answer: ZoneAnswer = {
        source: "model",
        zone: null,
        zoneName: null,
        ring,
        note: `Rejseplanen returned HTTP ${res.status}; showing the estimate instead.`,
      };
      return NextResponse.json(answer);
    }

    const payload = await res.json();
    const { zone, name } = extractZone(payload);

    if (zone === null) {
      const answer: ZoneAnswer = {
        source: "model",
        zone: null,
        zoneName: null,
        ring,
        note: "Rejseplanen replied but no zone field was recognised; showing the estimate instead.",
      };
      return NextResponse.json(answer);
    }

    const answer: ZoneAnswer = { source: "rejseplanen", zone, zoneName: name, ring };
    return NextResponse.json(answer);
  } catch {
    const answer: ZoneAnswer = {
      source: "model",
      zone: null,
      zoneName: null,
      ring,
      note: "Could not reach Rejseplanen; showing the estimate instead.",
    };
    return NextResponse.json(answer);
  }
}
