"use client";

import { useState } from "react";
import {
  checkInBegleitung,
  checkInHauptgast,
  eingecheckePersonen,
  gesamtPersonen,
  sortiereBegleitungKeys,
  type GastMitId,
} from "@/lib/gaeste";

// Der Status (da / nicht da) muss auch ohne genaues Lesen erkennbar sein:
// nicht eingecheckt ist eine schlichte Outline (leere Form), eingecheckt ist
// vollflächig gefüllt plus Häkchen - Form und Kontrast tragen die Aussage,
// die Farbe ist nur eine zusätzliche Verstärkung, keine Voraussetzung.
function CheckInButton({
  checkedIn,
  onToggle,
}: {
  checkedIn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checkedIn}
      className={`min-h-14 min-w-32 shrink-0 rounded-md border-2 px-4 text-base font-semibold ${
        checkedIn
          ? "border-amber-800 bg-amber-800 text-amber-50"
          : "border-stone-400 bg-transparent text-stone-700"
      }`}
    >
      {checkedIn ? "Da ✓" : "Check-in"}
    </button>
  );
}

export function GastZeile({
  gast,
  onBearbeiten,
}: {
  gast: GastMitId;
  onBearbeiten: (gast: GastMitId) => void;
}) {
  const [offen, setOffen] = useState(false);
  const begleitungKeys = sortiereBegleitungKeys(gast.begleitung);
  const hatBegleitung = begleitungKeys.length > 0;
  const gesamt = gesamtPersonen(gast);
  const eingecheckt = eingecheckePersonen(gast);

  return (
    <div>
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => hatBegleitung && setOffen((offen) => !offen)}
          className="flex min-h-12 flex-1 items-center gap-2 text-left"
        >
          {hatBegleitung && (
            <span className="text-stone-400">{offen ? "▾" : "▸"}</span>
          )}
          <span className="flex-1">
            <span className="block text-stone-900">{gast.name}</span>
            {gast.notiz && (
              <span className="block text-xs text-stone-500">
                {gast.notiz}
              </span>
            )}
          </span>
          {hatBegleitung && (
            <span className="text-xs text-stone-500">
              {eingecheckt}/{gesamt}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onBearbeiten(gast)}
          aria-label={`${gast.name} bearbeiten`}
          className="min-h-12 min-w-12 shrink-0 rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          ✎
        </button>

        <CheckInButton
          checkedIn={gast.checkedIn}
          onToggle={() => {
            checkInHauptgast(gast.id, !gast.checkedIn).catch(console.error);
          }}
        />
      </div>

      {hatBegleitung && offen && (
        <div className="space-y-2 bg-stone-100 px-4 pb-4 pl-9">
          {begleitungKeys.map((key) => {
            const begleitperson = gast.begleitung[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-stone-600">
                  {begleitperson.name || `+${key}`}
                </span>
                <CheckInButton
                  checkedIn={begleitperson.checkedIn}
                  onToggle={() => {
                    checkInBegleitung(
                      gast.id,
                      key,
                      !begleitperson.checkedIn,
                    ).catch(console.error);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
