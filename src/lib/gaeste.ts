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
import { namePasst } from "@/lib/suche";

export type Quelle = "mitglied" | "manuell";

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

// Wer eingecheckt hat - der Login-Account des Geräts (E-Mail). Offline
// verfügbar, weil der Auth-Zustand lokal persistiert ist.
export function aktuellerNutzer(): string | null {
  return auth.currentUser?.email ?? auth.currentUser?.uid ?? null;
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
}

export async function erstelleGast(eventId: string, input: NeuerGastInput) {
  const namen =
    input.begleitungNamen ??
    Array<string>(input.anzahlBegleitung ?? 0).fill("");
  return addDoc(gaesteCollectionRef(eventId), {
    name: input.name,
    nameLower: nameLowerVon(input.name),
    quelle: input.quelle ?? "manuell",
    notiz: input.notiz ?? "",
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
    begleitung: baueBegleitung(namen),
    erstelltAm: serverTimestamp(),
  });
}

export interface GastBearbeitenInput {
  name: string;
  notiz: string;
  begleitungNamen: string[];
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
