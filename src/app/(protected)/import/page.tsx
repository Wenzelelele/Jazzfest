"use client";

import Link from "next/link";
import { NurAdmin } from "@/components/NurAdmin";
import { useMemo, useRef, useState } from "react";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { useGaeste } from "@/hooks/useGaeste";
import { parseCsv } from "@/lib/csvImport";
import {
  importiereAlsBatch,
  markiereDubletten,
  type ImportMarkierung,
  type ImportZeile,
} from "@/lib/gaesteImport";
import { parsePdf } from "@/lib/pdfImport";

const MARKIERUNG_LABEL: Record<ImportMarkierung, string> = {
  seitenzahl: "Seitenzahl",
  "kopf-fusszeile": "Kopf-/Fußzeile",
  spaltentitel: "Spaltentitel",
  dublette: "Bereits vorhanden",
};

type Status =
  | { schritt: "upload" }
  | { schritt: "lädt" }
  | { schritt: "vorschau" }
  | { schritt: "importiert"; anzahl: number };

function ImportSeiteInhalt() {
  const { aktivesEvent } = useEvents();
  const { beobachte } = useMeldung();
  const eventId = aktivesEvent?.id;
  const gaeste = useGaeste(eventId);
  const bestehendeNamenLower = useMemo(
    () => new Set(gaeste.map((gast) => gast.nameLower)),
    [gaeste],
  );

  const [status, setStatus] = useState<Status>({ schritt: "upload" });
  const [zeilen, setZeilen] = useState<ImportZeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const dateiInputRef = useRef<HTMLInputElement>(null);

  async function handleDateiAuswahl(datei: File) {
    setFehler(null);
    setStatus({ schritt: "lädt" });
    const istCsv = datei.name.toLowerCase().endsWith(".csv");
    try {
      const geparst = istCsv ? await parseCsv(datei) : await parsePdf(datei);
      setZeilen(markiereDubletten(geparst, bestehendeNamenLower));
      setStatus({ schritt: "vorschau" });
    } catch (err) {
      console.error(err);
      setFehler(
        istCsv
          ? "CSV konnte nicht gelesen werden."
          : "PDF konnte nicht gelesen werden. Ist es wirklich ein PDF mit auswählbarem Text?",
      );
      setStatus({ schritt: "upload" });
    }
  }

  function zeileAendern(id: string, aenderung: Partial<ImportZeile>) {
    setZeilen((bisherige) =>
      bisherige.map((zeile) =>
        zeile.id === id ? { ...zeile, ...aenderung } : zeile,
      ),
    );
  }

  function alleUmschalten(ausgewaehlt: boolean) {
    setZeilen((bisherige) => bisherige.map((zeile) => ({ ...zeile, ausgewaehlt })));
  }

  // Bewusst nicht auf den Batch-Commit warten - siehe Kommentar in
  // GastFormular.tsx: Firestores Schreib-Promise löst erst bei
  // Server-Bestätigung auf, offline würde das den Erfolgs-Screen
  // unbegrenzt blockieren, obwohl der Import lokal längst vorgemerkt ist.
  function handleImportBestaetigen() {
    setFehler(null);
    const anzahl = anzahlAusgewaehlt;
    if (!eventId) {
      setFehler("Kein Event ausgewählt.");
      return;
    }
    beobachte(
      importiereAlsBatch(eventId, zeilen),
      "Import konnte nicht gespeichert werden.",
    );
    setStatus({ schritt: "importiert", anzahl });
  }

  function zurueckZumUpload() {
    setZeilen([]);
    setStatus({ schritt: "upload" });
    if (dateiInputRef.current) dateiInputRef.current.value = "";
  }

  const anzahlAusgewaehlt = zeilen.filter((zeile) => zeile.ausgewaehlt).length;

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
          Mitgliederliste importieren
        </h1>
        {aktivesEvent && (
          <span className="ml-auto text-xs text-stone-500">
            {aktivesEvent.name}
          </span>
        )}
      </header>

      <main className="flex-1 p-4">
        {status.schritt === "upload" && (
          <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
            {!aktivesEvent && (
              <p className="text-sm text-red-700">
                Bitte zuerst unter <Link href="/events" className="underline">Events</Link> ein Event anlegen.
              </p>
            )}
            <p className="text-sm text-stone-500">
              PDF oder CSV mit der Mitgliederliste auswählen. Bei PDF muss der
              Text auswählbar sein (kein Scan).
            </p>
            <input
              ref={dateiInputRef}
              type="file"
              accept="application/pdf,.pdf,.csv,text/csv"
              onChange={(event) => {
                const datei = event.target.files?.[0];
                if (datei) handleDateiAuswahl(datei);
              }}
              className="min-h-12 w-full rounded-md border border-stone-300 bg-white p-2 text-sm text-stone-600 file:mr-3 file:min-h-12 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-50"
            />
            {fehler && (
              <p role="alert" className="text-sm text-red-700">
                {fehler}
              </p>
            )}

          </div>
        )}

        {status.schritt === "lädt" && (
          <p className="pt-8 text-center text-sm text-stone-500">
            Datei wird gelesen…
          </p>
        )}

        {status.schritt === "vorschau" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
              <p className="text-sm text-stone-600">
                <span className="font-semibold text-stone-900">
                  {anzahlAusgewaehlt}
                </span>{" "}
                von {zeilen.length} Zeilen ausgewählt
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alleUmschalten(true)}
                  className="min-h-12 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
                >
                  Alle auswählen
                </button>
                <button
                  type="button"
                  onClick={() => alleUmschalten(false)}
                  className="min-h-12 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
                >
                  Keine auswählen
                </button>
              </div>
            </div>

            <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
              {zeilen.map((zeile) => (
                <li
                  key={zeile.id}
                  className={`flex items-center gap-3 p-3 ${
                    zeile.markierungen.length > 0 ? "bg-stone-100" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={zeile.ausgewaehlt}
                    onChange={(event) =>
                      zeileAendern(zeile.id, { ausgewaehlt: event.target.checked })
                    }
                    className="h-6 w-6 shrink-0 accent-stone-900"
                    aria-label={`${zeile.text} importieren`}
                  />
                  <input
                    type="text"
                    value={zeile.text}
                    onChange={(event) =>
                      zeileAendern(zeile.id, { text: event.target.value })
                    }
                    className="min-h-12 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm text-stone-900 outline-none focus:border-stone-500"
                  />
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {zeile.markierungen.map((markierung) => (
                      <span
                        key={markierung}
                        className={`rounded px-2 py-1 text-xs ${
                          markierung === "dublette"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {MARKIERUNG_LABEL[markierung]}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            {fehler && (
              <p role="alert" className="text-sm text-red-700">
                {fehler}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumUpload}
                className="min-h-12 flex-1 rounded-md border border-stone-300 text-stone-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleImportBestaetigen}
                disabled={anzahlAusgewaehlt === 0}
                className="min-h-12 flex-1 rounded-md bg-stone-900 font-medium text-stone-50 disabled:opacity-60"
              >
                {`${anzahlAusgewaehlt} Gäste importieren`}
              </button>
            </div>
          </div>
        )}

        {status.schritt === "importiert" && (
          <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
            <p className="text-stone-900">
              {status.anzahl}{" "}
              {status.anzahl === 1 ? "Gast wurde" : "Gäste wurden"}{" "}
              importiert.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumUpload}
                className="min-h-12 flex-1 rounded-md border border-stone-300 text-stone-700"
              >
                Weitere Datei importieren
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

export default function ImportSeite() {
  return (
    <NurAdmin>
      <ImportSeiteInhalt />
    </NurAdmin>
  );
}
