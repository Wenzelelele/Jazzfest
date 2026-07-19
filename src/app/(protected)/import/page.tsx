"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useGaeste } from "@/hooks/useGaeste";
import {
  importiereAlsBatch,
  markiereDubletten,
  parsePdf,
  type ImportMarkierung,
  type ImportZeile,
} from "@/lib/pdfImport";

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

export default function ImportSeite() {
  const gaeste = useGaeste();
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
    try {
      const geparst = await parsePdf(datei);
      setZeilen(markiereDubletten(geparst, bestehendeNamenLower));
      setStatus({ schritt: "vorschau" });
    } catch (err) {
      console.error(err);
      setFehler(
        "PDF konnte nicht gelesen werden. Ist es wirklich ein PDF mit auswählbarem Text?",
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
    importiereAlsBatch(zeilen).catch(console.error);
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
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 p-4">
        <Link
          href="/"
          className="min-h-10 rounded-md px-2 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          ← Zurück
        </Link>
        <h1 className="text-lg font-semibold text-zinc-50">
          Mitgliederliste importieren
        </h1>
      </header>

      <main className="flex-1 p-4">
        {status.schritt === "upload" && (
          <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
            <p className="text-sm text-zinc-400">
              PDF mit der Mitgliederliste auswählen. Der Text muss im PDF
              auswählbar sein (kein Scan).
            </p>
            <input
              ref={dateiInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                const datei = event.target.files?.[0];
                if (datei) handleDateiAuswahl(datei);
              }}
              className="min-h-12 w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-300 file:mr-3 file:min-h-10 file:rounded-md file:border-0 file:bg-zinc-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
            />
            {fehler && (
              <p role="alert" className="text-sm text-red-400">
                {fehler}
              </p>
            )}
          </div>
        )}

        {status.schritt === "lädt" && (
          <p className="pt-8 text-center text-sm text-zinc-400">
            PDF wird gelesen…
          </p>
        )}

        {status.schritt === "vorschau" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-sm text-zinc-300">
                <span className="font-semibold text-zinc-50">
                  {anzahlAusgewaehlt}
                </span>{" "}
                von {zeilen.length} Zeilen ausgewählt
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alleUmschalten(true)}
                  className="min-h-10 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Alle auswählen
                </button>
                <button
                  type="button"
                  onClick={() => alleUmschalten(false)}
                  className="min-h-10 rounded-md border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Keine auswählen
                </button>
              </div>
            </div>

            <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
              {zeilen.map((zeile) => (
                <li
                  key={zeile.id}
                  className={`flex items-center gap-3 p-3 ${
                    zeile.markierungen.length > 0 ? "bg-zinc-900/40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={zeile.ausgewaehlt}
                    onChange={(event) =>
                      zeileAendern(zeile.id, { ausgewaehlt: event.target.checked })
                    }
                    className="h-6 w-6 shrink-0 accent-zinc-50"
                    aria-label={`${zeile.text} importieren`}
                  />
                  <input
                    type="text"
                    value={zeile.text}
                    onChange={(event) =>
                      zeileAendern(zeile.id, { text: event.target.value })
                    }
                    className="min-h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-50 outline-none focus:border-zinc-400"
                  />
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {zeile.markierungen.map((markierung) => (
                      <span
                        key={markierung}
                        className={`rounded px-2 py-1 text-xs ${
                          markierung === "dublette"
                            ? "bg-amber-900 text-amber-100"
                            : "bg-zinc-800 text-zinc-400"
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
              <p role="alert" className="text-sm text-red-400">
                {fehler}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumUpload}
                className="min-h-12 flex-1 rounded-md border border-zinc-700 text-zinc-200"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleImportBestaetigen}
                disabled={anzahlAusgewaehlt === 0}
                className="min-h-12 flex-1 rounded-md bg-zinc-50 font-medium text-zinc-950 disabled:opacity-60"
              >
                {`${anzahlAusgewaehlt} Gäste importieren`}
              </button>
            </div>
          </div>
        )}

        {status.schritt === "importiert" && (
          <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
            <p className="text-zinc-50">
              {status.anzahl}{" "}
              {status.anzahl === 1 ? "Gast wurde" : "Gäste wurden"}{" "}
              importiert.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={zurueckZumUpload}
                className="min-h-12 flex-1 rounded-md border border-zinc-700 text-zinc-200"
              >
                Weitere PDF importieren
              </button>
              <Link
                href="/"
                className="flex min-h-12 flex-1 items-center justify-center rounded-md bg-zinc-50 font-medium text-zinc-950"
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
