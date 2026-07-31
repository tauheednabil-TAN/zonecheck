/**
 * A filled green-900 disc with white numerals. The one saturated element in
 * the interface besides the journey line, so it reads instantly on a muted map.
 */
export function ZonePill({
  ring,
  size = "lg",
}: {
  ring: number;
  size?: "sm" | "lg";
}) {
  const dims =
    size === "lg"
      ? "h-16 w-16 text-3xl"
      : "h-8 w-8 text-sm";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-green-900 font-semibold tabular-nums text-white ${dims}`}
    >
      {ring}
    </span>
  );
}

/** A row of pills for the rings a journey passes through. */
export function ZonePillRow({ rings }: { rings: number[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rings.map((r, i) => (
        <span key={r} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-ink-muted">→</span>}
          <ZonePill ring={r} size="sm" />
        </span>
      ))}
    </div>
  );
}
