"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ringForPoint,
  ringsCrossed,
  billableZoneCount,
  validityMinutes,
} from "@/lib/zone-model";
import type { Stop, StopsFile } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { Disclaimer } from "@/components/Disclaimer";
import { ZonePill, ZonePillRow } from "@/components/ZonePill";
import { StopSearch } from "@/components/StopSearch";
import type { Marker } from "@/components/MapView";

// MapLibre touches `window` at import time, so it can never be server-rendered.
const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-urban" />,
});

type LocState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; lat: number; lon: number; ring: number | null }
  | { status: "denied" }
  | { status: "unavailable" };

type Mode = "here" | "journey";

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
  const copy = t(lang);

  const [mode, setMode] = useState<Mode>("here");
  const [loc, setLoc] = useState<LocState>({ status: "idle" });
  const [probe, setProbe] = useState<{ lat: number; lon: number; ring: number | null } | null>(null);
  const [data, setData] = useState<StopsFile | null>(null);
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    fetch("/data/stops.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLoc({ status: "unavailable" });
      return;
    }
    setLoc({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setLoc({ status: "ok", lat, lon, ring: ringForPoint({ lat, lon }) });
        setProbe(null);
      },
      (err) => {
        setLoc({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  const handleMapTap = useCallback((lat: number, lon: number) => {
    setProbe({ lat, lon, ring: ringForPoint({ lat, lon }) });
  }, []);

  const markers = useMemo<Marker[]>(() => {
    const out: Marker[] = [];
    if (mode === "journey") {
      if (from) out.push({ lat: from.lat, lon: from.lon, kind: "from" });
      if (to) out.push({ lat: to.lat, lon: to.lon, kind: "to" });
      return out;
    }
    if (loc.status === "ok") out.push({ lat: loc.lat, lon: loc.lon, kind: "user" });
    if (probe) out.push({ lat: probe.lat, lon: probe.lon, kind: "probe" });
    return out;
  }, [mode, loc, probe, from, to]);

  const journeyLine = useMemo<[number, number][] | null>(() => {
    if (mode !== "journey" || !from || !to) return null;
    return [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ];
  }, [mode, from, to]);

  const journey = useMemo(() => {
    if (!from || !to || from.ring === null || to.ring === null) return null;
    const rings = ringsCrossed(from.ring, to.ring);
    const count = billableZoneCount(rings.length);
    return { rings, count, minutes: validityMinutes(count) };
  }, [from, to]);

  // Which ring the map should highlight.
  const activeRing = useMemo(() => {
    if (mode === "journey") return from?.ring ?? to?.ring ?? null;
    if (probe) return probe.ring;
    return loc.status === "ok" ? loc.ring : null;
  }, [mode, probe, loc, from, to]);

  const shown = probe ?? (loc.status === "ok" ? loc : null);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <MapView
        activeRing={activeRing}
        markers={markers}
        journeyLine={journeyLine}
        onMapTap={handleMapTap}
        reducedMotion={reducedMotion}
      />

      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl bg-surface/92 px-3 py-2 shadow-sm backdrop-blur dark:bg-neutral-900/92">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-green-900 dark:text-green-100">
              {copy.appName}
            </h1>
            <p className="truncate text-[11px] text-ink-muted dark:text-neutral-400">
              {copy.tagline}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "da" : "en")}
            className="shrink-0 rounded-lg border border-green-700/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300"
          >
            {copy.langToggle}
          </button>
        </div>
      </header>

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-10 max-h-[72dvh] overflow-y-auto rounded-t-3xl bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:bg-neutral-900">
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/15 dark:bg-white/20" />

        <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {/* Mode switch */}
          <div
            role="tablist"
            aria-label="Mode"
            className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10"
          >
            {(["here", "journey"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-green-900 text-white"
                    : "text-ink-muted dark:text-neutral-300"
                }`}
              >
                {m === "here" ? copy.findMyZone : copy.journey}
              </button>
            ))}
          </div>

          {mode === "here" ? (
            <section className="space-y-3" aria-live="polite">
              {loc.status === "idle" && !probe && (
                <>
                  <button
                    type="button"
                    onClick={locate}
                    className="w-full rounded-xl bg-green-900 px-4 py-3.5 text-base font-semibold text-white active:bg-green-700"
                  >
                    {copy.findMyZone}
                  </button>
                  <p className="text-xs text-ink-muted dark:text-neutral-400">
                    {copy.tapMapHint}
                  </p>
                </>
              )}

              {loc.status === "locating" && (
                <p className="py-3 text-center text-sm text-ink-muted">{copy.locating}</p>
              )}

              {(loc.status === "denied" || loc.status === "unavailable") && (
                <div className="space-y-2 rounded-xl bg-black/5 p-3 dark:bg-white/10">
                  <p className="text-sm font-medium dark:text-neutral-100">
                    {loc.status === "denied" ? copy.denied : copy.unavailable}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-neutral-400">
                    {loc.status === "denied" ? copy.deniedHelp : copy.unavailableHelp}
                  </p>
                  <button
                    type="button"
                    onClick={locate}
                    className="rounded-lg border border-green-700/40 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    {copy.retry}
                  </button>
                </div>
              )}

              {shown && (
                <div className="space-y-3">
                  {shown.ring !== null ? (
                    <div className="flex items-center gap-4">
                      <ZonePill ring={shown.ring} />
                      <div className="min-w-0">
                        <p className="text-sm text-ink-muted dark:text-neutral-400">
                          {probe ? copy.inspecting : copy.youAreIn}
                        </p>
                        <p className="text-xl font-semibold text-green-900 dark:text-green-100">
                          {copy.zoneRing} {shown.ring}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/10">
                      <p className="text-sm font-medium dark:text-neutral-100">
                        {copy.outsideArea}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted dark:text-neutral-400">
                        {copy.outsideAreaHelp}
                      </p>
                    </div>
                  )}

                  {/* Required on every surface stating a zone. */}
                  <Disclaimer copy={copy} variant="long" />

                  <button
                    type="button"
                    onClick={() => {
                      setProbe(null);
                      setLoc({ status: "idle" });
                    }}
                    className="text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    {copy.clear}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-3" aria-live="polite">
              <StopSearch
                label={copy.from}
                placeholder={copy.searchStops}
                stops={data?.stops ?? []}
                selected={from}
                onSelect={setFrom}
              />
              <StopSearch
                label={copy.to}
                placeholder={copy.searchStops}
                stops={data?.stops ?? []}
                selected={to}
                onSelect={setTo}
              />

              {journey && (
                <div className="space-y-3 rounded-xl bg-green-900/5 p-3">
                  <div>
                    <p className="mb-1.5 text-xs text-ink-muted dark:text-neutral-400">
                      {copy.zonesCrossed}
                    </p>
                    <ZonePillRow rings={journey.rings} />
                  </div>

                  <div className="flex gap-6">
                    <div>
                      <p className="text-xs text-ink-muted dark:text-neutral-400">
                        {copy.zoneCount}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums text-green-900 dark:text-green-100">
                        {journey.count}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted dark:text-neutral-400">
                        {copy.validFor}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums text-green-900 dark:text-green-100">
                        {journey.minutes}{" "}
                        <span className="text-sm font-normal">{copy.minutes}</span>
                      </p>
                    </div>
                  </div>

                  {journey.rings.length < 2 && (
                    <p className="text-xs text-ink-muted dark:text-neutral-400">
                      {copy.minFareNote}
                    </p>
                  )}

                  <Disclaimer copy={copy} variant="long" />
                </div>
              )}
            </section>
          )}

          <footer className="border-t border-black/5 pt-3 dark:border-white/10">
            <Disclaimer copy={copy} variant="short" />
            {data && (
              <p className="mt-1.5 text-[11px] text-ink-muted dark:text-neutral-500">
                {copy.dataAsOf} {data.generatedAt} · {copy.feedUpdated}{" "}
                {data.feedLastModified}
              </p>
            )}
          </footer>
        </div>
      </div>
    </main>
  );
}
