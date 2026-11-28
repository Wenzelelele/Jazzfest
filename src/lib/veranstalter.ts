import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Timestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { anzeigeName, zuLoginEmail } from "@/lib/benutzername";
import { eventsCollectionRef, loescheEvent } from "@/lib/events";

// Mandanten-Modell: Jeder Veranstalter hat eigene Events, eigene Admins und
// eigene Kassen-Geräte und sieht nichts von den anderen (in den
// Firestore-Regeln abgesichert, nicht nur in der Oberfläche).
//
// - veranstalter/{id}       Name; die ID ist zugleich der Kurzname im
//                           öffentlichen Anfrage-Link /gaesteliste/{id}
// - zugaenge/{uid}          Welcher Account zu welchem Veranstalter gehört
//                           und mit welcher Rolle (admin | kasse)
// - kassencodes/{code}      Code, mit dem ein Gerät Kasse wird
// - einladungen/{code}      Einmal-Code, mit dem jemand Admin wird
// - admins/{uid}            Super-Admins (in der Firebase Console angelegt):
//                           legen Veranstalter an und dürfen überall alles
// - events/{id}             mit Feld veranstalterId

export type Rolle = "kasse" | "admin";

export const ROLLEN_LABEL: Record<Rolle, string> = {
  kasse: "Kasse",
  admin: "Admin",
};

export interface Veranstalter {
  name: string;
  erstelltAm: Timestamp | null;
}

export interface VeranstalterMitId extends Veranstalter {
  id: string;
}

export interface Zugang {
  veranstalterId: string;
  rolle: Rolle;
  name: string;
  code?: string;
  einladung?: string;
  erstelltAm: Timestamp | null;
}

export interface ZugangMitId extends Zugang {
  id: string;
}

export interface Kassencode {
  veranstalterId: string;
  name: string;
  erstelltAm: Timestamp | null;
}

export interface Einladung {
  veranstalterId: string;
  erstelltAm: Timestamp | null;
  benutztVon: string | null;
  benutztAm?: Timestamp | null;
}

export const veranstalterRef = (id: string) => doc(db, "veranstalter", id);
export const veranstalterCollectionRef = () => collection(db, "veranstalter");
export const zugangRef = (uid: string) => doc(db, "zugaenge", uid);
const kassencodeRef = (code: string) => doc(db, "kassencodes", code);
const einladungRef = (code: string) => doc(db, "einladungen", code);

export function zugaengeVon(veranstalterId: string) {
  return query(
    collection(db, "zugaenge"),
    where("veranstalterId", "==", veranstalterId),
  );
}
export function kassencodesVon(veranstalterId: string) {
  return query(
    collection(db, "kassencodes"),
    where("veranstalterId", "==", veranstalterId),
  );
}
export function einladungenVon(veranstalterId: string) {
  return query(
    collection(db, "einladungen"),
    where("veranstalterId", "==", veranstalterId),
  );
}
export function eventsVon(veranstalterId: string) {
  return query(
    eventsCollectionRef(),
    where("veranstalterId", "==", veranstalterId),
  );
}

// --- Codes ---------------------------------------------------------------

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L).
const CODE_ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function neuerCode(laenge = 8): string {
  const zufall = new Uint32Array(laenge);
  crypto.getRandomValues(zufall);
  return Array.from(zufall, (z) => CODE_ZEICHEN[z % CODE_ZEICHEN.length]).join(
    "",
  );
}

// Eingabe tolerant machen: Kleinbuchstaben, Leerzeichen, Bindestrich egal.
export function normalisiereCode(eingabe: string): string {
  return eingabe.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatiereCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// Kurzname für den Link, z. B. "Jazz im Mühlbach" -> "jazz-im-muehlbach"
export function kurznameAus(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// --- Super-Admin ---------------------------------------------------------

export async function erstelleVeranstalter(name: string, kurzname: string) {
  const id = kurznameAus(kurzname);
  if (!id) throw new Error("Bitte einen Kurznamen angeben.");
  if ((await getDoc(veranstalterRef(id))).exists()) {
    throw new Error(`Den Kurznamen „${id}“ gibt es schon.`);
  }
  await setDoc(veranstalterRef(id), {
    name: name.trim(),
    erstelltAm: serverTimestamp(),
  });
  return id;
}

// Events aus der Zeit vor den Veranstaltern einem Veranstalter zuordnen.
export async function eventsZuordnen(eventIds: string[], veranstalterId: string) {
  const batch = writeBatch(db);
  for (const id of eventIds) {
    batch.update(doc(eventsCollectionRef(), id), { veranstalterId });
  }
  await batch.commit();
}

// --- Admin eines Veranstalters -------------------------------------------

export async function erstelleKassencode(veranstalterId: string, name: string) {
  const code = neuerCode();
  await setDoc(kassencodeRef(code), {
    veranstalterId,
    name: name.trim() || "Kasse",
    erstelltAm: serverTimestamp(),
  });
  return code;
}

async function loescheAlle(refs: DocumentReference[]) {
  for (let start = 0; start < refs.length; start += 450) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(start, start + 450)) batch.delete(ref);
    await batch.commit();
  }
}

// Löscht den Code und meldet alle Geräte ab, die mit ihm beigetreten sind.
export async function loescheKassencode(veranstalterId: string, code: string) {
  const geraete = await getDocs(zugaengeVon(veranstalterId));
  await loescheAlle([
    kassencodeRef(code),
    ...geraete.docs
      .filter((d) => (d.data() as Zugang).code === code)
      .map((d) => d.ref),
  ]);
}

export async function erstelleEinladung(veranstalterId: string) {
  const code = neuerCode();
  await setDoc(einladungRef(code), {
    veranstalterId,
    erstelltAm: serverTimestamp(),
    benutztVon: null,
  });
  return code;
}

export async function loescheEinladung(code: string) {
  await deleteDoc(einladungRef(code));
}

export async function zugangEntfernen(uid: string) {
  await deleteDoc(zugangRef(uid));
}

// Alles eines Veranstalters löschen: Events samt Gästen, Codes,
// Einladungen, Zugänge. Die Login-Accounts selbst (Firebase Auth) bleiben
// bestehen, haben danach aber keinen Zugriff mehr auf irgendetwas.
export async function loescheVeranstalter(
  veranstalterId: string,
  eigeneUid: string | undefined,
) {
  const events = await getDocs(eventsVon(veranstalterId));
  for (const event of events.docs) await loescheEvent(event.id);

  const [codes, einladungen, zugaenge] = await Promise.all([
    getDocs(kassencodesVon(veranstalterId)),
    getDocs(einladungenVon(veranstalterId)),
    getDocs(zugaengeVon(veranstalterId)),
  ]);
  await loescheAlle([
    ...codes.docs.map((d) => d.ref),
    ...einladungen.docs.map((d) => d.ref),
  ]);
  await deleteDoc(veranstalterRef(veranstalterId));
  // Eigenen Zugang zuletzt - bis dahin braucht es die Admin-Rechte.
  await loescheAlle(
    zugaenge.docs.filter((d) => d.id !== eigeneUid).map((d) => d.ref),
  );
  if (eigeneUid && zugaenge.docs.some((d) => d.id === eigeneUid)) {
    await deleteDoc(zugangRef(eigeneUid));
  }
}

// --- Beitreten -----------------------------------------------------------

export class BeitrittFehler extends Error {}

// Gerät wird Kasse: ohne Login wird anonym angemeldet (bleibt auf dem
// Gerät gespeichert, auch offline). Ein ungültiger Code hinterlässt keinen
// anonymen Account.
export async function kassenBeitritt(eingabe: string, geraetName: string) {
  const code = normalisiereCode(eingabe);
  if (code.length < 6) throw new BeitrittFehler("Bitte den Kassen-Code eingeben.");

  let user: User | null = auth.currentUser;
  const neuAnonym = !user;
  if (!user) user = (await signInAnonymously(auth)).user;

  const codeDoc = await getDoc(kassencodeRef(code));
  if (!codeDoc.exists()) {
    if (neuAnonym) await deleteUser(user).catch(() => {});
    throw new BeitrittFehler("Diesen Kassen-Code gibt es nicht (mehr).");
  }
  const { veranstalterId, name } = codeDoc.data() as Kassencode;
  await setDoc(zugangRef(user.uid), {
    veranstalterId,
    rolle: "kasse",
    name:
      geraetName.trim() ||
      (user.email ? anzeigeName(user.email) : name || "Kasse"),
    code,
    erstelltAm: serverTimestamp(),
  });
}

async function einladungEinloesenFuer(user: User, code: string, name: string) {
  const einladung = await getDoc(einladungRef(code));
  const daten = einladung.data() as Einladung | undefined;
  if (!daten || daten.benutztVon) {
    throw new BeitrittFehler(
      "Diese Einladung gibt es nicht oder sie wurde schon benutzt.",
    );
  }
  const batch = writeBatch(db);
  batch.set(zugangRef(user.uid), {
    veranstalterId: daten.veranstalterId,
    rolle: "admin",
    name,
    einladung: code,
    erstelltAm: serverTimestamp(),
  });
  batch.update(einladungRef(code), {
    benutztVon: user.uid,
    benutztAm: serverTimestamp(),
  });
  await batch.commit();
}

// Bereits angemeldeter Account (z. B. alter Login) löst eine Einladung ein.
export async function einladungEinloesen(eingabe: string) {
  const user = auth.currentUser;
  if (!user) throw new BeitrittFehler("Nicht angemeldet.");
  const code = normalisiereCode(eingabe);
  await einladungEinloesenFuer(user, code, anzeigeName(user.email) || "Admin");
}

// Neuer Admin-Account mit Benutzername + Passwort per Einladung.
export async function mitEinladungRegistrieren(
  eingabe: string,
  benutzername: string,
  passwort: string,
) {
  const code = normalisiereCode(eingabe);
  if (code.length < 6) throw new BeitrittFehler("Bitte den Einladungscode eingeben.");
  const { user } = await createUserWithEmailAndPassword(
    auth,
    zuLoginEmail(benutzername),
    passwort,
  );
  try {
    await einladungEinloesenFuer(user, code, anzeigeName(user.email));
  } catch (fehler) {
    // Ohne gültige Einladung keinen verwaisten Account zurücklassen.
    await deleteUser(user).catch(() => {});
    throw fehler;
  }
}
