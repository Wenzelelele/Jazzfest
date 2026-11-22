import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Drei Benutzerklassen (nur Oberfläche, bewusst keine harte Absicherung -
// siehe README):
// - kasse:   Listen sehen, einchecken, Abendkasse zählen
// - anfrage: Gäste eintragen - landen erst als Anfrage, nicht auf der Liste
// - admin:   alles, inkl. Anfragen freigeben, Events, Import, Benutzer
//
// Admin ist zusätzlich an das Dokument admins/{uid} gebunden, weil die
// Firestore-Regeln Events/Import daran festmachen. Kasse/Anfrage stehen nur
// in nutzer/{uid}.rolle. Neue Accounts sind automatisch Kasse.
export type Rolle = "kasse" | "anfrage" | "admin";

export const ROLLEN: { wert: Rolle; label: string; beschreibung: string }[] = [
  {
    wert: "kasse",
    label: "Kasse",
    beschreibung: "Listen sehen, einchecken, Abendkasse",
  },
  {
    wert: "anfrage",
    label: "Anfrage",
    beschreibung: "Gäste anfragen, Freigabe durch Admin",
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
  rolle?: Rolle;
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
