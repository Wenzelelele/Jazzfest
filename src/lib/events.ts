import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  alleGaesteLoeschen,
  gaesteCollectionRef,
  type Gast,
} from "@/lib/gaeste";

export interface JazzEvent {
  name: string;
  // ISO-Datum "YYYY-MM-DD" - als String statt Timestamp, damit "heute"
  // ohne Zeitzonen-Rechnerei verglichen werden kann.
  datum: string;
  // Personen ohne Listeneintrag (Abendkasse). Wird ausschließlich per
  // increment() geändert: Firestore merged Inkremente mehrerer
  // Offline-Geräte beim Sync korrekt, statt den Wert zu überschreiben.
  abendkasse?: number;
  erstelltAm: Timestamp | null;
  // Fehlt nur bei Events aus der Zeit vor den Veranstaltern - ein
  // Super-Admin ordnet sie auf der Seite "Veranstalter" zu.
  veranstalterId?: string;
}

export interface JazzEventMitId extends JazzEvent {
  id: string;
}

export function eventsCollectionRef() {
  return collection(db, "events");
}

export function eventDocRef(eventId: string) {
  return doc(db, "events", eventId);
}

export function heuteIso(): string {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, "0");
  const tag = String(jetzt.getDate()).padStart(2, "0");
  return `${jetzt.getFullYear()}-${monat}-${tag}`;
}

export function formatiereDatum(iso: string): string {
  const [jahr, monat, tag] = iso.split("-").map(Number);
  if (!jahr || !monat || !tag) return iso;
  return new Date(jahr, monat - 1, tag).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Standard-Event, wenn auf dem Gerät noch keins gewählt ist: das von heute,
// sonst das nächste kommende, sonst das zuletzt vergangene.
export function standardEvent(
  events: readonly JazzEventMitId[],
): JazzEventMitId | undefined {
  if (events.length === 0) return undefined;
  const heute = heuteIso();
  const kommende = events
    .filter((event) => event.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (kommende.length > 0) return kommende[0];
  return [...events].sort((a, b) => b.datum.localeCompare(a.datum))[0];
}

// Die ID wird lokal erzeugt und sofort zurückgegeben - so kann das neue
// Event auch offline direkt ausgewählt werden (das Schreib-Promise löst
// erst nach dem Sync auf).
export function erstelleEvent(
  veranstalterId: string,
  name: string,
  datum: string,
): { id: string; gespeichert: Promise<void> } {
  const ref = doc(eventsCollectionRef());
  const gespeichert = setDoc(ref, {
    veranstalterId,
    name: name.trim(),
    datum,
    abendkasse: 0,
    erstelltAm: serverTimestamp(),
  });
  return { id: ref.id, gespeichert };
}

export async function aktualisiereEvent(
  eventId: string,
  daten: { name: string; datum: string },
) {
  await updateDoc(eventDocRef(eventId), {
    name: daten.name.trim(),
    datum: daten.datum,
  });
}

export async function loescheEvent(eventId: string) {
  await alleGaesteLoeschen(eventId);
  await deleteDoc(eventDocRef(eventId));
}

export async function abendkasseAendern(eventId: string, delta: number) {
  await updateDoc(eventDocRef(eventId), { abendkasse: increment(delta) });
}

const BATCH_GROESSE = 450;

// Kopiert alle Mitglieder (quelle "mitglied") aus einem anderen Event, mit
// zurückgesetztem Check-in. Namen, die im Ziel-Event schon existieren,
// werden übersprungen - mehrfaches Klicken erzeugt keine Dubletten.
export async function mitgliederUebernehmen(
  vonEventId: string,
  nachEventId: string,
): Promise<number> {
  const [quelle, ziel] = await Promise.all([
    getDocs(gaesteCollectionRef(vonEventId)),
    getDocs(gaesteCollectionRef(nachEventId)),
  ]);
  const vorhanden = new Set(
    ziel.docs.map((d) => (d.data() as Gast).nameLower),
  );
  const mitglieder = quelle.docs
    .map((d) => d.data() as Gast)
    .filter((gast) => gast.quelle === "mitglied" && !vorhanden.has(gast.nameLower));

  for (let start = 0; start < mitglieder.length; start += BATCH_GROESSE) {
    const batch = writeBatch(db);
    for (const gast of mitglieder.slice(start, start + BATCH_GROESSE)) {
      batch.set(doc(gaesteCollectionRef(nachEventId)), {
        name: gast.name,
        nameLower: gast.nameLower,
        quelle: "mitglied",
        notiz: gast.notiz ?? "",
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
        begleitung: {},
        erstelltAm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return mitglieder.length;
}
