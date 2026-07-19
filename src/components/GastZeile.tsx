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
      className={`min-h-12 min-w-[6.5rem] shrink-0 rounded-md px-4 text-sm font-medium ${
        checkedIn
          ? "bg-emerald-900 text-emerald-100"
          : "bg-zinc-800 text-zinc-200"
      }`}
    >
      {checkedIn ? "Da ✓" : "Check-in"}
    </button>
  );
}

export function GastZeile({ gast }: { gast: GastMitId }) {
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
            <span className="text-zinc-500">{offen ? "▾" : "▸"}</span>
          )}
          <span className="flex-1">
            <span className="block text-zinc-50">{gast.name}</span>
            {gast.notiz && (
              <span className="block text-xs text-zinc-500">
                {gast.notiz}
              </span>
            )}
          </span>
          {hatBegleitung && (
            <span className="text-xs text-zinc-500">
              {eingecheckt}/{gesamt}
            </span>
          )}
        </button>

        <CheckInButton
          checkedIn={gast.checkedIn}
          onToggle={() => {
            checkInHauptgast(gast.id, !gast.checkedIn).catch(console.error);
          }}
        />
      </div>

      {hatBegleitung && offen && (
        <div className="space-y-2 bg-zinc-900/60 px-4 pb-4 pl-9">
          {begleitungKeys.map((key) => {
            const begleitperson = gast.begleitung[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-zinc-300">
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
