import type { Copy } from "@/lib/i18n";

/**
 * The disclaimer is a hard requirement, not a nicety: a wrong zone can cost a
 * real person a ~750 DKK fine. It must be readable without a tap on every
 * surface that states a zone number.
 *
 * `role="note"` rather than `alert` — it is persistent context, not an
 * interruption, and alert would make screen readers announce it on every
 * zone change.
 */
export function Disclaimer({
  copy,
  variant = "short",
}: {
  copy: Copy;
  /**
   * "official" is used only when Rejseplanen's own tariff service answered.
   * It is still a caution, just an honest one — the number is real, but a zone
   * is not a ticket.
   */
  variant?: "short" | "long" | "official";
}) {
  const text =
    variant === "short"
      ? copy.disclaimerShort
      : variant === "official"
        ? copy.disclaimerOfficial
        : copy.disclaimerLong;

  return (
    <p
      role="note"
      className={
        variant === "short"
          ? "text-[11px] leading-snug text-ink-muted dark:text-neutral-400"
          : "text-xs leading-relaxed text-ink-muted dark:text-neutral-400"
      }
    >
      {text}
    </p>
  );
}
