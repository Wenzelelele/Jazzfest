"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatiereDatum,
  heuteIso,
  type JazzEvent,
  type JazzEventMitId,
} from "@/lib/events";
import {
  gastDocRef,
  istAngefragt,
  oeffentlicheAnfragenSenden,
  type Gast,
} from "@/lib/gaeste";
import {
  eintraegeAusGruppe,
  enthaeltKopfzeilen,
  parseGaesteText,
  type GastEintrag,
} from "@/lib/textImport";
import {
  eventsVon,
  veranstalterRef,
  type Veranstalter,
} from "@/lib/veranstalter";

// Öffentliche Seite ohne Login (/gaesteliste/{veranstalter}): Bands,
// Musiker & Co. bekommen den Link des Veranstalters und
// fragen hier Gäste an. Die Anfragen landen als "angefragt" beim Admin
// (Seite Anfragen) und stehen erst nach der Freigabe auf der Einlassliste.
// Ohne Login kann man die Gästeliste nicht lesen - nur die eigenen, von
// diesem Gerät gesendeten Anfragen per ID (Status-Anzeige unten).

const MAX_EINTRAEGE = 40;
const SPEICHER_ANSPRECHPARTNER = "jazzfest-ansprechpartner";
const SPEICHER_ANFRAGEN = "jazzfest-meine-anfragen";

interface MeineAnfrage {
  eventId: string;
  id: string;
  name: string;
  personen: number;
  ansprechpartner: string;
}

function lese<T>(schluessel: string, standard: T): T {
  try {
    const wert = localStorage.getItem(schluessel);
    return wert === null ? standard : (JSON.parse(wert) as T);
  } catch {
    return standard;
  }
}

function speichere(schluessel: string, wert: unknown) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Ohne Speicher fehlt nur die Status-Anzeige - kein Problem.
  }
}

type AnfrageStatus = "offen" | "freigegeben" | "abgelehnt" | "unbekannt";

function useAnfrageStatus(anfragen: MeineAnfrage[]) {
  const [status, setStatus] = useState<Record<string, AnfrageStatus>>({});
  const schluessel = anfragen.map((a) => `${a.eventId}/${a.id}`).join(",");

  useEffect(() => {
    if (!schluessel) return;
    const abmelden = schluessel.split(",").map((pfad) => {
      const [eventId, id] = pfad.split("/");
      return onSnapshot(
        gastDocRef(eventId, id),
        (snapshot) => {
          const gast = snapshot.data() as Gast | undefined;
          const wert: AnfrageStatus = !snapshot.exists()
            ? // Noch nicht beim Server angekommen (offline) zählt als offen,
              // ein vom Admin gelöschter Eintrag als abgelehnt.
              snapshot.metadata.fromCache
              ? "unbekannt"
              : "abgelehnt"
            : gast && istAngefragt(gast)
              ? "offen"
              : "freigegeben";
          setStatus((alt) => ({ ...alt, [id]: wert }));
        },
        () => setStatus((alt) => ({ ...alt, [id]: "unbekannt" })),
      );
    });
    return () => abmelden.forEach((ab) => ab());
  }, [schluessel]);

  return status;
}

const STATUS_ANZEIGE: Record<AnfrageStatus, { text: string; klasse: string }> =
  {
    offen: { text: "wartet auf Freigabe", klasse: "text-amber-800" },
    freigegeben: { text: "✓ auf der Liste", klasse: "text-green-800" },
    abgelehnt: { text: "nicht auf der Liste", klasse: "text-red-700" },
    unbekannt: { text: "…", klasse: "text-stone-400" },
  };

function MeineAnfragen({
  anfragen,
  events,
}: {
  anfragen: MeineAnfrage[];
  events: JazzEventMitId[];
}) {
  const status = useAnfrageStatus(anfragen);
  if (anfragen.length === 0) return null;
  const eventName = (id: string) => {
    const event = events.find((e) => e.id === id);
    return event ? `${event.name} · ${formatiereDatum(event.datum)}` : "Event";
  };
  const eventIds = [...new Set(anfragen.map((a) => a.eventId))];

  return (
    <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
      <h2 className="font-display text-base font-semibold text-stone-900">
        Von diesem Gerät angefragt
      </h2>
      {eventIds.map((eventId) => (
        <div key={eventId} className="space-y-1">
          <p className="text-xs text-stone-500">{eventName(eventId)}</p>
          <ul className="divide-y divide-stone-100 text-sm">
            {anfragen
              .filter((a) => a.eventId === eventId)
              .map((a) => {
                const anzeige = STATUS_ANZEIGE[status[a.id] ?? "unbekannt"];
                return (
                  <li key={a.id} className="flex justify-between gap-3 py-2">
                    <span className="text-stone-800">
                      {a.name}
                      {a.personen > 1 && (
                        <span className="text-stone-500"> +{a.personen - 1}</span>
                      )}
                    </span>
                    <span className={`shrink-0 text-xs ${anzeige.klasse}`}>
                      {anzeige.text}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}

type Schritt =
  | { art: "event" }
  | { art: "formular"; eventId: string }
  | { art: "gesendet"; eventId: string; anzahl: number; personen: number };

export function AnfrageSeite({ veranstalterId }: { veranstalterId: string }) {
  const { user } = useAuth();
  const [veranstalter, setVeranstalter] = useState<
    Veranstalter | null | undefined
  >(undefined);
  const [events, setEvents] = useState<JazzEventMitId[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>({ art: "event" });
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [text, setText] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [meine, setMeine] = useState<MeineAnfrage[]>([]);

  // localStorage erst nach dem ersten Render lesen (hydrationssicher).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnsprechpartner(lese(SPEICHER_ANSPRECHPARTNER, ""));
    setMeine(lese<MeineAnfrage[]>(SPEICHER_ANFRAGEN, []));
  }, []);

  useEffect(
    () =>
      onSnapshot(
        veranstalterRef(veranstalterId),
        (s) => setVeranstalter(s.exists() ? (s.data() as Veranstalter) : null),
        () => setVeranstalter(null),
      ),
    [veranstalterId],
  );

  useEffect(
    () =>
      onSnapshot(
        eventsVon(veranstalterId),
        (snapshot) => {
          const heute = heuteIso();
          setEvents(
            snapshot.docs
              .map((d) => ({ id: d.id, ...(d.data() as JazzEvent) }))
              .filter((event) => event.datum >= heute)
              .sort((a, b) => a.datum.localeCompare(b.datum)),
          );
          setGeladen(true);
        },
        (err) => {
          console.error(err);
          setLadeFehler(true);
          setGeladen(true);
        },
      ),
    [veranstalterId],
  );

  const eintraege: GastEintrag[] = useMemo(() => {
    const gruppen = parseGaesteText(text).filter((g) => g.hauptgast);
    const einzeln = !enthaeltKopfzeilen(gruppen);
    return gruppen.flatMap((g) => eintraegeAusGruppe(g, einzeln));
  }, [text]);
  const personen = eintraege.reduce(
    (summe, e) => summe + 1 + e.begleitungNamen.length,
    0,
  );

  const aktivesEvent =
    schritt.art === "event"
      ? undefined
      : events.find((e) => e.id === schritt.eventId);

  async function handleSenden(event: FormEvent) {
    event.preventDefault();
    if (schritt.art !== "formular") return;
    const partner = ansprechpartner.trim();
    if (!partner) {
      setFehler("Bitte angeben, über wen die Gäste kommen.");
      return;
    }
    if (eintraege.length === 0) {
      setFehler("Bitte mindestens einen Namen eintragen.");
      return;
    }
    if (eintraege.length > MAX_EINTRAEGE) {
      setFehler(`Bitte höchstens ${MAX_EINTRAEGE} Namen auf einmal.`);
      return;
    }
    setFehler(null);
    setSendet(true);
    speichere(SPEICHER_ANSPRECHPARTNER, partner);

    const { ids, gesendet } = oeffentlicheAnfragenSenden(
      schritt.eventId,
      eintraege,
      partner,
      notiz.trim(),
    );
    try {
      await gesendet;
    } catch (err) {
      console.error(err);
      setSendet(false);
      setFehler(
        "Senden hat nicht geklappt. Bitte Internetverbindung prüfen und nochmal versuchen.",
      );
      return;
    }
    const neu: MeineAnfrage[] = eintraege.map((e, i) => ({
      eventId: schritt.eventId,
      id: ids[i],
      name: e.name,
      personen: 1 + e.begleitungNamen.length,
      ansprechpartner: partner,
    }));
    const alle = [...meine, ...neu];
    setMeine(alle);
    speichere(SPEICHER_ANFRAGEN, alle);
    setSendet(false);
    setText("");
    setNotiz("");
    setSchritt({
      art: "gesendet",
      eventId: schritt.eventId,
      anzahl: eintraege.length,
      personen,
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white p-4">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-stone-900">
              {veranstalter?.name ?? "Gästeliste"}
            </h1>
            <p className="text-xs text-stone-500">Gäste für die Gästeliste anfragen</p>
          </div>
          {user && (
            <Link
              href="/"
              className="flex min-h-12 items-center rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
            >
              Zur Einlassliste
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        {veranstalter === null && (
          <p className="text-sm text-stone-600">
            Diesen Veranstalter gibt es nicht (mehr). Bitte den Link prüfen.
          </p>
        )}

        {veranstalter && schritt.art === "event" && (
          <>
            <p className="text-sm text-stone-600">
              Für welches Event möchtest du Gäste auf die Liste setzen?
            </p>
            {!geladen && <p className="text-sm text-stone-500">Lädt…</p>}
            {ladeFehler && (
              <p role="alert" className="text-sm text-red-700">
                Events konnten nicht geladen werden. Bitte Internetverbindung
                prüfen und die Seite neu laden.
              </p>
            )}
            {geladen && !ladeFehler && events.length === 0 && (
              <p className="text-sm text-stone-500">
                Gerade sind keine Events offen.
              </p>
            )}
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFehler(null);
                      setSchritt({ art: "formular", eventId: event.id });
                    }}
                    className="flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-stone-300 bg-white px-4 text-left hover:bg-stone-100"
                  >
                    <span>
                      <span className="block font-medium text-stone-900">
                        {event.name}
                      </span>
                      <span className="block text-sm text-stone-500">
                        {formatiereDatum(event.datum)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-stone-400">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {schritt.art === "formular" && (
          <form onSubmit={handleSenden} className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">
                  {aktivesEvent?.name ?? "Event"}
                </p>
                {aktivesEvent && (
                  <p className="text-xs text-stone-500">
                    {formatiereDatum(aktivesEvent.datum)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSchritt({ art: "event" })}
                className="min-h-12 shrink-0 rounded-md border border-stone-300 px-3 text-xs text-stone-600 hover:bg-stone-100"
              >
                Event ändern
              </button>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="ansprechpartner"
                className="text-sm font-medium text-stone-800"
              >
                Über wen kommen die Gäste?
              </label>
              <p className="text-xs text-stone-500">
                Ansprechpartner bzw. Bezugsperson, z. B. Band, Musiker oder
                Organisator.
              </p>
              <input
                id="ansprechpartner"
                type="text"
                required
                maxLength={80}
                autoComplete="organization"
                placeholder="z. B. Band Blue Notes / Max Mustermann"
                value={ansprechpartner}
                onChange={(e) => setAnsprechpartner(e.target.value)}
                className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="namen"
                className="text-sm font-medium text-stone-800"
              >
                Namen der Gäste
              </label>
              <p className="text-xs text-stone-500">
                Ein Name pro Zeile oder mit Komma getrennt - oder einfach die
                WhatsApp-Nachricht einfügen, die Namen werden automatisch
                erkannt. „+1&rdquo; hinter einem Namen = eine Begleitperson.
              </p>
              <textarea
                id="namen"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Anna Becker +1\nJonas Weber\nLena Schmitt"}
                className="w-full rounded-md border border-stone-300 bg-stone-50 p-3 text-stone-900 outline-none focus:border-stone-500"
              />
            </div>

            {eintraege.length > 0 && (
              <div className="rounded-md border border-stone-200 bg-white p-3">
                <p className="mb-2 text-xs text-stone-500">
                  Erkannt: {eintraege.length}{" "}
                  {eintraege.length === 1 ? "Name" : "Namen"}, {personen}{" "}
                  {personen === 1 ? "Person" : "Personen"}
                </p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {eintraege.map((e, i) => (
                    <li
                      key={i}
                      className="rounded bg-stone-100 px-2 py-1 text-stone-800"
                    >
                      {e.name}
                      {e.begleitungNamen.length > 0 && (
                        <span className="text-stone-500">
                          {" "}
                          +{e.begleitungNamen.length}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="notiz" className="text-sm text-stone-600">
                Nachricht an den Veranstalter (optional)
              </label>
              <input
                id="notiz"
                type="text"
                maxLength={200}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                className="min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500"
              />
            </div>

            {fehler && (
              <p role="alert" className="text-sm text-red-700">
                {fehler}
              </p>
            )}

            <button
              type="submit"
              disabled={sendet || eintraege.length === 0}
              className="min-h-12 w-full rounded-md bg-stone-900 px-5 font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-60"
            >
              {sendet
                ? "Wird gesendet…"
                : eintraege.length > 1
                  ? `${eintraege.length} Gäste anfragen`
                  : "Gast anfragen"}
            </button>
            <p className="text-center text-xs text-stone-500">
              Die Gäste stehen erst auf der Liste, wenn der Veranstalter die
              Anfrage freigegeben hat.
            </p>
          </form>
        )}

        {schritt.art === "gesendet" && (
          <div className="space-y-4 rounded-md border border-stone-200 bg-white p-5 text-center">
            <p className="font-display text-lg font-semibold text-stone-900">
              Anfrage gesendet
            </p>
            <p className="text-sm text-stone-600">
              {schritt.anzahl} {schritt.anzahl === 1 ? "Name" : "Namen"} (
              {schritt.personen}{" "}
              {schritt.personen === 1 ? "Person" : "Personen"}) für{" "}
              {aktivesEvent?.name ?? "das Event"}. Sobald der Veranstalter
              freigibt, siehst du das unten.
            </p>
            <button
              type="button"
              onClick={() =>
                setSchritt({ art: "formular", eventId: schritt.eventId })
              }
              className="min-h-12 w-full rounded-md bg-stone-900 font-medium text-stone-50"
            >
              Weitere Gäste anfragen
            </button>
            <button
              type="button"
              onClick={() => setSchritt({ art: "event" })}
              className="min-h-12 w-full rounded-md border border-stone-300 text-sm text-stone-700"
            >
              Anderes Event
            </button>
          </div>
        )}

        <MeineAnfragen anfragen={meine} events={events} />
      </main>

      <footer className="p-6 text-center">
        <Link href="/login" className="text-xs text-stone-400 underline">
          Team-Login (Kasse / Admin)
        </Link>
      </footer>
    </div>
  );
}
