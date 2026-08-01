export interface Stop {
  /** GTFS stop_id, straight from the Rejseplanen feed. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Ring assigned by the approximate model, or null if outside coverage. */
  ring: number | null;
  /** Two-digit zone code from the model, e.g. "01" or "32". Not a real DOT number. */
  zone: string | null;
}

export interface StopsFile {
  /** ISO date the GTFS feed was retrieved. Shown in the app footer. */
  generatedAt: string;
  /** Feed `Last-Modified`, so staleness is visible without a rebuild. */
  feedLastModified: string;
  source: string;
  count: number;
  stops: Stop[];
}
