import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Zwei Benutzerklassen mit Login (nur Oberfläche, bewusst keine harte
// Absicherung - siehe README):
// - kasse: Listen sehen, einchecken, Abendkasse zählen
// - admin: alles, inkl. Anfragen freigeben, Events, Import, Benutzer
// Gäste anfragen kann jeder ohne Login über den öffentlichen Link
// (/gaesteliste).
//
// Admin ist an das Dokument admins/{uid} gebunden, weil die Firestore-Regeln
// Events/Import daran festmachen. Neue Accounts sind automatisch Kasse.
// (Ein älteres rolle-Feld "anfrage" in nutzer/{uid} zählt als Kasse.)
export type Rolle = "kasse" | "admin";

export const ROLLEN: { wert: Rolle; label: string; beschreibung: string }[] = [
  {
    wert: "kasse",
    label: "Kasse",
    beschreibung: "Listen sehen, einchecken, Abendkasse",
  },
  {
    wert: "admin",
    label: "Admin",
    beschreibung: "Alles, inkl. Freigabe, Events, Benutzer",
  },
];

export function rollenLabel(rolle: Rolle): string {
  return ROLLEN.find((r) => r.wert === rolle)?.label ?? rolle;
}

export interface Nutzer {
  email: string | null;
  rolle?: Rolle | "anfrage";
  zuletztAktiv?: Timestamp | null;
}

export interface NutzerMitId extends Nutzer {
  id: string;
}

export function nutzerCollectionRef() {
  return collection(db, "nutzer");
}

export function adminsCollectionRef() {
  return collection(db, "admins");
}

// Jeder Account trägt sich beim Start selbst ein (ohne Rolle) - so taucht er
// auf der Benutzer-Seite auf, ohne dass die App die Firebase-Auth-Nutzerliste
// lesen müsste (das ginge nur serverseitig).
export async function nutzerRegistrieren(uid: string, email: string | null) {
  await setDoc(
    doc(db, "nutzer", uid),
    { email, zuletztAktiv: serverTimestamp() },
    { merge: true },
  );
}

// Entfernt einen Account aus der Benutzer-Liste (und ggf. die
// Admin-Rechte). Den Login selbst löscht man in der Firebase Console unter
// Authentication - die App kann Firebase-Auth-Accounts nicht löschen.
// Meldet sich ein noch existierender Account erneut an, taucht er wieder
// (als Kasse) auf.
export async function nutzerEntfernen(uid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "nutzer", uid));
  batch.delete(doc(db, "admins", uid));
  await batch.commit();
}

export async function rolleSetzen(
  uid: string,
  email: string | null,
  rolle: Rolle,
) {
  const batch = writeBatch(db);
  batch.set(doc(db, "nutzer", uid), { rolle }, { merge: true });
  if (rolle === "admin") {
    batch.set(doc(db, "admins", uid), { email });
  } else {
    batch.delete(doc(db, "admins", uid));
  }
  await batch.commit();
}
