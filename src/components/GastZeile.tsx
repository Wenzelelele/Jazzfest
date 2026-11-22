"use client";

import { useEffect, useRef, useState } from "react";
import { useEvents } from "@/contexts/EventContext";
import { useMeldung } from "@/contexts/MeldungContext";
import {
  checkInBegleitung,
  checkInHauptgast,
  eingecheckePersonen,
  gesamtPersonen,
  sortiereBegleitungKeys,
  type GastMitId,
} from "@/lib/gaeste";
import { namePasst } from "@/lib/suche";

const LANGDRUCK_MS = 700;

// Der Status (da / nicht da) muss auch ohne genaues Lesen erkennbar sein:
// nicht eingecheckt ist eine schlichte Outline (leere Form), eingecheckt ist
// vollflächig gefüllt plus Häkchen - Form und Kontrast tragen die Aussage,
// die Farbe ist nur eine zusätzliche Verstärkung, keine Voraussetzung.
//
// Einchecken: ein Tap. Auschecken: gedrückt halten (Fortschritt füllt sich
// sichtbar) - ein versehentlicher Tap im Gedränge checkt so niemanden aus.
function CheckInButton({
  checkedIn,
  onCheckIn,
  onCheckOut,
  onKurzerTipp,
}: {
  checkedIn: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onKurzerTipp: () => void;
}) {
  const [drueckt, setDrueckt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nach einem ausgelösten Langdruck feuert der Browser beim Loslassen noch
  // ein click - das darf den (dann schon ausgecheckten) Gast nicht sofort
  // wieder einchecken.
  const langdruckAusgeloest = useRef(false);

  function abbrechen() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDrueckt(false);
  }

  useEffect(() => abbrechen, []);

  function druckStart() {
    if (!checkedIn) return;
    langdruckAusgeloest.current = false;
    setDrueckt(true);
    timer.current = setTimeout(() => {
      langdruckAusgeloest.current = true;
      timer.current = null;
      setDrueckt(false);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(40);
      }
      onCheckOut();
    }, LANGDRUCK_MS);
  }

  function handleClick() {
    if (langdruckAusgeloest.current) {
      langdruckAusgeloest.current = false;
      return;
    }
    if (checkedIn) {
      onKurzerTipp();
    } else {
      onCheckIn();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={druckStart}
      onPointerUp={abbrechen}
      onPointerLeave={abbrechen}
      onPointerCancel={abbrechen}
      onContextMenu={(event) => event.preventDefault()}
      aria-pressed={checkedIn}
      title={checkedIn ? "Zum Auschecken gedrückt halten" : undefined}
      className={`relative min-h-14 min-w-32 shrink-0 touch-manipulation overflow-hidden rounded-md border-2 px-4 text-base font-semibold select-none [-webkit-touch-callout:none] ${
        checkedIn
          ? "border-amber-800 bg-amber-800 text-amber-50"
          : "border-stone-400 bg-transparent text-stone-700"
      }`}
    >
      {checkedIn && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-stone-900/60"
          style={{
            width: drueckt ? "100%" : "0%",
            transition: drueckt ? `width ${LANGDRUCK_MS}ms linear` : "none",
          }}
        />
      )}
      <span className="relative">{checkedIn ? "Da ✓" : "Check-in"}</span>
    </button>
  );
}

export function GastZeile({
  gast,
  onBearbeiten,
  suchBegriffe = [],
}: {
  gast: GastMitId;
  // Ohne onBearbeiten (Rolle Kasse) gibt es keinen Bearbeiten-Stift.
  onBearbeiten?: (gast: GastMitId) => void;
  suchBegriffe?: readonly string[];
}) {
  const { aktivesEvent } = useEvents();
  const { zeigeInfo, beobachte } = useMeldung();
  const eventId = aktivesEvent?.id;
  const [offenManuell, setOffenManuell] = useState(false);
  const begleitungKeys = sortiereBegleitungKeys(gast.begleitung);
  const hatBegleitung = begleitungKeys.length > 0;
  const gesamt = gesamtPersonen(gast);
  const eingecheckt = eingecheckePersonen(gast);

  // Trifft die Suche auf eine Begleitperson (nicht den Hauptgast), klappt
  // die Zeile automatisch auf - sonst wäre eine getrennt ankommende
  // Begleitperson zwar gefunden, aber ihr Check-in-Button unsichtbar.
  const begleitungTreffer =
    suchBegriffe.length > 0
      ? new Set(
          begleitungKeys.filter((key) => {
            const name = gast.begleitung[key].name;
            return name.length > 0 && namePasst(name, suchBegriffe);
          }),
        )
      : new Set<string>();
  const offen = offenManuell || begleitungTreffer.size > 0;

  function hauptgastSetzen(checkedIn: boolean) {
    if (!eventId) return;
    beobachte(
      checkInHauptgast(eventId, gast.id, checkedIn),
      `Check-in für ${gast.name} konnte nicht gespeichert werden.`,
    );
  }

  function begleitungSetzen(key: string, label: string, checkedIn: boolean) {
    if (!eventId) return;
    beobachte(
      checkInBegleitung(eventId, gast.id, key, checkedIn),
      `Check-in für ${label} konnte nicht gespeichert werden.`,
    );
  }

  const hinweisLangdruck = () =>
    zeigeInfo("Zum Auschecken den Button gedrückt halten.");

  return (
    <div>
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => hatBegleitung && setOffenManuell((offen) => !offen)}
          className="flex min-h-12 flex-1 items-center gap-2 text-left"
        >
          {hatBegleitung && (
            <span className="text-stone-400">{offen ? "▾" : "▸"}</span>
          )}
          <span className="flex-1">
            <span className="block text-stone-900">{gast.name}</span>
            {gast.notiz && (
              <span className="block text-xs text-stone-500">{gast.notiz}</span>
            )}
          </span>
          {hatBegleitung && (
            <span className="text-xs text-stone-500">
              {eingecheckt}/{gesamt}
            </span>
          )}
        </button>

        {onBearbeiten && (
          <button
            type="button"
            onClick={() => onBearbeiten(gast)}
            aria-label={`${gast.name} bearbeiten`}
            className="min-h-12 min-w-12 shrink-0 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✎
          </button>
        )}

        <CheckInButton
          checkedIn={gast.checkedIn}
          onCheckIn={() => {
            hauptgastSetzen(true);
            zeigeInfo(`${gast.name} eingecheckt`, () => hauptgastSetzen(false));
          }}
          onCheckOut={() => {
            hauptgastSetzen(false);
            zeigeInfo(`${gast.name} ausgecheckt`, () => hauptgastSetzen(true));
          }}
          onKurzerTipp={hinweisLangdruck}
        />
      </div>

      {hatBegleitung && offen && (
        <div className="space-y-2 bg-stone-100 px-4 pb-4 pl-9">
          {begleitungKeys.map((key) => {
            const begleitperson = gast.begleitung[key];
            const label = begleitperson.name || `${gast.name} +${key}`;
            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-3 rounded-md ${
                  begleitungTreffer.has(key) ? "-m-2 bg-amber-100 p-2" : ""
                }`}
              >
                <span className="text-sm text-stone-600">
                  {begleitperson.name || `+${key}`}
                </span>
                <CheckInButton
                  checkedIn={begleitperson.checkedIn}
                  onCheckIn={() => {
                    begleitungSetzen(key, label, true);
                    zeigeInfo(`${label} eingecheckt`, () =>
                      begleitungSetzen(key, label, false),
                    );
                  }}
                  onCheckOut={() => {
                    begleitungSetzen(key, label, false);
                    zeigeInfo(`${label} ausgecheckt`, () =>
                      begleitungSetzen(key, label, true),
                    );
                  }}
                  onKurzerTipp={hinweisLangdruck}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
