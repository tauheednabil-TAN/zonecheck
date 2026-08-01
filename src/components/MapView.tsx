"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle, PALETTE } from "@/lib/map-style";
import { CENTRE } from "@/lib/zone-model";

export interface Marker {
  lat: number;
  lon: number;
  kind: "user" | "from" | "to" | "probe";
}

export function MapView({
  activeZone,
  markers,
  journeyLine,
  onMapTap,
  reducedMotion,
}: {
  activeZone: string | null;
  markers: Marker[];
  journeyLine: [number, number][] | null;
  onMapTap: (lat: number, lon: number) => void;
  reducedMotion: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const tapRef = useRef(onMapTap);
  tapRef.current = onMapTap;

  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new maplibregl.Map({
      container: container.current,
      style: buildMapStyle(),
      center: [CENTRE.lon, CENTRE.lat],
      zoom: 9.5,
      attributionControl: { compact: true },
    });
    map.current = m;

    m.on("load", () => {
      m.addSource("zones", { type: "geojson", data: "/data/zones.geojson" });
      m.addSource("zone-labels", { type: "geojson", data: "/data/zone-labels.geojson" });

      // Faint tint, alternating by ring so neighbouring bands stay readable
      // without introducing a second hue.
      m.addLayer({
        id: "zone-fill",
        type: "fill",
        source: "zones",
        paint: {
          "fill-color": PALETTE.green900,
          "fill-opacity": ["case", ["==", ["%", ["get", "ring"], 2], 0], 0.05, 0.09],
        },
      });

      // The boundaries. This is what makes it read as a zone map.
      m.addLayer({
        id: "zone-line",
        type: "line",
        source: "zones",
        paint: {
          "line-color": PALETTE.green900,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 1.6],
          "line-opacity": 0.45,
        },
      });

      m.addLayer({
        id: "zone-active",
        type: "fill",
        source: "zones",
        filter: ["==", ["get", "code"], "___none___"],
        paint: { "fill-color": PALETTE.green900, "fill-opacity": 0.3 },
      });

      m.addLayer({
        id: "zone-active-line",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "code"], "___none___"],
        paint: { "line-color": PALETTE.green900, "line-width": 2.5 },
      });

      m.addSource("journey", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "journey-line",
        type: "line",
        source: "journey",
        paint: {
          "line-color": PALETTE.accent,
          "line-width": 4,
          "line-dasharray": [1.6, 1.4],
        },
      });

      m.addSource("markers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "marker-halo",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 12,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(0,0,0,0.18)",
        },
      });
      m.addLayer({
        id: "marker-dot",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "kind"],
            "user", PALETTE.green900,
            "from", PALETTE.accent,
            "to", PALETTE.accent,
            PALETTE.green700,
          ],
        },
      });

      // Zone numbers, on top of everything, in a white pill like a printed
      // fare-zone map. Added last so they never sit under a marker.
      m.addLayer({
        id: "zone-number",
        type: "symbol",
        source: "zone-labels",
        layout: {
          "text-field": ["get", "code"],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 13, 16],
          "text-allow-overlap": false,
          "text-padding": 6,
        },
        paint: {
          "text-color": PALETTE.green900,
          "text-halo-color": "#FFFFFF",
          "text-halo-width": 2.2,
        },
      });

      ready.current = true;
      m.resize();
    });

    m.on("click", (e) => tapRef.current(e.lngLat.lat, e.lngLat.lng));

    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      if (!m.getLayer("zone-active")) return;
      const f = ["==", ["get", "code"], activeZone ?? "___none___"] as never;
      m.setFilter("zone-active", f);
      m.setFilter("zone-active-line", f);
    };
    if (ready.current) apply();
    else m.once("idle", apply);
  }, [activeZone]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("markers") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: markers.map((mk) => ({
          type: "Feature" as const,
          properties: { kind: mk.kind },
          geometry: { type: "Point" as const, coordinates: [mk.lon, mk.lat] },
        })),
      });
    };
    if (ready.current) apply();
    else m.once("idle", apply);
  }, [markers]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("journey") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: journeyLine
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: journeyLine },
              },
            ]
          : [],
      });
    };
    if (ready.current) apply();
    else m.once("idle", apply);
  }, [journeyLine]);

  useEffect(() => {
    const m = map.current;
    if (!m || markers.length === 0) return;

    if (journeyLine && markers.length >= 2) {
      const b = new maplibregl.LngLatBounds();
      for (const mk of markers) b.extend([mk.lon, mk.lat]);
      m.fitBounds(b, { padding: 60, duration: reducedMotion ? 0 : 800, maxZoom: 12 });
      return;
    }

    const last = markers[markers.length - 1];
    if (reducedMotion) {
      m.jumpTo({ center: [last.lon, last.lat], zoom: Math.max(m.getZoom(), 11) });
    } else {
      m.flyTo({
        center: [last.lon, last.lat],
        zoom: Math.max(m.getZoom(), 11),
        duration: 900,
        essential: true,
      });
    }
  }, [markers, journeyLine, reducedMotion]);

  return (
    <div ref={container} className="absolute inset-0" aria-label="Zone map" role="application" />
  );
}
