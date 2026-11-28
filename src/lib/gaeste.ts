import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { namePasst, normalisiere } from "@/lib/suche";

export type Quelle = "mitglied" | "manuell";

// "angefragt": über den öffentlichen Anfrage-Link (/gaesteliste)
// eingetragen, wartet auf Freigabe durch einen Admin - erscheint noch nicht
// in der Einlassliste und zählt nicht mit. Fehlt das Feld (ältere Einträge, Mitglieder), gilt der Gast
// als freigegeben.
export type GastStatus = "angefragt" | "freigegeben";

export interface Begleitperson {
  checkedIn: boolean;
  checkedInAt: Timestamp | null;
  checkedInBy?: string | null;
  name: string;
}

// Map mit String-Keys ("1", "2", ...), bewusst kein Array: Beim Check-in
// wird gezielt nur der betroffene Map-Key geschrieben (siehe
// checkInBegleitung), sodass zwei Offline-Geräte, die unterschiedliche
// Begleitpersonen abhaken, beim Sync sauber gemergt werden statt sich
// gegenseitig zu überschreiben.
export type Begleitung = Record<string, Begleitperson>;

export interface Gast {
  name: string;
  nameLower: string;
  quelle: Quelle;
  notiz: string;
  checkedIn: boolean;
  checkedInAt: Timestamp | null;
  checkedInBy?: string | null;
  begleitung: Begleitung;
  erstelltAm: Timestamp;
  status?: GastStatus;
  angefragtVon?: string | null;
  freigegebenVon?: string | null;
  freigegebenAm?: Timestamp | null;
  // Über wen der Gast auf die Liste kommt (Band, Musiker, Veranstalter...)
  ansprechpartner?: string;
}

export function istAngefragt(gast: Gast): boolean {
  return gast.status === "angefragt";
}

export interface GastMitId extends Gast {
  id: string;
}

// Gäste liegen pro Event in einer eigenen Subcollection:
// events/{eventId}/gaeste/{gastId}. So hat jedes Event seinen eigenen
// Check-in-Stand, ein Mitglied kann bei mehreren Events getrennt kommen.
export function gaesteCollectionRef(eventId: string) {
  return collection(db, "events", eventId, "gaeste");
}

export function gastDocRef(eventId: string, gastId: string) {
  return doc(db, "events", eventId, "gaeste", gastId);
}

export function nameLowerVon(name: string): string {
  return name.trim().toLowerCase();
}

// Name des Kassen-Geräts (aus zugaenge/{uid}), gesetzt vom AuthContext -
// Geräte mit Kassen-Code haben keine E-Mail.
let geraeteName: string | null = null;
export function setzeGeraeteName(name: string | null) {
  geraeteName = name;
}

// Wer eingecheckt hat - E-Mail/Benutzername des Accounts bzw. der Name des
// Kassen-Geräts. Offline verfügbar, weil der Auth-Zustand lokal persistiert
// ist.
export function aktuellerNutzer(): string | null {
  return (
    auth.currentUser?.email ?? geraeteName ?? auth.currentUser?.uid ?? null
  );
}

export function baueBegleitung(namen: string[]): Begleitung {
  const begleitung: Begleitung = {};
  namen.forEach((name, index) => {
    begleitung[String(index + 1)] = {
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: null,
      name: name.trim(),
    };
  });
  return begleitung;
}

export interface NeuerGastInput {
  name: string;
  notiz?: string;
  anzahlBegleitung?: number;
  begleitungNamen?: string[];
  quelle?: Quelle;
  status?: GastStatus;
  ansprechpartner?: string;
}

// Felder eines neuen Gast-Dokuments - auch die Firestore-Regeln für
// öffentliche Anfragen prüfen genau diese Feldliste.
function neuesGastDokument(input: NeuerGastInput, angefragtVon: string | null) {
  const namen =
    input.begleitungNamen ??
    Array<string>(input.anzahlBegleitung ?? 0).fill("");
  return {
    name: input.name,
    nameLower: nameLowerVon(input.name),
    quelle: input.quelle ?? "manuell",
    notiz: input.notiz ?? "",
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
    begleitung: baueBegleitung(namen),
    erstelltAm: serverTimestamp(),
    status: input.status ?? "freigegeben",
    angefragtVon,
    ansprechpartner: (input.ansprechpartner ?? "").trim(),
  };
}

export async function erstelleGast(eventId: string, input: NeuerGastInput) {
  return addDoc(
    gaesteCollectionRef(eventId),
    neuesGastDokument(
      input,
      input.status === "angefragt" ? aktuellerNutzer() : null,
    ),
  );
}

// Anfragen über den öffentlichen Link (ohne Login). Die IDs werden vorab
// lokal vergeben, damit das Gerät sich merken kann, was es angefragt hat,
// und später den Status (offen/freigegeben/abgelehnt) dieser Einträge
// abfragen darf - die Regeln erlauben ohne Login nur das Lesen einzelner
// Dokumente per ID, nicht die ganze Liste.
export function oeffentlicheAnfragenSenden(
  eventId: string,
  eintraege: { name: string; begleitungNamen: string[] }[],
  ansprechpartner: string,
  notiz: string,
): { ids: string[]; gesendet: Promise<void> } {
  const batch = writeBatch(db);
  const ids: string[] = [];
  for (const eintrag of eintraege) {
    const ref = doc(gaesteCollectionRef(eventId));
    ids.push(ref.id);
    batch.set(
      ref,
      neuesGastDokument(
        {
          name: eintrag.name,
          begleitungNamen: eintrag.begleitungNamen,
          notiz,
          quelle: "manuell",
          status: "angefragt",
          ansprechpartner,
        },
        null,
      ),
    );
  }
  return { ids, gesendet: batch.commit() };
}

// Für "Rückgängig" direkt nach einer Freigabe.
export async function freigabeZuruecknehmen(
  eventId: string,
  gastIds: string[],
) {
  for (let start = 0; start < gastIds.length; start += LOESCH_BATCH_GROESSE) {
    const batch = writeBatch(db);
    for (const gastId of gastIds.slice(start, start + LOESCH_BATCH_GROESSE)) {
      batch.update(gastDocRef(eventId, gastId), {
        status: "angefragt",
        freigegebenVon: null,
        freigegebenAm: null,
      });
    }
    await batch.commit();
  }
}

// Gibt angefragte Gäste frei - danach stehen sie fest auf der Liste.
export async function gaesteFreigeben(eventId: string, gastIds: string[]) {
  const von = aktuellerNutzer();
  for (let start = 0; start < gastIds.length; start += LOESCH_BATCH_GROESSE) {
    const batch = writeBatch(db);
    for (const gastId of gastIds.slice(start, start + LOESCH_BATCH_GROESSE)) {
      batch.update(gastDocRef(eventId, gastId), {
        status: "freigegeben",
        freigegebenVon: von,
        freigegebenAm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export interface GastBearbeitenInput {
  name: string;
  notiz: string;
  begleitungNamen: string[];
  ansprechpartner: string;
}

// Begleitung-Keys bleiben immer als "1".."n" durchgehend - beim Bearbeiten
// werden neue Keys ergänzt oder überzählige entfernt, bestehende Keys
// behalten ihren checkedIn-Status und bekommen nur den Namen aktualisiert.
export async function aktualisiereGast(
  eventId: string,
  gastId: string,
  bestehenderGast: Gast,
  input: GastBearbeitenInput,
) {
  const alteAnzahl = Object.keys(bestehenderGast.begleitung).length;
  const neueAnzahl = input.begleitungNamen.length;
  const updates: Record<string, unknown> = {
    name: input.name,
    nameLower: nameLowerVon(input.name),
    notiz: input.notiz,
    ansprechpartner: input.ansprechpartner.trim(),
  };

  const maxSchluessel = Math.max(alteAnzahl, neueAnzahl);
  for (let i = 1; i <= maxSchluessel; i++) {
    const key = String(i);
    if (i > neueAnzahl) {
      updates[`begleitung.${key}`] = deleteField();
    } else if (i > alteAnzahl) {
      updates[`begleitung.${key}`] = {
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
        name: input.begleitungNamen[i - 1].trim(),
      };
    } else {
      updates[`begleitung.${key}.name`] = input.begleitungNamen[i - 1].trim();
    }
  }

  await updateDoc(gastDocRef(eventId, gastId), updates);
}

export async function loescheGast(eventId: string, gastId: string) {
  await deleteDoc(gastDocRef(eventId, gastId));
}

const LOESCH_BATCH_GROESSE = 450; // Firestore erlaubt maximal 500 Schreibvorgänge pro Batch

// Löscht alle Gäste (und Mitglieder) EINES Events.
export async function alleGaesteLoeschen(eventId: string): Promise<number> {
  const snapshot = await getDocs(gaesteCollectionRef(eventId));
  const alleRefs = snapshot.docs.map((docSnapshot) => docSnapshot.ref);

  for (let start = 0; start < alleRefs.length; start += LOESCH_BATCH_GROESSE) {
    const stapel = alleRefs.slice(start, start + LOESCH_BATCH_GROESSE);
    const batch = writeBatch(db);
    for (const ref of stapel) {
      batch.delete(ref);
    }
    await batch.commit();
  }

  return alleRefs.length;
}

export async function checkInHauptgast(
  eventId: string,
  gastId: string,
  checkedIn: boolean,
) {
  await updateDoc(gastDocRef(eventId, gastId), {
    checkedIn,
    checkedInAt: checkedIn ? serverTimestamp() : null,
    checkedInBy: checkedIn ? aktuellerNutzer() : null,
  });
}

// Gezielter Feld-Update auf einen einzelnen Map-Key - siehe Kommentar bei
// Begleitung. Niemals das gesamte begleitung-Objekt überschreiben.
export async function checkInBegleitung(
  eventId: string,
  gastId: string,
  begleitungKey: string,
  checkedIn: boolean,
) {
  await updateDoc(gastDocRef(eventId, gastId), {
    [`begleitung.${begleitungKey}.checkedIn`]: checkedIn,
    [`begleitung.${begleitungKey}.checkedInAt`]: checkedIn
      ? serverTimestamp()
      : null,
    [`begleitung.${begleitungKey}.checkedInBy`]: checkedIn
      ? aktuellerNutzer()
      : null,
  });
}

// "mit Anna, Ben, +1" - Kurzbeschreibung der Begleitung für Listen.
export function begleitungText(gast: Gast): string {
  const keys = sortiereBegleitungKeys(gast.begleitung);
  if (keys.length === 0) return "";
  const namen = keys.map((key) => gast.begleitung[key].name).filter(Boolean);
  const unbenannt = keys.length - namen.length;
  const teile = [...namen];
  if (unbenannt > 0) teile.push(`+${unbenannt}`);
  return `mit ${teile.join(", ")}`;
}

export function gesamtPersonen(gast: Gast): number {
  return 1 + Object.keys(gast.begleitung).length;
}

export function eingecheckePersonen(gast: Gast): number {
  const begleitungEingecheckt = Object.values(gast.begleitung).filter(
    (begleitperson) => begleitperson.checkedIn,
  ).length;
  return (gast.checkedIn ? 1 : 0) + begleitungEingecheckt;
}

export function istVollstaendigDa(gast: Gast): boolean {
  return eingecheckePersonen(gast) === gesamtPersonen(gast);
}

export function sortiereBegleitungKeys(begleitung: Begleitung): string[] {
  return Object.keys(begleitung).sort((a, b) => Number(a) - Number(b));
}

// Sucht sowohl im Hauptgast-Namen als auch in benannten Begleitpersonen:
// kommt jemand getrennt vom Hauptgast an und nennt nur den eigenen Namen,
// muss die Suche die Zeile trotzdem finden.
export function gastPasstZurSuche(
  gast: Gast,
  begriffe: readonly string[],
): boolean {
  if (begriffe.length === 0) return true;
  if (namePasst(gast.name, begriffe)) return true;
  return Object.values(gast.begleitung).some(
    (begleitperson) =>
      begleitperson.name.length > 0 && namePasst(begleitperson.name, begriffe),
  );
}

export function summiere(gaeste: readonly Gast[]) {
  let gesamt = 0;
  let eingecheckt = 0;
  for (const gast of gaeste) {
    gesamt += gesamtPersonen(gast);
    eingecheckt += eingecheckePersonen(gast);
  }
  return { gesamt, eingecheckt };
}

export interface AnsprechpartnerGruppe {
  schluessel: string;
  name: string; // Schreibweise des ersten Eintrags, "" = ohne Ansprechpartner
  gaeste: GastMitId[];
  freigegeben: { eintraege: number; personen: number; da: number };
  angefragt: { eintraege: number; personen: number };
}

// Gruppiert Gäste (ohne JIM-Mitglieder) danach, über wen sie auf die Liste
// kommen. Groß-/Kleinschreibung und Umlaut-Schreibweisen zählen nicht als
// verschiedene Ansprechpartner ("Band X" = "band x").
export function gruppiereNachAnsprechpartner(
  gaeste: readonly GastMitId[],
): AnsprechpartnerGruppe[] {
  const gruppen = new Map<string, AnsprechpartnerGruppe>();
  for (const gast of gaeste) {
    if (gast.quelle === "mitglied") continue;
    const name = (gast.ansprechpartner ?? "").trim();
    const schluessel = ansprechpartnerSchluessel(name);
    let gruppe = gruppen.get(schluessel);
    if (!gruppe) {
      gruppe = {
        schluessel,
        name,
        gaeste: [],
        freigegeben: { eintraege: 0, personen: 0, da: 0 },
        angefragt: { eintraege: 0, personen: 0 },
      };
      gruppen.set(schluessel, gruppe);
    }
    gruppe.gaeste.push(gast);
    if (istAngefragt(gast)) {
      gruppe.angefragt.eintraege++;
      gruppe.angefragt.personen += gesamtPersonen(gast);
    } else {
      gruppe.freigegeben.eintraege++;
      gruppe.freigegeben.personen += gesamtPersonen(gast);
      gruppe.freigegeben.da += eingecheckePersonen(gast);
    }
  }
  return [...gruppen.values()].sort((a, b) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.localeCompare(b.name, "de");
  });
}

export function ansprechpartnerSchluessel(name: string | undefined): string {
  return normalisiere((name ?? "").trim()).replace(/\s+/g, " ");
}
