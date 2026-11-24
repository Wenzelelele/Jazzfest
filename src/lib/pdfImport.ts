import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { ImportZeile } from "@/lib/gaesteImport";
import { namenAusPdfText, type PositionierterText } from "@/lib/pdfNamen";

// pdfjs-dist wird bewusst per dynamischem Import erst zur Laufzeit im
// Browser geladen (nicht als statischer Top-Level-Import): das Parsing muss
// clientseitig laufen, und ein Top-Level-Import würde das Modul auch beim
// Next.js-Prerendering serverseitig unter Node auswerten.
async function ladePdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Der Worker liegt als statische Datei in public/ (kopiert aus
  // node_modules/pdfjs-dist/build/pdf.worker.min.mjs) - beim Aktualisieren
  // von pdfjs-dist muss diese Datei erneut kopiert werden, sonst driften
  // Version von API und Worker auseinander.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

async function extrahiereSeiten(
  datei: File,
): Promise<PositionierterText[][]> {
  const pdfjsLib = await ladePdfJs();
  const buffer = await datei.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const seiten: PositionierterText[][] = [];

  for (let seitenNummer = 1; seitenNummer <= pdf.numPages; seitenNummer++) {
    const seite = await pdf.getPage(seitenNummer);
    const inhalt = await seite.getTextContent();
    const items: PositionierterText[] = inhalt.items
      .filter((item): item is TextItem => "str" in item && "transform" in item)
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        breite: item.width,
      }));
    seiten.push(items);
  }

  return seiten;
}

export async function parsePdf(datei: File): Promise<ImportZeile[]> {
  return namenAusPdfText(await extrahiereSeiten(datei));
}
