import type { TextItem } from "pdfjs-dist/types/src/display/api";
import {
  doc,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { gaesteCollectionRef, nameLowerVon } from "@/lib/gaeste";

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

export type ImportMarkierung =
  | "seitenzahl"
  | "kopf-fusszeile"
  | "spaltentitel"
  | "dublette";

export interface ImportZeile {
  id: string;
  text: string;
  ausgewaehlt: boolean;
  markierungen: ImportMarkierung[];
}

interface PositionierterText {
  text: string;
  x: number;
  breite: number;
  y: number;
}

const Y_TOLERANZ = 2;
const X_LUECKE_FUER_LEERZEICHEN = 1;

function zuZeilen(items: PositionierterText[]): string[] {
  if (items.length === 0) return [];

  const sortiert = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const zeilenGruppen: PositionierterText[][] = [[sortiert[0]]];

  for (let i = 1; i < sortiert.length; i++) {
    const item = sortiert[i];
    const aktuelleGruppe = zeilenGruppen[zeilenGruppen.length - 1];
    const vorherigesY = aktuelleGruppe[aktuelleGruppe.length - 1].y;
    if (Math.abs(item.y - vorherigesY) <= Y_TOLERANZ) {
      aktuelleGruppe.push(item);
    } else {
      zeilenGruppen.push([item]);
    }
  }

  return zeilenGruppen
    .map((gruppe) => {
      const nachXSortiert = [...gruppe].sort((a, b) => a.x - b.x);
      let text = "";
      let vorherigesEnde: number | null = null;
      for (const item of nachXSortiert) {
        if (
          vorherigesEnde !== null &&
          item.x - vorherigesEnde > X_LUECKE_FUER_LEERZEICHEN
        ) {
          text += " ";
        }
        text += item.text;
        vorherigesEnde = item.x + item.breite;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter((zeile) => zeile.length > 0);
}

async function extrahiereSeiten(datei: File): Promise<string[][]> {
  const pdfjsLib = await ladePdfJs();
  const buffer = await datei.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const seiten: string[][] = [];

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
    seiten.push(zuZeilen(items));
  }

  return seiten;
}

const SEITENZAHL_MUSTER = /^(-\s*)?(seite\s*)?\d+(\s*(\/|von)\s*\d+)?(\s*-)?$/i;

const SPALTENTITEL_MUSTER =
  /^(nachname,?\s*vorname|name,?\s*vorname|vorname,?\s*nachname|name|vorname|nachname|mitglied(snummer)?|mitglied\s*seit|status|nr\.?|lfd\.?\s*nr\.?)$/i;

// Grobes Muster für "Nachname, Vorname" (auch Doppelnamen/mehrere Vornamen).
// Dient dazu, echte Namen von der Kopf-/Fußzeilen-Heuristik auszunehmen: ein
// Name, der zufällig zweimal in der Liste vorkommt, soll als Dublette
// erkannt werden, nicht als wiederkehrende Kopfzeile verschwinden.
const PERSONENNAME_MUSTER =
  /^[A-ZÄÖÜ][a-zäöüß]+(-[A-ZÄÖÜ][a-zäöüß]+)?,\s*[A-ZÄÖÜ][a-zäöüß]+(-[A-ZÄÖÜ][a-zäöüß]+)?(\s+[A-ZÄÖÜ][a-zäöüß]+)*$/;

function istSeitenzahl(zeile: string): boolean {
  return SEITENZAHL_MUSTER.test(zeile.trim());
}

function istSpaltentitel(zeile: string): boolean {
  return SPALTENTITEL_MUSTER.test(zeile.trim());
}

function siehtWiePersonennameAus(zeile: string): boolean {
  return PERSONENNAME_MUSTER.test(zeile.trim());
}

export async function parsePdf(datei: File): Promise<ImportZeile[]> {
  const seiten = await extrahiereSeiten(datei);

  // Zeilen, die identisch auf mehreren Seiten vorkommen, sind sehr
  // wahrscheinlich Kopf-/Fußzeilen (echte Namen wiederholen sich nicht
  // Zeichen für Zeichen auf verschiedenen Seiten).
  const seitenProZeile = new Map<string, Set<number>>();
  seiten.forEach((zeilen, seitenIndex) => {
    for (const zeile of zeilen) {
      const key = zeile.toLowerCase();
      if (!seitenProZeile.has(key)) seitenProZeile.set(key, new Set());
      seitenProZeile.get(key)!.add(seitenIndex);
    }
  });

  const ergebnis: ImportZeile[] = [];
  seiten.forEach((zeilen, seitenIndex) => {
    zeilen.forEach((zeile, zeilenIndex) => {
      const markierungen: ImportMarkierung[] = [];
      const wiederholtSichAufMehrerenSeiten =
        (seitenProZeile.get(zeile.toLowerCase())?.size ?? 0) > 1;

      if (istSeitenzahl(zeile)) {
        markierungen.push("seitenzahl");
      } else if (istSpaltentitel(zeile)) {
        markierungen.push("spaltentitel");
      } else if (
        wiederholtSichAufMehrerenSeiten &&
        !siehtWiePersonennameAus(zeile)
      ) {
        markierungen.push("kopf-fusszeile");
      }

      ergebnis.push({
        id: `${seitenIndex}-${zeilenIndex}`,
        text: zeile,
        ausgewaehlt: markierungen.length === 0,
        markierungen,
      });
    });
  });

  return ergebnis;
}

// Markiert Zeilen als Dublette, wenn ihr normalisierter Name bereits unter
// bestehenden Gästen vorkommt ODER schon weiter oben in derselben Liste
// auftaucht (z. B. wenn dieselbe PDF-Liste ein zweites Mal importiert wird).
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
  zeilen: ImportZeile[],
): Promise<number> {
  const ausgewaehlteNamen = zeilen
    .filter((zeile) => zeile.ausgewaehlt && zeile.text.trim().length > 0)
    .map((zeile) => zeile.text.trim());

  for (let start = 0; start < ausgewaehlteNamen.length; start += BATCH_GROESSE) {
    const stapel = ausgewaehlteNamen.slice(start, start + BATCH_GROESSE);
    const batch = writeBatch(db);
    for (const name of stapel) {
      const ref = doc(gaesteCollectionRef());
      batch.set(ref, {
        name,
        nameLower: nameLowerVon(name),
        quelle: "mitglied",
        notiz: "",
        checkedIn: false,
        checkedInAt: null,
        begleitung: {},
        erstelltAm: serverTimestamp() as unknown as Timestamp,
      });
    }
    await batch.commit();
  }

  return ausgewaehlteNamen.length;
}
