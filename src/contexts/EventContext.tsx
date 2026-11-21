"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onSnapshot } from "firebase/firestore";
import { useMeldung } from "@/contexts/MeldungContext";
import {
  eventsCollectionRef,
  standardEvent,
  type JazzEvent,
  type JazzEventMitId,
} from "@/lib/events";

interface EventContextValue {
  events: JazzEventMitId[];
  aktivesEvent: JazzEventMitId | undefined;
  waehleEvent: (eventId: string) => void;
  geladen: boolean;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

// Die Auswahl gilt pro Gerät (localStorage) - so kann ein Handy schon das
// Event von Samstag zeigen, während ein anderes noch Freitag nachträgt.
const SPEICHER_SCHLUESSEL = "jazzfest-aktives-event";

function leseGespeichertesEvent(): string | null {
  try {
    return localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch {
    return null;
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const { zeigeFehler } = useMeldung();
  const [events, setEvents] = useState<JazzEventMitId[]>([]);
  const [geladen, setGeladen] = useState(false);
  // Lazy-Init ist hier hydrationssicher: aktivesEvent hängt zusätzlich an
  // den Events, die ohnehin erst nach dem ersten (asynchronen) Snapshot da
  // sind - der erste Client-Render sieht also dasselbe wie der Server.
  const [gewaehlteId, setGewaehlteId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : leseGespeichertesEvent(),
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      eventsCollectionRef(),
      (snapshot) => {
        const liste = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as JazzEvent),
        }));
        liste.sort((a, b) => a.datum.localeCompare(b.datum));
        setEvents(liste);
        setGeladen(true);
      },
      (fehler) => {
        setGeladen(true);
        zeigeFehler("Events konnten nicht geladen werden.", fehler);
      },
    );
    return unsubscribe;
  }, [zeigeFehler]);

  const waehleEvent = useCallback((eventId: string) => {
    setGewaehlteId(eventId);
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, eventId);
    } catch {
      // Ohne Speicher gilt die Auswahl nur bis zum Neuladen - kein Problem.
    }
  }, []);

  const aktivesEvent = useMemo(
    () =>
      events.find((event) => event.id === gewaehlteId) ?? standardEvent(events),
    [events, gewaehlteId],
  );

  return (
    <EventContext.Provider
      value={{ events, aktivesEvent, waehleEvent, geladen }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvents(): EventContextValue {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error("useEvents muss innerhalb von EventProvider verwendet werden");
  }
  return context;
}
