"use client";

import { useMemo, useState, useId } from "react";
import type { Stop } from "@/lib/types";

/**
 * Stop search over the real GTFS stop list. Names and coordinates are genuine
 * open data; only the ring attached to each is modelled.
 */
export function StopSearch({
  label,
  placeholder,
  stops,
  selected,
  onSelect,
}: {
  label: string;
  placeholder: string;
  stops: Stop[];
  selected: Stop | null;
  onSelect: (s: Stop | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Stop[] = [];
    for (const s of stops) {
      if (s.name.toLowerCase().includes(q)) {
        out.push(s);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [query, stops]);

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-ink-muted dark:text-neutral-400">
        {label}
      </label>

      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-700/30 bg-green-900/5 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm dark:text-neutral-100">
            {selected.name}
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-900/10"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/20 dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-100"
          />

          {open && matches.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/15 dark:bg-neutral-800"
            >
              {matches.map((s) => (
                <li key={s.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-green-900/5 dark:text-neutral-100 dark:hover:bg-white/5"
                  >
                    <span className="min-w-0 truncate">{s.name}</span>
                    {s.zone !== null && (
                      <span className="shrink-0 rounded-full bg-green-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {s.zone}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
