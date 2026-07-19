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
  const [speichert, setSpeichert] = useState(false);
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false);
  const [loescht, setLoescht] = useState(false);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nameGetrimmt = name.trim();
    if (!nameGetrimmt) {
      setFehler("Bitte einen Namen eingeben.");
      return;
    }
    setFehler(null);
    setSpeichert(true);
    try {
      if (bearbeitenModus) {
        await aktualisiereGast(gast.id, gast, {
          name: nameGetrimmt,
          notiz: notiz.trim(),
          begleitungNamen,
        });
      } else {
        await erstelleGast({
          name: nameGetrimmt,
          notiz: notiz.trim(),
          begleitungNamen,
          quelle: "manuell",
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setFehler("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setSpeichert(false);
    }
  }

  async function handleLoeschen() {
    if (!gast) return;
    setLoescht(true);
    try {
      await loescheGast(gast.id);
      onClose();
    } catch (err) {
      console.error(err);
      setFehler("Löschen fehlgeschlagen. Bitte erneut versuchen.");
      setLoescht(false);
      setLoeschenBestaetigen(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gast-formular-titel"
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-lg border border-zinc-800 bg-zinc-900 p-5 sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="gast-formular-titel" className="text-lg font-semibold text-zinc-50">
            {bearbeitenModus ? "Gast bearbeiten" : "Gast hinzufügen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="min-h-10 min-w-10 rounded-md text-xl text-zinc-400 hover:bg-zinc-800"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="gast-name" className="text-sm text-zinc-300">
              Name
            </label>
            <input
              id="gast-name"
              type="text"
              placeholder="Nachname, Vorname"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50 outline-none focus:border-zinc-400"
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm text-zinc-300">Begleitpersonen</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  anzahlAendern(Math.max(0, begleitungNamen.length - 1))
                }
                disabled={begleitungNamen.length === 0}
                className="min-h-12 min-w-12 rounded-md border border-zinc-700 text-xl text-zinc-200 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center text-lg text-zinc-50">
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
                className="min-h-12 min-w-12 rounded-md border border-zinc-700 text-xl text-zinc-200 disabled:opacity-40"
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
                    className="min-h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="gast-notiz" className="text-sm text-zinc-300">
              Notiz (optional)
            </label>
            <input
              id="gast-notiz"
              type="text"
              value={notiz}
              onChange={(event) => setNotiz(event.target.value)}
              className="min-h-12 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-zinc-50 outline-none focus:border-zinc-400"
            />
          </div>

          {fehler && (
            <p role="alert" className="text-sm text-red-400">
              {fehler}
            </p>
          )}

          <button
            type="submit"
            disabled={speichert}
            className="min-h-12 w-full rounded-md bg-zinc-50 px-5 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          >
            {speichert ? "Speichern…" : "Speichern"}
          </button>
        </form>

        {bearbeitenModus && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            {loeschenBestaetigen ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-300">
                  {gast.name} wirklich löschen? Das kann nicht rückgängig
                  gemacht werden.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setLoeschenBestaetigen(false)}
                    className="min-h-12 flex-1 rounded-md border border-zinc-700 text-zinc-200"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleLoeschen}
                    disabled={loescht}
                    className="min-h-12 flex-1 rounded-md bg-red-900 text-red-100 disabled:opacity-60"
                  >
                    {loescht ? "Löscht…" : "Endgültig löschen"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoeschenBestaetigen(true)}
                className="min-h-12 w-full rounded-md border border-red-900 text-sm text-red-400"
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
