"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useGaeste } from "@/hooks/useGaeste";
import {
  eingecheckePersonen,
  gastPasstZurSuche,
  gesamtPersonen,
  istVollstaendigDa,
} from "@/lib/gaeste";
import { GastZeile } from "@/components/GastZeile";
import { GastFormular } from "@/components/GastFormular";
import { VerbindungsIndikator } from "@/components/VerbindungsIndikator";
import type { GastMitId } from "@/lib/gaeste";

type FilterWert = "alle" | "nicht-da" | "schon-da";

const FILTER_OPTIONEN: { wert: FilterWert; label: string }[] = [
  { wert: "alle", label: "Alle" },
  { wert: "nicht-da", label: "Noch nicht da" },
  { wert: "schon-da", label: "Schon da" },
];

type FormularStatus =
  | { offen: false }
  | { offen: true; gast?: GastMitId };

export default function Home() {
  const gaeste = useGaeste();
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<FilterWert>("alle");
  const [formular, setFormular] = useState<FormularStatus>({ offen: false });

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
      if (!gastPasstZurSuche(gast, sucheLower)) return false;
      if (filter === "schon-da" && !istVollstaendigDa(gast)) return false;
      if (filter === "nicht-da" && istVollstaendigDa(gast)) return false;
      return true;
    });
  }, [gaeste, sucheLower, filter]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg font-semibold tracking-tight text-stone-900">
              Gästeliste
            </h1>
            <VerbindungsIndikator />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-stone-500">
              <span className="font-semibold text-stone-900">
                {eingecheckt}
              </span>{" "}
              / {gesamt}
            </p>
            <Link
              href="/import"
              className="flex min-h-12 items-center rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
            >
              Import
            </Link>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="min-h-12 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
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
          className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
        />

        <div className="flex gap-2">
          {FILTER_OPTIONEN.map((option) => (
            <button
              key={option.wert}
              type="button"
              onClick={() => setFilter(option.wert)}
              aria-pressed={filter === option.wert}
              className={`min-h-12 flex-1 rounded-md px-3 text-sm ${
                filter === option.wert
                  ? "bg-stone-900 text-stone-50"
                  : "border border-stone-300 text-stone-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 divide-y divide-stone-200">
        {sichtbareGaeste.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-500">
            Keine Gäste gefunden.
          </p>
        ) : (
          sichtbareGaeste.map((gast) => (
            <GastZeile
              key={gast.id}
              gast={gast}
              sucheLower={sucheLower}
              onBearbeiten={(gast) => setFormular({ offen: true, gast })}
            />
          ))
        )}
      </main>

      <button
        type="button"
        onClick={() => setFormular({ offen: true, gast: undefined })}
        aria-label="Gast hinzufügen"
        className="fixed right-5 bottom-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-3xl text-stone-50 shadow-lg hover:bg-stone-800"
      >
        +
      </button>

      {formular.offen && (
        <GastFormular
          gast={formular.gast}
          onClose={() => setFormular({ offen: false })}
        />
      )}
    </div>
  );
}
