"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { zoneForPoint, zonesCrossed, billableZoneCount, validityMinutes } from "@/lib/zone-model";
import type { Stop, StopsFile } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { Disclaimer } from "@/components/Disclaimer";
import { StopSearch } from "@/components/StopSearch";
import { InfoBox } from "@/components/InfoBox";
import type { Marker } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-urban" />,
});

type LocState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "unavailable" };

type Mode = "here" | "journey";

/** "1 hr, 30 min" — matches how the official ticket screens phrase it. */
function formatValidity(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr, ${m} min`;
}

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
  const copy = t(lang);

  const [mode, setMode] = useState<Mode>("here");
  const [loc, setLoc] = useState<LocState>({ status: "idle" });
  const [probe, setProbe] = useState<{ lat: number; lon: number } | null>(null);
  const [lookup, setLookup] = useState<Stop | null>(null);
  const [data, setData] = useState<StopsFile | null>(null);
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [official, setOfficial] = useState<{
    source: "rejseplanen" | "model";
    zone: number | null;
  } | null>(null);

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
        setLoc({ status: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude });
        setProbe(null);
        setLookup(null);
      },
      (err) =>
        setLoc({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  const handleMapTap = useCallback((lat: number, lon: number) => {
    setProbe({ lat, lon });
    setLookup(null);
  }, []);

  /** The point currently being asked about. */
  const target = lookup
    ? { lat: lookup.lat, lon: lookup.lon }
    : probe
      ? { lat: probe.lat, lon: probe.lon }
      : loc.status === "ok"
        ? { lat: loc.lat, lon: loc.lon }
        : null;

  useEffect(() => {
    if (!target) {
      setOfficial(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/zone?lat=${target.lat}&lon=${target.lon}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setOfficial(d))
      .catch(() => !cancelled && setOfficial(null));
    return () => {
      cancelled = true;
    };
  }, [target?.lat, target?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetZone = target ? zoneForPoint(target) : null;
  const isOfficial = official?.source === "rejseplanen" && official.zone !== null;
  const zoneLabel = isOfficial ? String(official!.zone).padStart(3, "0") : targetZone?.code ?? null;

  const journey = useMemo(() => {
    if (!from || !to) return null;
    const zones = zonesCrossed(from, to);
    if (zones.length === 0) return null;
    const count = billableZoneCount(zones.length);
    return { zones, count, minutes: validityMinutes(count) };
  }, [from, to]);

  const markers = useMemo<Marker[]>(() => {
    if (mode === "journey") {
      const out: Marker[] = [];
      if (from) out.push({ lat: from.lat, lon: from.lon, kind: "from" });
      if (to) out.push({ lat: to.lat, lon: to.lon, kind: "to" });
      return out;
    }
    return target ? [{ lat: target.lat, lon: target.lon, kind: "user" }] : [];
  }, [mode, target?.lat, target?.lon, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const journeyLine = useMemo<[number, number][] | null>(
    () =>
      mode === "journey" && from && to
        ? [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ]
        : null,
    [mode, from, to],
  );

  const activeZone = useMemo(() => {
    if (mode === "journey") return from?.zone ?? to?.zone ?? null;
    return targetZone?.code ?? null;
  }, [mode, from, to, targetZone]);

  return (
    <main className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface dark:bg-neutral-950">
      {/* Map occupies the top third, as on the reference ticket screens. */}
      <div className="relative h-[38dvh] shrink-0">
        <MapView
          activeZone={activeZone}
          markers={markers}
          journeyLine={journeyLine}
          onMapTap={handleMapTap}
          reducedMotion={reducedMotion}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="pointer-events-auto rounded-2xl bg-surface/95 px-3 py-1.5 shadow-sm backdrop-blur dark:bg-neutral-900/95">
            <h1 className="text-sm font-semibold text-green-900 dark:text-green-100">
              {copy.appName}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "da" : "en")}
            className="pointer-events-auto rounded-full bg-green-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
          >
            {copy.langToggle}
          </button>
        </div>
      </div>

      {/* Sheet */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          <div
            role="tablist"
            aria-label="Mode"
            className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.06] p-1 dark:bg-white/10"
          >
            {(["here", "journey"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-green-900 text-white" : "text-ink-muted dark:text-neutral-300"
                }`}
              >
                {m === "here" ? copy.findMyZone : copy.journey}
              </button>
            ))}
          </div>

          {mode === "here" ? (
            <section className="space-y-5" aria-live="polite">
              {!target && loc.status !== "locating" && (
                <>
                  <button
                    type="button"
                    onClick={locate}
                    className="w-full rounded-2xl bg-green-900 px-4 py-4 text-base font-semibold text-white active:bg-green-700"
                  >
                    {copy.findMyZone}
                  </button>

                  <StopSearch
                    label={copy.orCheckPlace}
                    placeholder={copy.searchStops}
                    stops={data?.stops ?? []}
                    selected={null}
                    onSelect={setLookup}
                  />

                  <p className="text-xs leading-relaxed text-ink-muted dark:text-neutral-400">
                    {copy.tryExamples} København H · Nørreport St. · Nørrebro St. ·
                    Københavns Lufthavn
                    <br />
                    {copy.tapMapHint}
                  </p>
                </>
              )}

              {loc.status === "locating" && (
                <p className="py-6 text-center text-sm text-ink-muted">{copy.locating}</p>
              )}

              {(loc.status === "denied" || loc.status === "unavailable") && !target && (
                <InfoBox tone="warn">
                  <p className="font-medium dark:text-neutral-100">
                    {loc.status === "denied" ? copy.denied : copy.unavailable}
                  </p>
                  <p className="mt-1 text-ink-muted dark:text-neutral-400">
                    {loc.status === "denied" ? copy.deniedHelp : copy.unavailableHelp}
                  </p>
                </InfoBox>
              )}

              {target && (
                <div className="space-y-5">
                  {zoneLabel ? (
                    <div>
                      <p className="truncate text-sm text-ink-muted dark:text-neutral-400">
                        {lookup ? lookup.name : probe ? copy.inspecting : copy.youAreIn}
                      </p>
                      <h2 className="mt-1 text-5xl font-bold tracking-tight text-ink dark:text-neutral-50">
                        {copy.zoneWord} {zoneLabel}
                      </h2>
                      <span
                        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          isOfficial
                            ? "bg-green-900 text-white"
                            : "bg-black/[0.07] text-ink-muted dark:bg-white/15 dark:text-neutral-300"
                        }`}
                      >
                        {isOfficial ? copy.sourceOfficial : copy.sourceEstimate}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-neutral-50">
                        {copy.outsideArea}
                      </h2>
                      <p className="mt-2 text-sm text-ink-muted dark:text-neutral-400">
                        {copy.outsideAreaHelp}
                      </p>
                    </div>
                  )}

                  <InfoBox>
                    <Disclaimer copy={copy} variant={isOfficial ? "official" : "long"} />
                  </InfoBox>

                  <button
                    type="button"
                    onClick={() => {
                      setProbe(null);
                      setLookup(null);
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
            <section className="space-y-4" aria-live="polite">
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
                <div className="space-y-5 pt-1">
                  <div>
                    <h2 className="text-5xl font-bold tracking-tight text-ink dark:text-neutral-50">
                      {journey.count} {copy.zonesWord}
                    </h2>
                    <p className="mt-2 text-sm text-ink-muted dark:text-neutral-400">
                      {copy.validFor} {formatValidity(journey.minutes)}
                    </p>
                  </div>

                  <InfoBox>
                    <p className="text-center text-xs leading-relaxed text-ink-muted dark:text-neutral-400">
                      {copy.ticketRule}
                    </p>
                  </InfoBox>

                  <div>
                    <p className="mb-2 text-xs font-medium text-ink-muted dark:text-neutral-400">
                      {copy.zonesCrossed}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {journey.zones.map((z) => (
                        <span
                          key={z}
                          className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-green-900 px-2.5 text-sm font-semibold tabular-nums text-white"
                        >
                          {z}
                        </span>
                      ))}
                    </div>
                  </div>

                  <InfoBox>
                    <Disclaimer copy={copy} variant="long" />
                  </InfoBox>
                </div>
              )}
            </section>
          )}

          <footer className="border-t border-black/[0.07] pt-4 dark:border-white/10">
            <Disclaimer copy={copy} variant="short" />
            {data && (
              <p className="mt-2 text-[11px] text-ink-muted dark:text-neutral-500">
                {copy.dataAsOf} {data.generatedAt} · {copy.feedUpdated} {data.feedLastModified}
              </p>
            )}
          </footer>
        </div>
      </div>
    </main>
  );
}
