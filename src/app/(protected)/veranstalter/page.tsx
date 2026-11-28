"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMeldung } from "@/contexts/MeldungContext";
import { NurSuperAdmin } from "@/components/NurAdmin";
import { eingabeKlasse } from "@/components/Beitreten";
import {
  eventsCollectionRef,
  formatiereDatum,
  type JazzEvent,
  type JazzEventMitId,
} from "@/lib/events";
import {
  erstelleEinladung,
  erstelleVeranstalter,
  eventsZuordnen,
  kurznameAus,
  veranstalterCollectionRef,
  type Veranstalter,
  type VeranstalterMitId,
} from "@/lib/veranstalter";

// Super-Admin: Veranstalter anlegen und zwischen ihnen wechseln. Löschen
// geht wie für jeden Admin über "Kassen & Zugänge" des Veranstalters.

function NeuerVeranstalter() {
  const { zeigeFehler, zeigeInfo } = useMeldung();
  const [name, setName] = useState("");
  const [kurzname, setKurzname] = useState("");
  const [kurznameGeaendert, setKurznameGeaendert] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const vorschlag = kurznameGeaendert ? kurzname : kurznameAus(name);

  async function anlegen(event: FormEvent) {
    event.preventDefault();
    setLaeuft(true);
    try {
      const id = await erstelleVeranstalter(name, vorschlag);
      zeigeInfo(`${name.trim()} angelegt (/gaesteliste/${id})`);
      setName("");
      setKurzname("");
      setKurznameGeaendert(false);
    } catch (fehler) {
      zeigeFehler(
        fehler instanceof Error && !("code" in fehler)
          ? fehler.message
          : "Veranstalter konnte nicht angelegt werden.",
        fehler,
      );
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form
      onSubmit={anlegen}
      className="space-y-3 rounded-md border border-stone-200 bg-white p-4"
    >
      <h2 className="font-display text-base font-semibold text-stone-900">
        Neuer Veranstalter
      </h2>
      <input
        type="text"
        required
        placeholder="Name, z. B. Jazz im Mühlbach"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={eingabeKlasse}
      />
      <div className="space-y-1">
        <label htmlFor="kurzname" className="text-xs text-stone-500">
          Kurzname für den Anfrage-Link (lässt sich später nicht ändern)
        </label>
        <div className="flex items-center gap-1 text-sm text-stone-500">
          <span>/gaesteliste/</span>
          <input
            id="kurzname"
            type="text"
            required
            value={vorschlag}
            onChange={(e) => {
              setKurznameGeaendert(true);
              setKurzname(e.target.value);
            }}
            className={eingabeKlasse}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={laeuft || !name.trim() || !kurznameAus(vorschlag)}
        className="min-h-12 w-full rounded-md bg-stone-900 font-medium text-stone-50 disabled:opacity-60"
      >
        Anlegen
      </button>
    </form>
  );
}

function OhneVeranstalter({ liste }: { liste: VeranstalterMitId[] }) {
  const { beobachte, zeigeInfo } = useMeldung();
  const [events, setEvents] = useState<JazzEventMitId[]>([]);
  const [ziel, setZiel] = useState("");

  useEffect(
    () =>
      onSnapshot(eventsCollectionRef(), (s) =>
        setEvents(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as JazzEvent) }))
            .filter((e) => !e.veranstalterId),
        ),
      ),
    [],
  );

  if (events.length === 0 || liste.length === 0) return null;
  const zielId = ziel || liste[0].id;

  return (
    <section className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">
        <strong>{events.length} Events</strong> aus der Zeit vor den
        Veranstaltern sind noch niemandem zugeordnet und deshalb gerade
        unsichtbar:{" "}
        {events.map((e) => `${e.name} (${formatiereDatum(e.datum)})`).join(", ")}
      </p>
      <select
        value={zielId}
        onChange={(e) => setZiel(e.target.value)}
        className={eingabeKlasse}
      >
        {liste.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          beobachte(
            eventsZuordnen(
              events.map((e) => e.id),
              zielId,
            ),
            "Zuordnen fehlgeschlagen.",
          );
          zeigeInfo("Events zugeordnet");
        }}
        className="min-h-12 w-full rounded-md bg-stone-900 font-medium text-stone-50"
      >
        Alle zuordnen
      </button>
    </section>
  );
}

function VeranstalterInhalt() {
  const { veranstalterId, waehleVeranstalter } = useAuth();
  const { zeigeFehler } = useMeldung();
  const router = useRouter();
  const [liste, setListe] = useState<VeranstalterMitId[]>([]);
  const [einladung, setEinladung] = useState<Record<string, string>>({});

  useEffect(
    () =>
      onSnapshot(
        veranstalterCollectionRef(),
        (s) =>
          setListe(
            s.docs
              .map((d) => ({ id: d.id, ...(d.data() as Veranstalter) }))
              .sort((a, b) => a.name.localeCompare(b.name, "de")),
          ),
        (fehler) => zeigeFehler("Veranstalter konnten nicht geladen werden.", fehler),
      ),
    [zeigeFehler],
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 p-4 backdrop-blur">
        {veranstalterId && (
          <Link
            href="/"
            className="flex min-h-12 items-center rounded-md px-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            ← Zurück
          </Link>
        )}
        <h1 className="flex-1 font-display text-lg font-semibold text-stone-900">
          Veranstalter
        </h1>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="min-h-12 rounded-md border border-stone-300 px-3 text-xs text-stone-600"
        >
          Abmelden
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
        <p className="text-sm text-stone-600">
          Als Super-Admin siehst du alle Veranstalter und kannst in jedem
          arbeiten. Jeder Veranstalter hat eigene Events, Kassen und Admins.
          Den ersten Admin lädst du hier ein, alles Weitere (Kassen-Codes,
          weitere Admins, Löschen) macht er unter „Kassen & Zugänge“.
        </p>

        <OhneVeranstalter liste={liste} />

        <ul className="space-y-3">
          {liste.map((v) => (
            <li
              key={v.id}
              className={`space-y-3 rounded-md border bg-white p-4 ${
                v.id === veranstalterId ? "border-stone-900" : "border-stone-200"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-stone-900">{v.name}</span>
                <span className="font-mono text-xs text-stone-500">
                  /gaesteliste/{v.id}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    waehleVeranstalter(v.id);
                    router.push("/");
                  }}
                  className="min-h-12 flex-1 rounded-md bg-stone-900 text-sm font-medium text-stone-50"
                >
                  {v.id === veranstalterId ? "Öffnen (aktiv)" : "Öffnen"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    erstelleEinladung(v.id)
                      .then((code) =>
                        setEinladung((alt) => ({ ...alt, [v.id]: code })),
                      )
                      .catch((fehler) =>
                        zeigeFehler("Einladung fehlgeschlagen.", fehler),
                      )
                  }
                  className="min-h-12 flex-1 rounded-md border border-stone-300 text-sm text-stone-700"
                >
                  Admin einladen
                </button>
              </div>
              {einladung[v.id] && (
                <p className="rounded-md bg-stone-100 p-2 font-mono text-xs break-all text-stone-800">
                  {typeof window !== "undefined" && window.location.origin}
                  /login?einladung={einladung[v.id]}
                </p>
              )}
            </li>
          ))}
        </ul>

        <NeuerVeranstalter />
      </main>
    </div>
  );
}

export default function VeranstalterSeite() {
  return (
    <NurSuperAdmin>
      <VeranstalterInhalt />
    </NurSuperAdmin>
  );
}
