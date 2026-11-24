import {
  doc,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gaesteCollectionRef, nameLowerVon } from "@/lib/gaeste";

// Gemeinsame Vorschau-/Dubletten-/Batch-Write-Logik für alle Importquellen
// (PDF, CSV, ...) - jede Quelle liefert nur eine flache Liste von
// ImportZeile, alles danach (Bearbeiten, Dublettenprüfung, Bestätigung,
// Batch-Write) läuft identisch.

export type ImportMarkierung =
  | "seitenzahl"
  | "kopf-fusszeile"
  | "spaltentitel"
  | "kein-name"
  | "dublette";

export interface ImportZeile {
  id: string;
  text: string;
  ausgewaehlt: boolean;
  markierungen: ImportMarkierung[];
}

// Markiert Zeilen als Dublette, wenn ihr normalisierter Name bereits unter
// bestehenden Gästen vorkommt ODER schon weiter oben in derselben Liste
// auftaucht (z. B. wenn dieselbe Liste ein zweites Mal importiert wird).
// Dubletten werden standardmäßig abgewählt, damit ein wiederholter Import
// keine doppelten Einträge anlegt.
export function markiereDubletten(
  zeilen: ImportZeile[],
  bestehendeNamenLower: ReadonlySet<string>,
): ImportZeile[] {
  const bereitsGesehen = new Set<string>();
  return zeilen.map((zeile) => {
    if (zeile.markierungen.length > 0) return zeile;

    const normalisiert = nameLowerVon(zeile.text);
    const istDublette =
      bestehendeNamenLower.has(normalisiert) || bereitsGesehen.has(normalisiert);
    bereitsGesehen.add(normalisiert);

    if (!istDublette) return zeile;
    return {
      ...zeile,
      ausgewaehlt: false,
      markierungen: ["dublette"],
    };
  });
}

const BATCH_GROESSE = 450; // Firestore erlaubt maximal 500 Schreibvorgänge pro Batch

export async function importiereAlsBatch(
  eventId: string,
  zeilen: ImportZeile[],
): Promise<number> {
  const ausgewaehlteNamen = zeilen
    .filter((zeile) => zeile.ausgewaehlt && zeile.text.trim().length > 0)
    .map((zeile) => zeile.text.trim());

  for (let start = 0; start < ausgewaehlteNamen.length; start += BATCH_GROESSE) {
    const stapel = ausgewaehlteNamen.slice(start, start + BATCH_GROESSE);
    const batch = writeBatch(db);
    for (const name of stapel) {
      const ref = doc(gaesteCollectionRef(eventId));
      batch.set(ref, {
        name,
        nameLower: nameLowerVon(name),
        quelle: "mitglied",
        notiz: "",
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
        begleitung: {},
        erstelltAm: serverTimestamp() as unknown as Timestamp,
      });
    }
    await batch.commit();
  }

  return ausgewaehlteNamen.length;
}
