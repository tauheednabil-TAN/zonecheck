/**
 * Bordered note with a small badge notched into the top edge, matching the
 * pattern the official ticket screens use for "read this" copy.
 */
export function InfoBox({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <div className="relative rounded-2xl border border-black/[0.12] bg-black/[0.02] px-4 pb-4 pt-5 dark:border-white/15 dark:bg-white/[0.04]">
      <span
        aria-hidden
        className={`absolute -top-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border text-xs font-bold ${
          tone === "warn"
            ? "border-accent bg-surface text-accent dark:bg-neutral-900"
            : "border-black/[0.12] bg-surface text-ink-muted dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-300"
        }`}
      >
        !
      </span>
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}
