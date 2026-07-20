// Parst locker formatierten, eingefügten Text (z. B. aus WhatsApp) in
// Gäste-Gruppen: eine Zeile = ein Hauptgast mit optionalen Begleitpersonen.
//
// Erwartetes Muster pro Zeile (Beispiel):
//   "Gäste von Peter, Hans, Jürgen, Frank +1"
// -> Hauptgast "Peter", Begleitung "Hans", "Jürgen", "Frank" + 1 unbenannte
// Person (aus dem "+1" hinter Frank).
//
// Das ist eine Heuristik für ein bekanntes, einfaches Format - keine
// generische Freitext-Erkennung. Die Vorschau vor dem Speichern erlaubt,
// jede Zeile zu korrigieren.

export interface TextGruppe {
  id: string;
  ausgewaehlt: boolean;
  hauptgast: string;
  begleitungNamen: string[];
  rohtext: string;
  moeglicheDublette: boolean;
}

const PRAEFIX_MUSTER = /^(gäste?|gast|guests?)\s+von\s+/i;
const PLUS_ANZAHL_MUSTER = /^(.*?)\s*\+\s*(\d+)\s*$/;

function trenneePlusAnzahl(text: string): { name: string; zusatzAnzahl: number } {
  const treffer = text.match(PLUS_ANZAHL_MUSTER);
  if (treffer) {
    return { name: treffer[1].trim(), zusatzAnzahl: Number(treffer[2]) };
  }
  return { name: text.trim(), zusatzAnzahl: 0 };
}

function parseZeile(zeile: string, index: number): TextGruppe {
  const ohnePraefix = zeile.replace(PRAEFIX_MUSTER, "");
  const teile = ohnePraefix
    .split(",")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);

  const hauptgastRoh = teile[0] ?? "";
  const hauptgastAufgeteilt = trenneePlusAnzahl(hauptgastRoh);

  const begleitungNamen: string[] = Array<string>(
    hauptgastAufgeteilt.zusatzAnzahl,
  ).fill("");

  for (const teil of teile.slice(1)) {
    const { name, zusatzAnzahl } = trenneePlusAnzahl(teil);
    if (name) begleitungNamen.push(name);
    for (let i = 0; i < zusatzAnzahl; i++) begleitungNamen.push("");
  }

  return {
    id: `zeile-${index}`,
    ausgewaehlt: true,
    hauptgast: hauptgastAufgeteilt.name,
    begleitungNamen,
    rohtext: zeile,
    moeglicheDublette: false,
  };
}

export function parseGaesteText(text: string): TextGruppe[] {
  return text
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0)
    .map((zeile, index) => parseZeile(zeile, index));
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
