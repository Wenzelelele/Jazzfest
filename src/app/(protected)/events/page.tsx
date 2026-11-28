"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import {
  aktualisiereEvent,
  erstelleEvent,
  formatiereDatum,
  heuteIso,
  loescheEvent,
  mitgliederUebernehmen,
  type JazzEventMitId,
} from "@/lib/events";
import { ladeCsvHerunter } from "@/lib/export";
import { gaesteCollectionRef, type Gast, type GastMitId } from "@/lib/gaeste";

const eingabe =
  "min-h-12 w-full rounded-md border border-stone-300 bg-stone-50 px-3 text-stone-900 outline-none focus:border-stone-500";
const knopfSekundaer =
  "min-h-12 rounded-md border border-stone-300 px-3 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50";

async function exportiereEvent(event: JazzEventMitId) {
  const snapshot = await getDocs(gaesteCollectionRef(event.id));
  const gaeste: GastMitId[] = snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Gast) }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  ladeCsvHerunter(event, gaeste);
}

function NeuesEvent() {
  const { waehleEvent } = useEvents();
  const { veranstalterId } = useAuth();
  const { zeigeFehler, zeigeInfo } = useMeldung();
  const [name, setName] = useState("");
  const [datum, setDatum] = useState(heuteIso());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !datum || !veranstalterId) return;
    const { id, gespeichert } = erstelleEvent(veranstalterId, name, datum);
    waehleEvent(id);
    gespeichert.catch((fehler) =>
      zeigeFehler("Event konnte nicht angelegt werden.", fehler),
    );
    zeigeInfo(`Event „${name.trim()}" angelegt`);
    setName("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-stone-200 bg-white p-4"
    >
      <h2 className="font-display text-base font-semibold text-stone-900">
        Neues Event
      </h2>
      <input
        type="text"
        placeholder="Name, z. B. Jazzfest Freitag"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={eingabe}
        required
      />
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        className={eingabe}
        required
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="min-h-12 w-full rounded-md bg-stone-900 font-medium text-stone-50 disabled:opacity-60"
      >
        Event anlegen
      </button>
    </form>
  );
}

function EventKarte({
  event,
  aktiv,
  andereEvents,
  istAdmin,
}: {
  event: JazzEventMitId;
  aktiv: boolean;
  andereEvents: JazzEventMitId[];
  istAdmin: boolean;
}) {
  const { waehleEvent } = useEvents();
  const { zeigeFehler, zeigeInfo, beobachte } = useMeldung();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [name, setName] = useState(event.name);
  const [datum, setDatum] = useState(event.datum);
  const [quelleId, setQuelleId] = useState(andereEvents[0]?.id ?? "");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [loeschenBestaetigen, setLoeschenBestaetigen] = useState(false);

  // Seltene Admin-Aktionen: hier bewusst MIT await, damit die Rückmeldung
  // erst kommt, wenn der Server wirklich fertig ist.
  async function ausfuehren(schritt: string, aktion: () => Promise<string>) {
    setLaeuft(schritt);
    try {
      zeigeInfo(await aktion());
    } catch (fehler) {
      zeigeFehler(`${schritt} fehlgeschlagen.`, fehler);
    } finally {
      setLaeuft(null);
    }
  }

  return (
    <div
      className={`space-y-3 rounded-md border bg-white p-4 ${
        aktiv ? "border-amber-700 ring-1 ring-amber-700" : "border-stone-200"
      }`}
    >
      {bearbeiten ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            beobachte(
              aktualisiereEvent(event.id, { name, datum }),
              "Event konnte nicht gespeichert werden.",
            );
            setBearbeiten(false);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={eingabe}
            required
          />
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className={eingabe}
            required
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBearbeiten(false)}
              className={`${knopfSekundaer} flex-1`}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="min-h-12 flex-1 rounded-md bg-stone-900 text-sm font-medium text-stone-50"
            >
              Speichern
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-stone-900">{event.name}</p>
            <p className="text-sm text-stone-500">
              {formatiereDatum(event.datum)}
            </p>
          </div>
          {aktiv ? (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Auf diesem Gerät aktiv
            </span>
          ) : (
            <button
              type="button"
              onClick={() => waehleEvent(event.id)}
              className="min-h-12 rounded-md bg-stone-900 px-4 text-sm font-medium text-stone-50"
            >
              Auswählen
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {aktiv && (
          <Link href="/" className={`${knopfSekundaer} flex items-center`}>
            Zur Liste
          </Link>
        )}
        {istAdmin && !bearbeiten && (
          <button
            type="button"
            onClick={() => setBearbeiten(true)}
            className={knopfSekundaer}
          >
            Bearbeiten
          </button>
        )}
        {istAdmin && (
          <button
            type="button"
            disabled={laeuft !== null}
            onClick={() =>
              ausfuehren("Export", async () => {
                await exportiereEvent(event);
                return "CSV-Export erstellt.";
              })
            }
            className={knopfSekundaer}
          >
            {laeuft === "Export" ? "Exportiert…" : "Export CSV"}
          </button>
        )}
      </div>

      {istAdmin && andereEvents.length > 0 && (
        <div className="space-y-2 border-t border-stone-200 pt-3">
          <p className="text-sm text-stone-600">
            JIM Mitglieder aus anderem Event übernehmen (Check-in startet neu,
            vorhandene Namen werden übersprungen):
          </p>
          <div className="flex gap-2">
            <select
              value={quelleId}
              onChange={(e) => setQuelleId(e.target.value)}
              className={`${eingabe} flex-1`}
            >
              {andereEvents.map((anderes) => (
                <option key={anderes.id} value={anderes.id}>
                  {anderes.name} ({formatiereDatum(anderes.datum)})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!quelleId || laeuft !== null}
              onClick={() =>
                ausfuehren("Übernahme", async () => {
                  const anzahl = await mitgliederUebernehmen(
                    quelleId,
                    event.id,
                  );
                  return `${anzahl} Mitglieder übernommen.`;
                })
              }
              className={knopfSekundaer}
            >
              {laeuft === "Übernahme" ? "Läuft…" : "Übernehmen"}
            </button>
          </div>
        </div>
      )}

      {istAdmin && (
        <div className="border-t border-stone-200 pt-3">
          {loeschenBestaetigen ? (
            <div className="space-y-2">
              <p className="text-sm text-stone-600">
                Event <strong>{event.name}</strong> mit allen Gästen,
                Mitgliedern und Check-ins endgültig löschen? Vorher am besten
                exportieren.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLoeschenBestaetigen(false)}
                  className={`${knopfSekundaer} flex-1`}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={laeuft !== null}
                  onClick={() =>
                    ausfuehren("Löschen", async () => {
                      await loescheEvent(event.id);
                      return `Event „${event.name}" gelöscht.`;
                    })
                  }
                  className="min-h-12 flex-1 rounded-md bg-red-700 text-sm text-white disabled:opacity-60"
                >
                  {laeuft === "Löschen" ? "Löscht…" : "Endgültig löschen"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLoeschenBestaetigen(true)}
              className="min-h-10 text-sm text-red-700 underline-offset-2 hover:underline"
            >
              Event löschen…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventsSeite() {
  const { events, aktivesEvent, geladen } = useEvents();
  const { istAdmin } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ← Zurück
        </Link>
        <h1 className="font-display text-lg font-semibold text-stone-900">
          {istAdmin ? "Events" : "Event wählen"}
        </h1>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <p className="text-sm text-stone-500">
          Jedes Event hat eigene Listen und eigene Check-ins. Die Auswahl gilt
          pro Gerät. Wichtig: Jedes Einlass-Gerät sollte das Event vorher einmal
          online geöffnet haben, damit es offline verfügbar ist.
        </p>

        {geladen && events.length === 0 && (
          <p className="text-sm text-stone-600">Noch keine Events.</p>
        )}

        {events.map((event) => (
          <EventKarte
            key={event.id}
            event={event}
            aktiv={event.id === aktivesEvent?.id}
            andereEvents={events.filter((anderes) => anderes.id !== event.id)}
            istAdmin={istAdmin}
          />
        ))}

        {istAdmin && <NeuesEvent />}
      </main>
    </div>
  );
}
