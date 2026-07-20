import Papa from "papaparse";
import type { ImportZeile } from "@/lib/gaesteImport";

// Erkennt gängige Spaltenüberschriften für den Namen. Wird keine erkannt,
// gilt die erste Spalte als Name - die Vorschau (jede Zeile editierbar)
// fängt eine falsche Vermutung ab, bevor irgendetwas gespeichert wird.
const NACHNAME_SPALTE = /^nachname$/i;
const VORNAME_SPALTE = /^vorname$/i;
const VOLLNAME_SPALTE =
  /^(name|nachname,?\s*vorname|voller?\s*name|vollständiger name|mitglied)$/i;

function ermittleNamenAusZeile(
  headers: string[],
  zeile: Record<string, string>,
): string {
  const nachnameKey = headers.find((h) => NACHNAME_SPALTE.test(h.trim()));
  const vornameKey = headers.find((h) => VORNAME_SPALTE.test(h.trim()));
  if (nachnameKey && vornameKey) {
    const nachname = (zeile[nachnameKey] ?? "").trim();
    const vorname = (zeile[vornameKey] ?? "").trim();
    return [nachname, vorname].filter(Boolean).join(", ");
  }

  const vollnameKey = headers.find((h) => VOLLNAME_SPALTE.test(h.trim()));
  if (vollnameKey) {
    return (zeile[vollnameKey] ?? "").trim();
  }

  const ersteSpalte = headers[0];
  return (zeile[ersteSpalte] ?? "").trim();
}

export async function parseCsv(datei: File): Promise<ImportZeile[]> {
  const text = await datei.text();
  const ergebnis = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = ergebnis.meta.fields ?? [];

  return ergebnis.data
    .map((zeile) => ermittleNamenAusZeile(headers, zeile))
    .filter((name) => name.length > 0)
    .map((name, index) => ({
      id: `csv-${index}`,
      text: name,
      ausgewaehlt: true,
      markierungen: [],
    }));
}
