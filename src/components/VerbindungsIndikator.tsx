"use client";

import { useVerbindungsStatus } from "@/hooks/useVerbindungsStatus";

const STATUS_ANZEIGE = {
  offline: { text: "Offline", punkt: "bg-amber-500" },
  synchronisiert: { text: "Synchronisiert…", punkt: "bg-sky-400 animate-pulse" },
  aktuell: { text: "Aktuell", punkt: "bg-emerald-500" },
} as const;

export function VerbindungsIndikator() {
  const status = useVerbindungsStatus();
  const anzeige = STATUS_ANZEIGE[status];

  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${anzeige.punkt}`}
        aria-hidden="true"
      />
      {anzeige.text}
    </span>
  );
}
