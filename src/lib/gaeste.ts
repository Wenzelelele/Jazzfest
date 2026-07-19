import {
  addDoc,
  collection,
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

export function leereBegleitung(anzahl: number): Begleitung {
  const begleitung: Begleitung = {};
  for (let i = 1; i <= anzahl; i++) {
    begleitung[String(i)] = { checkedIn: false, checkedInAt: null, name: "" };
  }
  return begleitung;
}

export interface NeuerGastInput {
  name: string;
  notiz?: string;
  anzahlBegleitung?: number;
  quelle?: Quelle;
}

export async function erstelleGast(input: NeuerGastInput) {
  return addDoc(gaesteCollectionRef(), {
    name: input.name,
    nameLower: nameLowerVon(input.name),
    quelle: input.quelle ?? "manuell",
    notiz: input.notiz ?? "",
    checkedIn: false,
    checkedInAt: null,
    begleitung: leereBegleitung(input.anzahlBegleitung ?? 0),
    erstelltAm: serverTimestamp(),
  });
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
