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
  activeRing,
  markers,
  journeyLine,
  onMapTap,
  reducedMotion,
}: {
  activeRing: number | null;
  markers: Marker[];
  journeyLine: [number, number][] | null;
  onMapTap: (lat: number, lon: number) => void;
  reducedMotion: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  // Keep the tap handler in a ref so re-registering it never detaches the
  // listener mid-gesture.
  const tapRef = useRef(onMapTap);
  tapRef.current = onMapTap;

  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new maplibregl.Map({
      container: container.current,
      style: buildMapStyle(),
      center: [CENTRE.lon, CENTRE.lat],
      zoom: 10,
      attributionControl: { compact: true },
    });
    map.current = m;

    m.on("load", () => {
      m.addSource("zones", { type: "geojson", data: "/data/zones.geojson" });

      m.addLayer({
        id: "zone-fill",
        type: "fill",
        source: "zones",
        paint: {
          "fill-color": PALETTE.green900,
          // Alternating bands so adjacent rings stay distinguishable without
          // introducing a second hue.
          "fill-opacity": ["case", ["==", ["%", ["get", "ring"], 2], 0], 0.1, 0.16],
        },
      });

      m.addLayer({
        id: "zone-line",
        type: "line",
        source: "zones",
        paint: { "line-color": PALETTE.green900, "line-width": 1, "line-opacity": 0.5 },
      });

      m.addLayer({
        id: "zone-active",
        type: "fill",
        source: "zones",
        filter: ["==", ["get", "ring"], -1],
        paint: { "fill-color": PALETTE.green900, "fill-opacity": 0.34 },
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
          "line-width": 3.5,
          "line-dasharray": [2, 1.6],
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
          "circle-radius": 11,
          "circle-color": "#FFFFFF",
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(0,0,0,0.15)",
        },
      });
      m.addLayer({
        id: "marker-dot",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "kind"],
            "user", PALETTE.green900,
            "from", PALETTE.accent,
            "to", PALETTE.accent,
            PALETTE.inkMuted,
          ],
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

  // Highlight the active ring.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      if (!m.getLayer("zone-active")) return;
      m.setFilter("zone-active", ["==", ["get", "ring"], activeRing ?? -1]);
    };
    if (ready.current) apply();
    else m.once("idle", apply);
  }, [activeRing]);

  // Markers.
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

  // Journey line.
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

  // Fly to the newest marker. Honours prefers-reduced-motion by jumping.
  useEffect(() => {
    const m = map.current;
    if (!m || markers.length === 0) return;
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
  }, [markers, reducedMotion]);

  return <div ref={container} className="absolute inset-0" aria-label="Zone map" role="application" />;
}
