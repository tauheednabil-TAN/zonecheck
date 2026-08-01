import type { StyleSpecification } from "maplibre-gl";

/**
 * A hand-built style over OpenFreeMap's vector tiles (OpenMapTiles schema).
 *
 * Written from scratch rather than recoloring a stock style, because the brief
 * fixes the palette exactly and patching someone else's style leaves stray
 * colours in layers you forgot about. Everything here is muted on purpose: the
 * zone overlay and the journey line must be the only saturated things visible.
 *
 * OpenFreeMap needs no API key and no token.
 */

export const PALETTE = {
  land: "#D4E5C1",
  green: "#C3DDA9",
  urban: "#E8EDE4",
  water: "#AAD3F0",
  road: "#FFFFFF",
  hwy: "#F5B93F",
  ink: "#1A1A1A",
  inkMuted: "#6B7280",
  green900: "#0F4429",
  green700: "#1B6B3A",
  accent: "#F5851F",
} as const;

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      openfreemap: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": PALETTE.land },
      },
      {
        id: "landcover-green",
        type: "fill",
        source: "openfreemap",
        "source-layer": "landcover",
        filter: ["in", "class", "wood", "grass", "forest", "scrub"],
        paint: { "fill-color": PALETTE.green, "fill-opacity": 0.9 },
      },
      {
        id: "park",
        type: "fill",
        source: "openfreemap",
        "source-layer": "park",
        paint: { "fill-color": PALETTE.green, "fill-opacity": 0.8 },
      },
      {
        id: "landuse-urban",
        type: "fill",
        source: "openfreemap",
        "source-layer": "landuse",
        filter: ["in", "class", "residential", "commercial", "industrial", "retail"],
        paint: { "fill-color": PALETTE.urban, "fill-opacity": 0.85 },
      },
      {
        id: "water",
        type: "fill",
        source: "openfreemap",
        "source-layer": "water",
        paint: { "fill-color": PALETTE.water },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openfreemap",
        "source-layer": "transportation",
        filter: ["in", "class", "minor", "service", "street", "residential"],
        minzoom: 12,
        paint: {
          "line-color": PALETTE.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.4, 18, 6],
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "openfreemap",
        "source-layer": "transportation",
        filter: ["in", "class", "primary", "secondary", "tertiary", "trunk"],
        paint: {
          "line-color": PALETTE.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 18, 10],
        },
      },
      {
        id: "road-motorway",
        type: "line",
        source: "openfreemap",
        "source-layer": "transportation",
        filter: ["==", "class", "motorway"],
        paint: {
          "line-color": PALETTE.hwy,
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 18, 12],
        },
      },
      {
        id: "building",
        type: "fill",
        source: "openfreemap",
        "source-layer": "building",
        minzoom: 14,
        paint: { "fill-color": "#DCE3D6", "fill-opacity": 0.6 },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "openfreemap",
        "source-layer": "place",
        filter: ["in", "class", "city", "town", "suburb", "village"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 15],
        },
        paint: {
          "text-color": PALETTE.ink,
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.4,
        },
      },
    ],
  } as StyleSpecification;
}
