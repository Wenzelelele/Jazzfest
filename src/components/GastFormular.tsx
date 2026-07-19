"use client";

import { useState, type FormEvent } from "react";
import {
  aktualisiereGast,
  erstelleGast,
  loescheGast,
  sortiereBegleitungKeys,
  type GastMitId,
} from "@/lib/gaeste";

const MAX_BEGLEITUNG = 5;

interface GastFormularProps {
  gast?: GastMitId;
  onClose: () => void;
}

export function GastFormular({ gast, onClose }: GastFormularProps) {
  const bearbeitenModus = gast !== undefined;
  const [name, setName] = useState(gast?.name ?? "");
  const [notiz, setNotiz] = useState(gast?.notiz ?? "");
  const [begleitungNamen, setBegleitungNamen] = useState<string[]>(() => {
    if (!gast) return [];
    return sortiereBegleitungKeys(gast.begleitung).map(
      (key) => gast.begleitung[key].name,
    );
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false);

  function anzahlAendern(neueAnzahl: number) {
    setBegleitungNamen((bisherige) => {
      const kopie = bisherige.slice(0, neueAnzahl);
      while (kopie.length < neueAnzahl) kopie.push("");
      return kopie;
    });
  }

  function begleitungNameAendern(index: number, wert: string) {
    setBegleitungNamen((bisherige) =>
      bisherige.map((name, i) => (i === index ? wert : name)),
    );
  }

  // Bewusst nicht auf den Schreibvorgang warten (kein await): Firestores
  // Schreib-Promises lösen erst bei Server-Bestätigung auf, nicht beim
  // lokalen Cache-Schreiben. Offline würde ein await hier das Formular
  // auf unbestimmte Zeit an "Speichert…" hängen lassen, obwohl der Gast
  // dank persistentLocalCache längst optimistisch in der Liste erscheint.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nameGetrimmt = name.trim();
    if (!nameGetrimmt) {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    if (bearbeitenModus) {
      aktualisiereGast(gast.id, gast, {
        name: nameGetrimmt,
        notiz: notiz.trim(),
        begleitungNamen,
      }).catch(console.error);
    } else {
      erstelleGast({
        name: nameGetrimmt,
        notiz: notiz.trim(),
        begleitungNamen,
        quelle: "manuell",
      }).catch(console.error);
    }
    onClose();
  }

  function handleLoeschen() {
    if (!gast) return;
    loescheGast(gast.id).catch(console.error);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gast-formular-titel"
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-lg border border-stone-200 bg-white p-5 shadow-lg sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="gast-formular-titel"
            className="font-display text-lg font-semibold text-stone-900"
          >
            {bearbeitenModus ? "Gast bearbeiten" : "Gast hinzufügen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="min-h-12 min-w-12 rounded-md text-xl text-stone-400 hover:bg-stone-100"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="gast-name" className="text-sm text-stone-600">
              Name
            </label>
            <input
              id="gast-name"
              type="text"
              placeholder="Nachname, Vorname"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm text-stone-600">Begleitpersonen</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  anzahlAendern(Math.max(0, begleitungNamen.length - 1))
                }
                disabled={begleitungNamen.length === 0}
                className="min-h-12 min-w-12 rounded-md border border-stone-300 text-xl text-stone-700 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-lg text-stone-900">
                {begleitungNamen.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  anzahlAendern(
                    Math.min(MAX_BEGLEITUNG, begleitungNamen.length + 1),
                  )
                }
                disabled={begleitungNamen.length >= MAX_BEGLEITUNG}
                className="min-h-12 min-w-12 rounded-md border border-stone-300 text-xl text-stone-700 disabled:opacity-40"
              >
                +
              </button>
            </div>

            {begleitungNamen.length > 0 && (
              <div className="space-y-2 pt-1">
                {begleitungNamen.map((begleitungName, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder={`Name Begleitung ${index + 1} (optional, sonst +${index + 1})`}
                    value={begleitungName}
                    onChange={(event) =>
                      begleitungNameAendern(index, event.target.value)
                    }
                    className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-stone-500"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="gast-notiz" className="text-sm text-stone-600">
              Notiz (optional)
            </label>
            <input
              id="gast-notiz"
              type="text"
              value={notiz}
              onChange={(event) => setNotiz(event.target.value)}
              className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
            />
          </div>

          {fehler && (
            <p role="alert" className="text-sm text-red-700">
              {fehler}
            </p>
          )}

          <button
            type="submit"
            className="min-h-12 w-full rounded-md bg-stone-900 px-5 font-medium text-stone-50 hover:bg-stone-800"
          >
            Speichern
          </button>
        </form>

        {bearbeitenModus && (
          <div className="mt-4 border-t border-stone-200 pt-4">
            {loeschenBestaetigen ? (
              <div className="space-y-2">
                <p className="text-sm text-stone-600">
                  {gast.name} wirklich löschen? Das kann nicht rückgängig
                  gemacht werden.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setLoeschenBestaetigen(false)}
                    className="min-h-12 flex-1 rounded-md border border-stone-300 text-stone-700"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleLoeschen}
                    className="min-h-12 flex-1 rounded-md bg-red-700 text-white"
                  >
                    Endgültig löschen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoeschenBestaetigen(true)}
                className="min-h-12 w-full rounded-md border border-red-300 text-sm text-red-700"
              >
                Gast löschen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
