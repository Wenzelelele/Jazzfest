"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGaeste } from "@/hooks/useGaeste";
import { erstelleGast } from "@/lib/gaeste";
import {
  markiereMoeglicheDubletten,
  parseGaesteText,
  type TextGruppe,
} from "@/lib/textImport";

type Status =
  | { schritt: "einfuegen" }
  | { schritt: "vorschau" }
  | { schritt: "angelegt"; anzahl: number };

export default function TextImportSeite() {
  const gaeste = useGaeste();
  const bestehendeNamenLower = useMemo(
    () => new Set(gaeste.map((gast) => gast.nameLower)),
    [gaeste],
  );

  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ schritt: "einfuegen" });
  const [gruppen, setGruppen] = useState<TextGruppe[]>([]);

  function handleParsen() {
    const geparst = parseGaesteText(text);
    setGruppen(markiereMoeglicheDubletten(geparst, bestehendeNamenLower));
    setStatus({ schritt: "vorschau" });
  }

  function gruppeAendern(id: string, aenderung: Partial<TextGruppe>) {
    setGruppen((bisherige) =>
      bisherige.map((gruppe) =>
        gruppe.id === id ? { ...gruppe, ...aenderung } : gruppe,
      ),
    );
  }

  function begleitungNameAendern(gruppeId: string, index: number, wert: string) {
    setGruppen((bisherige) =>
      bisherige.map((gruppe) => {
        if (gruppe.id !== gruppeId) return gruppe;
        const begleitungNamen = gruppe.begleitungNamen.map((name, i) =>
          i === index ? wert : name,
        );
        return { ...gruppe, begleitungNamen };
      }),
    );
  }

  function begleitungHinzufuegen(gruppeId: string) {
    setGruppen((bisherige) =>
      bisherige.map((gruppe) =>
        gruppe.id === gruppeId
          ? { ...gruppe, begleitungNamen: [...gruppe.begleitungNamen, ""] }
          : gruppe,
      ),
    );
  }

  function begleitungEntfernen(gruppeId: string, index: number) {
    setGruppen((bisherige) =>
      bisherige.map((gruppe) =>
        gruppe.id === gruppeId
          ? {
              ...gruppe,
              begleitungNamen: gruppe.begleitungNamen.filter(
                (_, i) => i !== index,
              ),
            }
          : gruppe,
      ),
    );
  }

  // Bewusst nicht auf die einzelnen Schreibvorgänge warten - siehe
  // Kommentar in GastFormular.tsx: offline würde ein await hier den
  // Erfolgs-Screen unbegrenzt blockieren.
  function handleUebernehmen() {
    const ausgewaehlte = gruppen.filter(
      (gruppe) => gruppe.ausgewaehlt && gruppe.hauptgast.trim().length > 0,
    );
    for (const gruppe of ausgewaehlte) {
      erstelleGast({
        name: gruppe.hauptgast.trim(),
        begleitungNamen: gruppe.begleitungNamen,
        quelle: "manuell",
      }).catch(console.error);
    }
    setStatus({ schritt: "angelegt", anzahl: ausgewaehlte.length });
  }

  function zurueckZumEinfuegen() {
    setText("");
    setGruppen([]);
    setStatus({ schritt: "einfuegen" });
  }

  const anzahlAusgewaehlt = gruppen.filter((g) => g.ausgewaehlt).length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <Link
          href="/"
          className="min-h-12 rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
        <h1 className="font-display text-lg font-semibold text-stone-900">
          Gäste aus Text einfügen
        </h1>
      </header>

      <main className="flex-1 p-4">
        {status.schritt === "einfuegen" && (
          <div className="mx-auto max-w-lg space-y-4">
            <p className="text-sm text-stone-500">
              Text einfügen (z. B. aus WhatsApp), eine Gäste-Gruppe pro Zeile.
              Format: <span className="font-mono">Gäste von Peter, Hans,
              Jürgen, Frank +1</span> - der erste Name wird zum Hauptgast, die
              übrigen zu Begleitpersonen, „+1&rdquo; fügt eine unbenannte
              Begleitperson hinzu.
            </p>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder={"Gäste von Peter, Hans, Jürgen, Frank +1\nGäste von Maria, Tom +2"}
              className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-900 outline-none focus:border-stone-500"
            />
            <button
              type="button"
              onClick={handleParsen}
              disabled={text.trim().length === 0}
              className="min-h-12 w-full rounded-md bg-stone-900 font-medium text-stone-50 disabled:opacity-60"
            >
              Text einlesen
            </button>
          </div>
        )}

        {status.schritt === "vorschau" && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              <span className="font-semibold text-stone-900">
                {anzahlAusgewaehlt}
              </span>{" "}
              von {gruppen.length} Gruppen ausgewählt
            </p>

            {gruppen.length === 0 && (
              <p className="text-sm text-stone-500">
                Keine Gruppe erkannt. Zurück und Text prüfen.
              </p>
            )}

            <div className="space-y-3">
              {gruppen.map((gruppe) => (
                <div
                  key={gruppe.id}
                  className="space-y-3 rounded-md border border-stone-200 bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={gruppe.ausgewaehlt}
                      onChange={(event) =>
                        gruppeAendern(gruppe.id, {
                          ausgewaehlt: event.target.checked,
                        })
                      }
                      className="mt-3 h-6 w-6 shrink-0 accent-stone-900"
                      aria-label={`${gruppe.hauptgast || "Gruppe"} übernehmen`}
                    />
                    <div className="flex-1 space-y-2">
                      <p className="text-xs text-stone-400">
                        „{gruppe.rohtext}&rdquo;
                      </p>
                      <input
                        type="text"
                        value={gruppe.hauptgast}
                        onChange={(event) =>
                          gruppeAendern(gruppe.id, {
                            hauptgast: event.target.value,
                          })
                        }
                        placeholder="Hauptgast"
                        className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
                      />
                      {gruppe.moeglicheDublette && (
                        <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                          Möglicherweise schon in der Liste
                        </span>
                      )}
                    </div>
                  </div>

                  {gruppe.begleitungNamen.length > 0 && (
                    <div className="space-y-2 pl-9">
                      {gruppe.begleitungNamen.map((name, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={name}
                            onChange={(event) =>
                              begleitungNameAendern(
                                gruppe.id,
                                index,
                                event.target.value,
                              )
                            }
                            placeholder={`Begleitung ${index + 1} (optional, sonst +${index + 1})`}
                            className="min-h-10 flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-stone-500"
                          />
                          <button
                            type="button"
                            onClick={() => begleitungEntfernen(gruppe.id, index)}
                            aria-label={`Begleitung ${index + 1} entfernen`}
                            className="min-h-10 min-w-10 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => begleitungHinzufuegen(gruppe.id)}
                    className="ml-9 min-h-10 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
                  >
                    + Begleitung hinzufügen
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumEinfuegen}
                className="min-h-12 flex-1 rounded-md border border-stone-300 text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleUebernehmen}
                disabled={anzahlAusgewaehlt === 0}
                className="min-h-12 flex-1 rounded-md bg-stone-900 font-medium text-stone-50 disabled:opacity-60"
              >
                {`${anzahlAusgewaehlt} Gäste anlegen`}
              </button>
            </div>
          </div>
        )}

        {status.schritt === "angelegt" && (
          <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
            <p className="text-stone-900">
              {status.anzahl}{" "}
              {status.anzahl === 1 ? "Gast wurde" : "Gäste wurden"} angelegt.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumEinfuegen}
                className="min-h-12 flex-1 rounded-md border border-stone-300 text-stone-700"
              >
                Weiteren Text einfügen
              </button>
              <Link
                href="/"
                className="flex min-h-12 flex-1 items-center justify-center rounded-md bg-stone-900 font-medium text-stone-50"
              >
                Zur Gästeliste
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
