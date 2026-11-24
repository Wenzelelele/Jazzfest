import type { ImportMarkierung, ImportZeile } from "@/lib/gaesteImport";

// Reine Auswertelogik für den PDF-Import (ohne pdfjs), damit sie sich auch
// außerhalb des Browsers testen lässt.
//
// Mitgliederlisten sind meist Tabellen: Nachname | Vorname | Straße | PLZ |
// Ort | Telefon | ... | E-Mail. Statt ganze Textzeilen zu übernehmen (dann
// landen Adresse, Telefonnummer und E-Mail im Namen), werden die Spalten
// anhand der x-Positionen erkannt und nur die Namensspalten übernommen -
// das sind die Spalten ganz links, deren Inhalt aus Buchstaben besteht
// (keine Ziffern, kein @).

export interface PositionierterText {
  text: string;
  x: number;
  breite: number;
  y: number;
}

interface Zelle {
  text: string;
  x: number;
  ende: number;
}

interface Reihe {
  seite: number;
  y: number;
  zellen: Zelle[];
}

const Y_TOLERANZ = 3;
const SPALTEN_TOLERANZ = 4;

// Jedes Textstück einzeln behalten: in Tabellen ist ein Stück praktisch
// immer eine Zelle. Erst nach der Spaltenerkennung wird zusammengefügt -
// ein Zusammenfügen nach Abstand würde Zellen verkleben, wenn eine Spalte
// sehr knapp an der nächsten endet ("Dorte Lindum" + "Rotkäppchenstr.").
function zuReihen(seiten: PositionierterText[][]): Reihe[] {
  const reihen: Reihe[] = [];
  seiten.forEach((items, seite) => {
    const sortiert = items
      .filter((item) => item.text.trim().length > 0)
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const gruppen: PositionierterText[][] = [];
    for (const item of sortiert) {
      const letzte = gruppen[gruppen.length - 1];
      if (letzte && Math.abs(letzte[0].y - item.y) <= Y_TOLERANZ) {
        letzte.push(item);
      } else {
        gruppen.push([item]);
      }
    }
    for (const gruppe of gruppen) {
      reihen.push({
        seite,
        y: gruppe[0].y,
        zellen: [...gruppe]
          .sort((a, b) => a.x - b.x)
          .map((item) => ({
            text: item.text.replace(/\s+/g, " ").trim(),
            x: item.x,
            ende: item.x + item.breite,
          })),
      });
    }
  });
  return reihen;
}

// Fügt die Stücke einer Reihe zu lesbarem Text zusammen (Leerzeichen nur
// bei sichtbarer Lücke - manche PDFs zerlegen Wörter in Einzelteile).
function reihenText(zellen: Zelle[]): string {
  let text = "";
  let ende: number | null = null;
  for (const zelle of zellen) {
    if (ende !== null && zelle.x - ende > 1) text += " ";
    text += zelle.text;
    ende = zelle.ende;
  }
  return text.replace(/\s+/g, " ").trim();
}

// Spaltenanfänge: x-Positionen, an denen in vielen Reihen eine Zelle
// beginnt (linksbündige Tabellenspalten).
function findeSpalten(reihen: Reihe[]): number[] {
  const zaehler = new Map<number, number>();
  for (const reihe of reihen) {
    for (const zelle of reihe.zellen) {
      const x = Math.round(zelle.x);
      zaehler.set(x, (zaehler.get(x) ?? 0) + 1);
    }
  }
  // Benachbarte x-Werte zusammenfassen
  const xs = [...zaehler.keys()].sort((a, b) => a - b);
  const cluster: { x: number; anzahl: number }[] = [];
  for (const x of xs) {
    const letzter = cluster[cluster.length - 1];
    if (letzter && x - letzter.x <= SPALTEN_TOLERANZ) {
      letzter.anzahl += zaehler.get(x)!;
    } else {
      cluster.push({ x, anzahl: zaehler.get(x)! });
    }
  }
  const mindestens = Math.max(3, reihen.length * 0.25);
  return cluster.filter((c) => c.anzahl >= mindestens).map((c) => c.x);
}

function spalteVon(x: number, spalten: number[]): number {
  let index = -1;
  for (let i = 0; i < spalten.length; i++) {
    if (spalten[i] <= x + SPALTEN_TOLERANZ) index = i;
  }
  return index;
}

const ZIFFER_ODER_AT = /[0-9@]/;
// Buchstaben inkl. Umlaute/Akzente, dazu Bindestrich, Apostroph-Varianten,
// Punkt (Abkürzungen), Leerzeichen
const NAMENSZEICHEN = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ\s.'´`’\-]+$/;

function istNamensText(text: string): boolean {
  return !ZIFFER_ODER_AT.test(text) && NAMENSZEICHEN.test(text);
}

const SEITENZAHL_MUSTER =
  /^(-\s*)?(seite\s*)?\d+(\s*(\/|von)\s*\d+)?(\s*-)?$/i;

const SPALTENTITEL_MUSTER =
  /^(nachname,?\s*vorname|name,?\s*vorname|vorname,?\s*nachname|name|vorname|nachname|mitglied(snummer)?|mitglied\s*seit|status|nr\.?|lfd\.?\s*nr\.?)$/i;

function aufraeumen(name: string): string {
  return name
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.-]+|[\s,;-]+$/g, "")
    .trim();
}

interface NamensReihe {
  seite: number;
  y: number;
  teile: string[]; // ein Eintrag pro Namensspalte
  sonst: string[]; // Text außerhalb der Namensspalten (nur zur Erkennung)
}

function ausSpalten(reihen: Reihe[], spalten: number[]): ImportZeile[] | null {
  // Pro Spalte: Anteil der Zellen, die wie ein Name aussehen
  const proSpalte = spalten.map(() => ({ gesamt: 0, namen: 0 }));
  for (const reihe of reihen) {
    for (const zelle of reihe.zellen) {
      const i = spalteVon(zelle.x, spalten);
      if (i < 0) continue;
      proSpalte[i].gesamt++;
      if (istNamensText(zelle.text)) proSpalte[i].namen++;
    }
  }
  const namensSpalten: number[] = [];
  for (let i = 0; i < spalten.length && namensSpalten.length < 2; i++) {
    const { gesamt, namen } = proSpalte[i];
    if (gesamt > 0 && namen / gesamt >= 0.75) namensSpalten.push(i);
    else break;
  }
  if (namensSpalten.length === 0) return null;

  // Reihenfolge Nachname/Vorname aus einer Kopfzeile übernehmen, wenn es
  // eine gibt - sonst gilt: erste Spalte Nachname (übliche Sortierung).
  let vornameZuerst = false;

  const namensReihen: NamensReihe[] = [];
  for (const reihe of reihen) {
    const stuecke: Zelle[][] = namensSpalten.map(() => []);
    const sonst: string[] = [];
    for (const zelle of reihe.zellen) {
      const i = spalteVon(zelle.x, spalten);
      const pos = namensSpalten.indexOf(i);
      if (pos >= 0) stuecke[pos].push(zelle);
      else sonst.push(zelle.text);
    }
    const teile = stuecke.map(reihenText);
    if (teile.every((t) => t.length === 0)) continue;

    if (
      namensSpalten.length === 2 &&
      /^vorname$/i.test(teile[0]) &&
      /^(nach)?name$/i.test(teile[1])
    ) {
      vornameZuerst = true;
    }

    // Umbruch innerhalb einer Zelle ("Hanns-" / "Eberhardt"): Reihe ohne
    // erste Spalte direkt unter einer Namensreihe hängt an diese an.
    const vorher = namensReihen[namensReihen.length - 1];
    if (
      teile[0].length === 0 &&
      vorher &&
      vorher.seite === reihe.seite &&
      vorher.y - reihe.y < 16
    ) {
      teile.forEach((teil, i) => {
        if (!teil) return;
        const alt = vorher.teile[i];
        vorher.teile[i] = alt.endsWith("-") ? alt + teil : `${alt} ${teil}`.trim();
      });
      continue;
    }
    namensReihen.push({ seite: reihe.seite, y: reihe.y, teile, sonst });
  }

  return markiere(
    namensReihen.map((reihe) => {
      const teile = reihe.teile.map(aufraeumen);
      const roh = teile.filter(Boolean).join(" ");
      let text: string;
      if (teile.length === 2 && teile[0] && teile[1]) {
        const [nachname, vorname] = vornameZuerst
          ? [teile[1], teile[0]]
          : [teile[0], teile[1]];
        text = `${nachname}, ${vorname}`;
      } else {
        text = teile.filter(Boolean).join(" ");
      }
      return {
        seite: reihe.seite,
        text,
        pruefText: roh,
        istName: teile.every((t) => !t || istNamensText(t)),
      };
    }),
  );
}

// Fallback ohne erkennbare Tabelle: ganze Zeilen, aber ohne E-Mails,
// Telefonnummern, Adressen (alles mit Ziffern) und Webadressen.
function ausZeilen(reihen: Reihe[]): ImportZeile[] {
  return markiere(
    reihen
      .map((reihe) => {
        const roh = reihenText(reihe.zellen);
        const woerter = roh
          .split(/\s+/)
          .filter(
            (wort) =>
              !wort.includes("@") &&
              !/^(https?:|www\.)/i.test(wort) &&
              !/\d/.test(wort),
          );
        const text = aufraeumen(woerter.join(" "));
        return {
          seite: reihe.seite,
          text,
          pruefText: roh,
          istName: text.length > 0 && istNamensText(text),
        };
      })
      .filter((zeile) => zeile.text.length > 0 || zeile.pruefText.length > 0),
  );
}

interface Kandidat {
  seite: number;
  text: string;
  pruefText: string;
  istName: boolean;
}

function markiere(kandidaten: Kandidat[]): ImportZeile[] {
  // Zeilen, die identisch auf mehreren Seiten vorkommen, sind sehr
  // wahrscheinlich Kopf-/Fußzeilen.
  const seitenProText = new Map<string, Set<number>>();
  for (const k of kandidaten) {
    const key = k.pruefText.toLowerCase();
    if (!seitenProText.has(key)) seitenProText.set(key, new Set());
    seitenProText.get(key)!.add(k.seite);
  }

  return kandidaten
    .filter((k) => k.text.length > 0)
    .map((k, index) => {
      const markierungen: ImportMarkierung[] = [];
      const wiederholt =
        (seitenProText.get(k.pruefText.toLowerCase())?.size ?? 0) > 1;
      if (SEITENZAHL_MUSTER.test(k.pruefText)) {
        markierungen.push("seitenzahl");
      } else if (
        SPALTENTITEL_MUSTER.test(k.pruefText) ||
        k.pruefText
          .split(/\s+/)
          .every((wort) => SPALTENTITEL_MUSTER.test(wort.replace(/,$/, "")))
      ) {
        markierungen.push("spaltentitel");
      } else if (!k.istName) {
        markierungen.push(wiederholt ? "kopf-fusszeile" : "kein-name");
      } else if (wiederholt && !k.text.includes(",")) {
        markierungen.push("kopf-fusszeile");
      }
      return {
        id: `pdf-${index}`,
        text: k.text,
        ausgewaehlt: markierungen.length === 0,
        markierungen,
      };
    });
}

export function namenAusPdfText(seiten: PositionierterText[][]): ImportZeile[] {
  const reihen = zuReihen(seiten);
  const spalten = findeSpalten(reihen);
  if (spalten.length >= 2) {
    const ergebnis = ausSpalten(reihen, spalten);
    if (ergebnis && ergebnis.length > 0) return ergebnis;
  }
  return ausZeilen(reihen);
}
