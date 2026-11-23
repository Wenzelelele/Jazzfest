// Liest Gästenamen aus eingefügtem Freitext (z. B. einer WhatsApp-Nachricht).
//
// Zwei Arten von Text:
//
// 1. Freitext ohne Kopfzeile - der Normalfall aus WhatsApp:
//      "Hallo Tom, hier ein paar Namen für die Gästeliste. Thomas hauser,
//       Elena tim, hans zimmer, sasche dings. LG Max"
//    -> Begrüßung, Füllsätze und die Grußformel am Ende werden ignoriert,
//       übrig bleiben Thomas Hauser, Elena Tim, Hans Zimmer, Sasche Dings.
//       Die Vorschau schlägt hier "jede Person einzeln" vor.
//
// 2. Mit Kopfzeile ("Gästeliste X", "Gäste von X", ...): startet eine Gruppe
//    mit X als Hauptgast, alle Namen bis zur nächsten Kopfzeile werden seine
//    Begleitpersonen - egal ob durch Komma getrennt oder je Zeile einer.
//      Gästeliste Fahd
//      Hans
//      Jürgen +1
//    -> Hauptgast "Fahd", Begleitung "Hans", "Jürgen" + 1 unbenannte Person.
//
// Das ist eine Heuristik, keine echte Spracherkennung. Was ignoriert wurde,
// zeigt die Vorschau an - dort lässt sich jede Gruppe korrigieren.

export interface TextGruppe {
  id: string;
  ausgewaehlt: boolean;
  hauptgast: string;
  begleitungNamen: string[];
  rohtext: string;
  moeglicheDublette: boolean;
  // Textteile, die nicht als Name erkannt wurden (Begrüßung, Füllsätze...)
  ignoriert: string[];
  // true, wenn die Gruppe mit "Gästeliste X" / "Gäste von X" begann
  ausKopfzeile: boolean;
}

const HEADER_MUSTER =
  /^(gästeliste|gaesteliste|gäste?\s+von|gaeste\s+von|gast\s+von|guests?\s+of)\s*[:\-]?\s*/i;
const PLUS_ANZAHL_MUSTER = /^(.*?)\s*\+\s*(\d+)\s*$/;
const MIT_BEGLEITUNG_MUSTER = /^(.*?)\s+(?:mit|\+|und)\s+begleitung\s*$/i;

// Buchstaben inkl. Umlaute/Akzente (kein \p{L}: tsconfig-Target ES2017).
const BUCHSTABE = "A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ";
const WORT_MUSTER = new RegExp(`^[${BUCHSTABE}][${BUCHSTABE}'’\\-]*$`);
const NICHT_NAMENSZEICHEN = new RegExp(`[^${BUCHSTABE}\\s'’\\-]`, "g");

// Kommt eines dieser Wörter in einem Textteil vor, ist es kein Name, sondern
// Begrüßung, Füllsatz oder Bitte ("Hallo Tom", "hier ein paar Namen für die
// Gästeliste", "kannst du die drauf setzen").
const STOPPWOERTER = new Set(
  `hallo hi hey moin servus huhu hallöchen hallihallo liebe lieber lieben
  hier ein eine einen einige paar namen name für fuer die der das den dem des
  gästeliste gaesteliste liste gästen gäste gaeste gast bitte danke dank
  dankeschön vielen noch mal ich wir du ihr sie er es uns euch mir dir mein
  meine kommen kommt komme sind ist wären waeren wäre waere sein auf an in
  folgende folgenden mit begleitung und oder schon auch dabei heute morgen
  abend samstag sonntag freitag donnerstag event konzert jazzfest grüße
  gruesse gruß gruss lg vg cheers bis dann tschüss tschüs ciao bussi super
  toll ok okay ja nein personen person leute schreib schreibst schreiben setz
  setzen drauf rauf eintragen trag trägst kannst könntest koenntest würde
  wuerde würdest freuen freue freut gerne gern so wie was wer wann weil dass
  bei zu zur zum vom nicht kein keine aber sorry`.split(/\s+/),
);

// Grußformeln am Ende: der Rest danach ist meist nur der Absendername.
const ABSCHIED_MUSTER =
  /^(lg|vg|mfg|liebe grüße|liebe gruesse|viele grüße|viele gruesse|beste grüße|grüße|gruesse|gruß|gruss|danke|dankeschön|vielen dank|cheers|bis dann|bis später|ciao|tschüss|bussi)\b/i;

// Emojis/Symbole (Surrogatpaare und gängige Symbolblöcke)
const EMOJI_MUSTER =
  /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D])+/g;
const ABSCHIED_IM_SATZ =
  /\s+(?=(?:lg|vg|liebe grüße|viele grüße|beste grüße|grüße|gruß)\b)/gi;

const NAMENSPARTIKEL = new Set([
  "von",
  "van",
  "de",
  "der",
  "den",
  "zu",
  "da",
  "di",
  "del",
]);
const TITEL: Record<string, string> = { dr: "Dr.", prof: "Prof." };

function grossschreiben(wort: string): string {
  return wort
    .split("-")
    .map((teil) =>
      teil.length > 0
        ? teil[0].toUpperCase() + teil.slice(1).toLowerCase()
        : teil,
    )
    .join("-");
}

// "hans zimmer" -> "Hans Zimmer", "ELENA TIM" -> "Elena Tim"; gemischte
// Schreibweisen wie "McDonald" bleiben, Partikel wie "von" klein.
function schoenerName(name: string): string {
  return name
    .split(/\s+/)
    .map((wort, index) => {
      const klein = wort.toLowerCase();
      if (TITEL[klein]) return TITEL[klein];
      if (index > 0 && NAMENSPARTIKEL.has(klein)) return klein;
      const ganzKlein = wort === klein;
      const ganzGross = wort === wort.toUpperCase() && wort.length > 1;
      return ganzKlein || ganzGross ? grossschreiben(wort) : wort;
    })
    .join(" ");
}

// Partikel ("von der") und Titel ("Dr.") zählen nicht als Füllwort und
// nicht zur Höchstzahl von 4 Namenswörtern.
function istName(kandidat: string): boolean {
  const woerter = kandidat.split(/\s+/).filter(Boolean);
  const kern = woerter.filter((wort, index) => {
    const klein = wort.toLowerCase();
    if (TITEL[klein] && index === 0) return false;
    return !(index > 0 && NAMENSPARTIKEL.has(klein));
  });
  if (kern.length === 0 || kern.length > 4) return false;
  if (kandidat.length > 50) return false;
  return (
    woerter.every((wort) => WORT_MUSTER.test(wort)) &&
    kern.every((wort) => !STOPPWOERTER.has(wort.toLowerCase()))
  );
}

interface Teil {
  text: string;
}

// Zerlegt eine Zeile in Sätze und die Sätze in Aufzählungsteile.
function zerlege(zeile: string): Teil[] {
  // Abkürzungen vor der Satztrennung schützen ("Dr. Müller"), Emojis wie
  // ein Satzende behandeln ("Lukas 😊 Grüße Sarah"), und vor einer
  // Grußformel ohne Satzzeichen trennen ("Lukas LG Sarah").
  const geschuetzt = zeile
    .replace(/\b(Dr|Prof|St|Hr|Fr)\./gi, "$1§")
    .replace(EMOJI_MUSTER, ". ")
    .replace(ABSCHIED_IM_SATZ, ". ");
  const saetze = geschuetzt.split(/[.!?:]+(?:\s+|$)/);
  const teile: Teil[] = [];
  for (const satz of saetze) {
    for (const stueck of satz.split(
      /\s*(?:,|;|\/|\s+und\s+|\s+&\s+|\s+sowie\s+)\s*/i,
    )) {
      const text = stueck.replace(/§/g, ".").trim();
      if (text) teile.push({ text });
    }
  }
  return teile;
}

interface Auswertung {
  // "" steht für eine unbenannte Begleitperson ("+1")
  namen: string[];
  ignoriert: boolean;
}

function werteAus(teil: string): Auswertung {
  let rest = teil;
  let zusatz = 0;

  const plus = rest.match(PLUS_ANZAHL_MUSTER);
  if (plus) {
    rest = plus[1];
    zusatz = Number(plus[2]);
  } else {
    const begleitung = rest.match(MIT_BEGLEITUNG_MUSTER);
    if (begleitung) {
      rest = begleitung[1];
      zusatz = 1;
    }
  }

  // Aufzählungszeichen, Emojis, Anführungszeichen, Nummerierung weg
  const bereinigt = rest
    .replace(/^\s*(?:[-•*·–]+|\d+[.)])\s*/, "")
    .replace(NICHT_NAMENSZEICHEN, " ")
    .replace(/\s+/g, " ")
    .trim();

  const unbenannt = Array<string>(zusatz).fill("");
  // Nur Nummerierung/Emoji/Satzzeichen: nichts Meldenswertes
  if (!bereinigt) return { namen: unbenannt, ignoriert: false };
  if (!istName(bereinigt)) return { namen: [], ignoriert: true };
  return { namen: [schoenerName(bereinigt), ...unbenannt], ignoriert: false };
}

interface ZeilenTeil {
  zeile: number;
  text: string;
  kopf: boolean;
}

export function parseGaesteText(text: string): TextGruppe[] {
  const zeilen = text
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);

  // Erst alles in Teile zerlegen, um die Grußformel am Ende zu finden.
  const teile: ZeilenTeil[] = [];
  zeilen.forEach((zeile, index) => {
    const kopf = HEADER_MUSTER.test(zeile);
    const inhalt = kopf ? zeile.replace(HEADER_MUSTER, "") : zeile;
    const zerlegt = zerlege(inhalt);
    if (kopf && zerlegt.length === 0) {
      teile.push({ zeile: index, text: "", kopf: true });
    }
    zerlegt.forEach((teil, i) =>
      teile.push({ zeile: index, text: teil.text, kopf: kopf && i === 0 }),
    );
  });

  // Grußformel ("LG Max", "Danke, Anna"): ab dort ist der Rest Absender -
  // aber nur, wenn danach höchstens noch zwei Teile kommen. Sonst stand das
  // "Danke" mitten im Text und es folgen noch echte Namen.
  let abschiedAb = teile.length;
  for (let i = teile.length - 1; i >= 0; i--) {
    if (ABSCHIED_MUSTER.test(teile[i].text)) {
      if (teile.length - 1 - i <= 2) abschiedAb = i;
      break;
    }
  }

  const gruppen: TextGruppe[] = [];
  let aktuelle: TextGruppe | null = null;
  let letzteZeile = -1;

  const neueGruppe = (rohtext: string, ausKopfzeile: boolean): TextGruppe => ({
    id: `gruppe-${gruppen.length}`,
    ausgewaehlt: true,
    hauptgast: "",
    begleitungNamen: [],
    rohtext,
    moeglicheDublette: false,
    ignoriert: [],
    ausKopfzeile,
  });

  teile.forEach((teil, index) => {
    if (teil.kopf || !aktuelle) {
      if (aktuelle) gruppen.push(aktuelle);
      aktuelle = neueGruppe(zeilen[teil.zeile], teil.kopf);
    } else if (teil.zeile !== letzteZeile) {
      aktuelle.rohtext += ` / ${zeilen[teil.zeile]}`;
    }
    letzteZeile = teil.zeile;
    if (!teil.text) return;

    if (index >= abschiedAb) {
      aktuelle.ignoriert.push(teil.text);
      return;
    }
    const { namen, ignoriert } = werteAus(teil.text);
    if (ignoriert) aktuelle.ignoriert.push(teil.text);
    for (const name of namen) {
      if (!aktuelle.hauptgast && name) {
        aktuelle.hauptgast = name;
      } else if (aktuelle.hauptgast) {
        aktuelle.begleitungNamen.push(name);
      }
    }
  });
  if (aktuelle) gruppen.push(aktuelle);

  return gruppen;
}

// true, wenn der Text Kopfzeilen ("Gästeliste X") enthielt - dann sind
// Gruppen gemeint. Reiner Freitext wird standardmäßig einzeln angelegt.
export function enthaeltKopfzeilen(gruppen: readonly TextGruppe[]): boolean {
  return gruppen.some((gruppe) => gruppe.ausKopfzeile);
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
// - zusammen: ein Eintrag, Hauptgast + Begleitpersonen
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
