// Parst locker formatierten, eingefügten Text (z. B. aus WhatsApp) in
// Gäste-Gruppen: eine Zeile mit erkennbarem Präfix ("Gästeliste X",
// "Gäste von X", ...) startet eine neue Gruppe mit X als Hauptgast. Jede
// Zeile danach, bis zur nächsten Kopfzeile, wird als weitere Begleitperson
// derselben Gruppe übernommen - unabhängig davon, ob mehrere Namen durch
// Komma in einer Zeile stehen oder jeweils auf einer eigenen Zeile.
//
// Beispiel (mehrzeilig, wie beim Kopieren aus WhatsApp üblich):
//   Gästeliste Fahd
//   Hans
//   Jürgen
// -> Hauptgast "Fahd", Begleitung "Hans", "Jürgen".
//
// Beispiel (einzeilig):
//   Gäste von Peter, Hans, Jürgen, Frank +1
// -> Hauptgast "Peter", Begleitung "Hans", "Jürgen", "Frank" + 1 unbenannte
// Person (aus dem "+1" hinter Frank).
//
// Das ist eine Heuristik für ein bekanntes, einfaches Format - keine
// generische Freitext-Erkennung. Die Vorschau vor dem Speichern erlaubt,
// jede Gruppe zu korrigieren.

export interface TextGruppe {
  id: string;
  ausgewaehlt: boolean;
  hauptgast: string;
  begleitungNamen: string[];
  rohtext: string;
  moeglicheDublette: boolean;
}

const HEADER_MUSTER =
  /^(gästeliste|gäste?\s+von|gast\s+von|guests?\s+of)\s*[:\-]?\s*/i;
const PLUS_ANZAHL_MUSTER = /^(.*?)\s*\+\s*(\d+)\s*$/;

function trenneePlusAnzahl(text: string): {
  name: string;
  zusatzAnzahl: number;
} {
  const treffer = text.match(PLUS_ANZAHL_MUSTER);
  if (treffer) {
    return { name: treffer[1].trim(), zusatzAnzahl: Number(treffer[2]) };
  }
  return { name: text.trim(), zusatzAnzahl: 0 };
}

// Zerlegt eine kommagetrennte Zeile in Begleitpersonen-Namen, "+N" erzeugt
// zusätzliche unbenannte Einträge.
function alsBegleitungNamen(text: string): string[] {
  const ergebnis: string[] = [];
  const teile = text
    .split(",")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);
  for (const teil of teile) {
    const { name, zusatzAnzahl } = trenneePlusAnzahl(teil);
    if (name) ergebnis.push(name);
    for (let i = 0; i < zusatzAnzahl; i++) ergebnis.push("");
  }
  return ergebnis;
}

function neueGruppe(
  ursprungsZeile: string,
  inhalt: string,
  index: number,
): TextGruppe {
  // alsBegleitungNamen zerlegt die Zeile bereits korrekt an Kommas und
  // "+N" (inkl. eines "+N" direkt am Hauptgast) - der erste Eintrag ist
  // hier nur eben der Hauptgast statt einer Begleitperson.
  const alleTeile = alsBegleitungNamen(inhalt);

  return {
    id: `gruppe-${index}`,
    ausgewaehlt: true,
    hauptgast: alleTeile[0] ?? "",
    begleitungNamen: alleTeile.slice(1),
    rohtext: ursprungsZeile,
    moeglicheDublette: false,
  };
}

export function parseGaesteText(text: string): TextGruppe[] {
  const zeilen = text
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);

  const gruppen: TextGruppe[] = [];
  let aktuelle: TextGruppe | null = null;
  let zaehler = 0;

  for (const zeile of zeilen) {
    const treffer = zeile.match(HEADER_MUSTER);
    const istKopfzeile = treffer !== null;

    if (istKopfzeile || !aktuelle) {
      if (aktuelle) gruppen.push(aktuelle);
      const inhalt = istKopfzeile ? zeile.replace(HEADER_MUSTER, "") : zeile;
      aktuelle = neueGruppe(zeile, inhalt, zaehler);
      zaehler++;
    } else {
      // Fortsetzungszeile ohne erkennbaren Präfix: gehört zur aktuell
      // offenen Gruppe als weitere Begleitperson(en).
      aktuelle.begleitungNamen.push(...alsBegleitungNamen(zeile));
      aktuelle.rohtext += `, ${zeile}`;
    }
  }
  if (aktuelle) gruppen.push(aktuelle);

  return gruppen;
}

// Markiert (nur als Hinweis, nicht automatisch abgewählt) Hauptgäste, deren
// Name bereits unter bestehenden Gästen vorkommt. Bei diesem lockeren Format
// sind das oft nur Vornamen, ein Treffer ist also eher ein "bitte prüfen"
// als ein sicheres Duplikat - anders als beim PDF/CSV-Mitgliederimport.
export function markiereMoeglicheDubletten(
  gruppen: TextGruppe[],
  bestehendeNamenLower: ReadonlySet<string>,
): TextGruppe[] {
  return gruppen.map((gruppe) => ({
    ...gruppe,
    moeglicheDublette: bestehendeNamenLower.has(
      gruppe.hauptgast.trim().toLowerCase(),
    ),
  }));
}

export interface GastEintrag {
  name: string;
  begleitungNamen: string[];
}

// Wandelt eine Gruppe in die anzulegenden Einträge um.
// - zusammen (Standard): ein Eintrag, Hauptgast + Begleitpersonen
// - einzeln: jede benannte Person wird ein eigener Eintrag; unbenannte
//   "+N"-Personen hängen als Begleitung an der Person davor (eine
//   unbenannte Person allein wäre am Einlass nicht auffindbar)
export function eintraegeAusGruppe(
  gruppe: TextGruppe,
  einzeln: boolean,
): GastEintrag[] {
  const hauptgast = gruppe.hauptgast.trim();
  if (!hauptgast) return [];
  if (!einzeln) {
    return [{ name: hauptgast, begleitungNamen: gruppe.begleitungNamen }];
  }
  const eintraege: GastEintrag[] = [{ name: hauptgast, begleitungNamen: [] }];
  for (const name of gruppe.begleitungNamen) {
    const getrimmt = name.trim();
    if (getrimmt) {
      eintraege.push({ name: getrimmt, begleitungNamen: [] });
    } else {
      eintraege[eintraege.length - 1].begleitungNamen.push("");
    }
  }
  return eintraege;
}
