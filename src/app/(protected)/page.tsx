"use client";

import { useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGaeste } from "@/hooks/useGaeste";
import {
  eingecheckePersonen,
  gesamtPersonen,
  istVollstaendigDa,
} from "@/lib/gaeste";
import { GastZeile } from "@/components/GastZeile";

type FilterWert = "alle" | "nicht-da" | "schon-da";

const FILTER_OPTIONEN: { wert: FilterWert; label: string }[] = [
  { wert: "alle", label: "Alle" },
  { wert: "nicht-da", label: "Noch nicht da" },
  { wert: "schon-da", label: "Schon da" },
];

export default function Home() {
  const gaeste = useGaeste();
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<FilterWert>("alle");

  const sucheLower = suche.trim().toLowerCase();

  const { gesamt, eingecheckt } = useMemo(() => {
    let gesamt = 0;
    let eingecheckt = 0;
    for (const gast of gaeste) {
      gesamt += gesamtPersonen(gast);
      eingecheckt += eingecheckePersonen(gast);
    }
    return { gesamt, eingecheckt };
  }, [gaeste]);

  const sichtbareGaeste = useMemo(() => {
    return gaeste.filter((gast) => {
      if (sucheLower && !gast.nameLower.includes(sucheLower)) return false;
      if (filter === "schon-da" && !istVollstaendigDa(gast)) return false;
      if (filter === "nicht-da" && istVollstaendigDa(gast)) return false;
      return true;
    });
  }, [gaeste, sucheLower, filter]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-zinc-50">Gästeliste</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-50">
                {eingecheckt}
              </span>{" "}
              / {gesamt}
            </p>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="min-h-10 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Abmelden
            </button>
          </div>
        </div>

        <input
          type="search"
          inputMode="search"
          placeholder="Name suchen…"
          value={suche}
          onChange={(event) => setSuche(event.target.value)}
          className="min-h-12 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-zinc-50 outline-none focus:border-zinc-400"
        />

        <div className="flex gap-2">
          {FILTER_OPTIONEN.map((option) => (
            <button
              key={option.wert}
              type="button"
              onClick={() => setFilter(option.wert)}
              aria-pressed={filter === option.wert}
              className={`min-h-10 flex-1 rounded-md px-3 text-sm ${
                filter === option.wert
                  ? "bg-zinc-50 text-zinc-950"
                  : "border border-zinc-700 text-zinc-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 divide-y divide-zinc-800">
        {sichtbareGaeste.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">
            Keine Gäste gefunden.
          </p>
        ) : (
          sichtbareGaeste.map((gast) => (
            <GastZeile key={gast.id} gast={gast} />
          ))
        )}
      </main>
    </div>
  );
}
