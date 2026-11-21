import type { Timestamp } from "firebase/firestore";
import type { JazzEventMitId } from "@/lib/events";
import { sortiereBegleitungKeys, type GastMitId } from "@/lib/gaeste";

// CSV-Export eines Events: eine Zeile pro Person (Hauptgast und jede
// Begleitperson einzeln), damit sich in Excel direkt filtern/zählen lässt.
// Semikolon als Trenner + UTF-8-BOM: so öffnet deutsches Excel die Datei
// ohne Import-Assistent korrekt, inklusive Umlauten.

function zelle(wert: string | number): string {
  const text = String(wert);
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function uhrzeit(zeitpunkt: Timestamp | null | undefined): string {
  if (!zeitpunkt || typeof zeitpunkt.toDate !== "function") return "";
  return zeitpunkt.toDate().toLocaleString("de-DE");
}

export function baueCsv(event: JazzEventMitId, gaeste: readonly GastMitId[]): string {
  const kopf = [
    "Liste",
    "Name",
    "Rolle",
    "Gehört zu",
    "Notiz",
    "Eingecheckt",
    "Uhrzeit",
    "Eingecheckt von",
  ];
  const zeilen: (string | number)[][] = [kopf];

  for (const gast of gaeste) {
    const liste = gast.quelle === "mitglied" ? "JIM Mitglied" : "Gästeliste";
    zeilen.push([
      liste,
      gast.name,
      "Hauptgast",
      "",
      gast.notiz,
      gast.checkedIn ? "ja" : "nein",
      uhrzeit(gast.checkedInAt),
      gast.checkedInBy ?? "",
    ]);
    for (const key of sortiereBegleitungKeys(gast.begleitung)) {
      const person = gast.begleitung[key];
      zeilen.push([
        liste,
        person.name || `+${key}`,
        "Begleitung",
        gast.name,
        "",
        person.checkedIn ? "ja" : "nein",
        uhrzeit(person.checkedInAt),
        person.checkedInBy ?? "",
      ]);
    }
  }

  const abendkasse = event.abendkasse ?? 0;
  if (abendkasse > 0) {
    zeilen.push(["Abendkasse", `${abendkasse} Personen`, "", "", "", "ja", "", ""]);
  }

  return "﻿" + zeilen.map((zeile) => zeile.map(zelle).join(";")).join("\r\n");
}

export function dateinameFuer(event: JazzEventMitId): string {
  const name = event.name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `jazzfest-${event.datum}-${name || "event"}.csv`;
}

export function ladeCsvHerunter(event: JazzEventMitId, gaeste: readonly GastMitId[]) {
  const blob = new Blob([baueCsv(event, gaeste)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = dateinameFuer(event);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
