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
type TabWert = "gaeste" | "mitglieder";

const FILTER_OPTIONEN: { wert: FilterWert; label: string }[] = [
  { wert: "alle", label: "Alle" },
  { wert: "nicht-da", label: "Noch nicht da" },
  { wert: "schon-da", label: "Schon da" },
];

const TAB_OPTIONEN: { wert: TabWert; label: string }[] = [
  { wert: "gaeste", label: "Gästeliste" },
  { wert: "mitglieder", label: "JIM Mitglieder" },
];

type FormularStatus =
  | { offen: false }
  | { offen: true; gast?: GastMitId };

export default function Home() {
  const gaeste = useGaeste();
  const [tab, setTab] = useState<TabWert>("gaeste");
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<FilterWert>("alle");
  const [formular, setFormular] = useState<FormularStatus>({ offen: false });

  const sucheLower = suche.trim().toLowerCase();

  const gaesteImTab = useMemo(() => {
    const quelle = tab === "gaeste" ? "manuell" : "mitglied";
    return gaeste.filter((gast) => gast.quelle === quelle);
  }, [gaeste, tab]);

  const { gesamt, eingecheckt } = useMemo(() => {
    let gesamt = 0;
    let eingecheckt = 0;
    for (const gast of gaesteImTab) {
      gesamt += gesamtPersonen(gast);
      eingecheckt += eingecheckePersonen(gast);
    }
    return { gesamt, eingecheckt };
  }, [gaesteImTab]);

  const sichtbareGaeste = useMemo(() => {
    return gaesteImTab.filter((gast) => {
      if (!gastPasstZurSuche(gast, sucheLower)) return false;
      if (filter === "schon-da" && !istVollstaendigDa(gast)) return false;
      if (filter === "nicht-da" && istVollstaendigDa(gast)) return false;
      return true;
    });
  }, [gaesteImTab, sucheLower, filter]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold tracking-tight text-stone-900">
              Jazzfest
            </span>
            <VerbindungsIndikator />
          </div>
          <div className="flex items-center gap-2">
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

        <div className="flex gap-2">
          {TAB_OPTIONEN.map((option) => (
            <button
              key={option.wert}
              type="button"
              onClick={() => setTab(option.wert)}
              aria-pressed={tab === option.wert}
              className={`min-h-12 flex-1 rounded-md px-3 text-sm font-medium ${
                tab === option.wert
                  ? "bg-stone-900 text-stone-50"
                  : "border border-stone-300 text-stone-600"
              }`}
            >
              {option.label}
            </button>
          ))}
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
            {tab === "gaeste" ? "Keine Gäste gefunden." : "Keine Mitglieder gefunden."}
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

      {tab === "gaeste" && (
        <div className="fixed right-5 bottom-5 z-10 flex flex-col items-end gap-3">
          <Link
            href="/text-import"
            aria-label="Gäste aus Text einfügen"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-300 bg-white text-xl text-stone-700 shadow-lg hover:bg-stone-100"
          >
            ✎
          </Link>
          <button
            type="button"
            onClick={() => setFormular({ offen: true, gast: undefined })}
            aria-label="Gast hinzufügen"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-3xl text-stone-50 shadow-lg hover:bg-stone-800"
          >
            +
          </button>
        </div>
      )}

      {formular.offen && (
        <GastFormular
          gast={formular.gast}
          onClose={() => setFormular({ offen: false })}
        />
      )}
    </div>
  );
}
