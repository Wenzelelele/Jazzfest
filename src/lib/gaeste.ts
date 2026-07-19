import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Quelle = "mitglied" | "manuell";

export interface Begleitperson {
  checkedIn: boolean;
  checkedInAt: Timestamp | null;
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
  begleitung: Begleitung;
  erstelltAm: Timestamp;
}

export interface GastMitId extends Gast {
  id: string;
}

export const GAESTE_COLLECTION = "gaeste";

export function gaesteCollectionRef() {
  return collection(db, GAESTE_COLLECTION);
}

export function gastDocRef(gastId: string) {
  return doc(db, GAESTE_COLLECTION, gastId);
}

export function nameLowerVon(name: string): string {
  return name.trim().toLowerCase();
}

export function baueBegleitung(namen: string[]): Begleitung {
  const begleitung: Begleitung = {};
  namen.forEach((name, index) => {
    begleitung[String(index + 1)] = {
      checkedIn: false,
      checkedInAt: null,
      name: name.trim(),
    };
  });
  return begleitung;
}

export function leereBegleitung(anzahl: number): Begleitung {
  return baueBegleitung(Array<string>(anzahl).fill(""));
}

export interface NeuerGastInput {
  name: string;
  notiz?: string;
  anzahlBegleitung?: number;
  begleitungNamen?: string[];
  quelle?: Quelle;
}

export async function erstelleGast(input: NeuerGastInput) {
  const namen =
    input.begleitungNamen ??
    Array<string>(input.anzahlBegleitung ?? 0).fill("");
  return addDoc(gaesteCollectionRef(), {
    name: input.name,
    nameLower: nameLowerVon(input.name),
    quelle: input.quelle ?? "manuell",
    notiz: input.notiz ?? "",
    checkedIn: false,
    checkedInAt: null,
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
        name: input.begleitungNamen[i - 1].trim(),
      };
    } else {
      updates[`begleitung.${key}.name`] = input.begleitungNamen[i - 1].trim();
    }
  }

  await updateDoc(gastDocRef(gastId), updates);
}

export async function loescheGast(gastId: string) {
  await deleteDoc(gastDocRef(gastId));
}

export async function checkInHauptgast(gastId: string, checkedIn: boolean) {
  await updateDoc(gastDocRef(gastId), {
    checkedIn,
    checkedInAt: checkedIn ? serverTimestamp() : null,
  });
}

// Gezielter Feld-Update auf einen einzelnen Map-Key - siehe Kommentar bei
// Begleitung. Niemals das gesamte begleitung-Objekt überschreiben.
export async function checkInBegleitung(
  gastId: string,
  begleitungKey: string,
  checkedIn: boolean,
) {
  await updateDoc(gastDocRef(gastId), {
    [`begleitung.${begleitungKey}.checkedIn`]: checkedIn,
    [`begleitung.${begleitungKey}.checkedInAt`]: checkedIn
      ? serverTimestamp()
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
