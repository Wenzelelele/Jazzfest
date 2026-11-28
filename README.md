# Jazzfest Gästeliste

Offline-fähige Gästelisten- und Check-in-App für den Einlass einer jährlich
wiederkehrenden Jazz-Veranstaltung. Läuft auf 2–3 Smartphones gleichzeitig,
funktioniert vollständig ohne Internetverbindung und synchronisiert danach
automatisch.

Stack: Next.js (App Router, TypeScript), Firebase (Firestore + Auth),
Tailwind CSS, Deployment auf Vercel.

## Voraussetzungen

- Node.js 20 oder neuer, npm
- Ein Firebase-Projekt (der kostenlose Spark-Plan reicht)
- Kein globales Firebase-CLI-Install nötig, `npx firebase-tools` reicht

## 1. Firebase-Projekt einrichten

1. Projekt anlegen unter [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication** aktivieren: Build → Authentication → „Los geht's" →
   Sign-in-Methode **E-Mail/Passwort** aktivieren
3. Nutzer manuell anlegen: Authentication → Nutzer → „Nutzer hinzufügen"
   (E-Mail + Passwort). Es gibt bewusst keine Registrierung in der App -
   Accounts werden ausschließlich hier angelegt
4. **Firestore Database** anlegen: Build → Firestore Database →
   „Datenbank erstellen" (Modus/Region spielen keine Rolle, die eigenen
   Regeln aus Schritt 3 unten überschreiben die Vorauswahl ohnehin)
5. Web-App registrieren: Projekteinstellungen (Zahnrad) → Allgemein →
   „Meine Apps" → App hinzufügen → Web (`</>`) → Spitznamen vergeben,
   **Firebase Hosting nicht** ankreuzen (Deployment läuft über Vercel) →
   Registrieren
6. Die angezeigten Config-Werte (`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`) werden im nächsten
   Schritt gebraucht

## 2. Lokale Entwicklung

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` mit den sechs Werten aus Schritt 1.6 befüllen, dann:

```bash
npm run dev
```

App läuft unter <http://localhost:3000>.

## 3. Firestore-Regeln deployen

**Ohne diesen Schritt lehnt Firestore jeden Zugriff ab**, auch von
eingeloggten Nutzern - eine neue Firestore-Datenbank startet im Sperr-Modus,
bis eigene Regeln veröffentlicht sind.

**Option A - Firebase Console (kein CLI-Login nötig):**
Firestore Database → Tab „Regeln" → Inhalt von [firestore.rules](firestore.rules)
einfügen → Veröffentlichen.

**Option B - Firebase CLI:**

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

`.firebaserc` zeigt aktuell auf das Projekt `jazzfestgaesteliste` - bei einem
anderen Projekt vorher die `default`-Projekt-ID in `.firebaserc` anpassen.

Bei jeder Änderung an `firestore.rules` muss einer der beiden Wege wiederholt
werden.

## 4. Deployment auf Vercel

1. Repository auf GitHub (o. ä.) pushen
2. Auf [vercel.com](https://vercel.com) → „Add New" → „Project" →
   Repository importieren
3. Unter „Environment Variables" alle sechs `NEXT_PUBLIC_FIREBASE_*`-Werte
   aus `.env.local` eintragen (für Production, Preview und Development)
4. Deployen

Vercel baut und deployed automatisch bei jedem Push auf den verbundenen
Branch. Die Firestore-Regeln sind davon unabhängig - Schritt 3 oben muss
separat gemacht werden (einmalig, bzw. erneut bei Änderungen an den Regeln).

## Veranstalter, Rollen und Zugänge

Die App trennt mehrere **Veranstalter** voneinander: Jeder hat eigene
Events, Gästelisten, Admins und Kassen-Geräte und sieht nichts von den
anderen. Die Firestore-Regeln setzen das hart durch.

| Wer | Darf |
|---|---|
| **Ohne Login** (Link `/gaesteliste/{kurzname}` des Veranstalters) | Event wählen, Gäste anfragen (Ansprechpartner + Namen, auch als eingefügte WhatsApp-Nachricht), Status der eigenen Anfragen sehen |
| **Kasse** (Gerät mit Kassen-Code) | Listen sehen, suchen, einchecken, Abendkasse zählen, Event wählen |
| **Admin** eines Veranstalters | Alles in diesem Veranstalter - Anfragen freigeben, Gäste, Events, Import, Export, Statistik, Kassen-Codes, weitere Admins einladen, Veranstalter löschen |
| **Super-Admin** (`admins/{uid}` in der Firebase Console) | Veranstalter anlegen, in jeden Veranstalter wechseln, überall alles |

**Einrichtung (einmalig, Firebase Console → Authentication):**
- Anmeldemethoden: **E-Mail/Passwort** und **Anonym** aktivieren
  (anonym = Kassen-Geräte mit Code).
- Einstellungen → Nutzeraktionen: **Registrierung erlauben** (sonst können
  eingeladene Admins kein Konto anlegen).

**Ablauf:**
1. Super-Admin: Menü → **Veranstalter** → neuen Veranstalter mit Kurzname
   anlegen (der Kurzname steht im Anfrage-Link) → **Admin einladen** →
   Link an den Admin schicken.
2. Admin öffnet den Link, legt Benutzername + Passwort fest.
3. Admin: Menü → **Kassen & Zugänge** → **Kassen-Code** anlegen. Am
   Einlass-Gerät: App öffnen → „Kassen-Code“ → Code eingeben. Das Gerät
   bleibt angemeldet (auch offline). Geräte lassen sich dort einzeln
   entfernen; einen Code löschen meldet alle seine Geräte ab.
4. Den **Anfrage-Link** (ebenfalls unter Kassen & Zugänge) an Bands & Co.
   schicken.
5. **Löschen**: Kassen & Zugänge → „Veranstalter löschen“ entfernt alle
   Events, Gäste, Codes und Zugänge. Die Login-Konten der Admins bleiben in
   Firebase Auth bestehen, haben aber keinen Zugriff mehr (bei Bedarf in der
   Console löschen).

Benutzernamen ohne E-Mail: Die App hängt intern `@jazzfest.invalid` an
(siehe `src/lib/benutzername.ts`); angezeigt wird nur der Name. Accounts
mit echter E-Mail funktionieren ebenfalls.

Alte Events ohne Veranstalter (aus der Zeit davor) zeigt die
Veranstalter-Seite des Super-Admins zum Zuordnen an. Alte Accounts ohne
Zugang sehen „Kein Zugang“ und können dort einen Kassen-Code oder eine
Einladung einlösen.

Anfragen: Jede Anfrage braucht einen **Ansprechpartner** (über wen kommen
die Gäste?). Angefragte Gäste stehen erst nach der Freigabe auf der
Einlassliste. Ohne Login ist die Gästeliste nicht lesbar; das Gerät sieht
nur den Status der Anfragen, die es selbst gesendet hat (per Dokument-ID).
Menü → **Gäste nach Ansprechpartner** zeigt, wie viele Personen über wen
kommen.

## Events und Ablauf am Veranstaltungstag

Gäste, Mitglieder und Check-ins liegen pro Event unter
`events/{eventId}/gaeste`. Ein Mitglied kann so bei mehreren Events getrennt
einchecken.

1. Menü (☰) → **Events verwalten** → Event anlegen (Name + Datum)
2. Mitgliederliste importieren (Menü → Mitglieder importieren) - für weitere
   Events reicht in der Event-Verwaltung **„JIM Mitglieder übernehmen“** aus
   einem anderen Event (Check-in startet neu)
3. Gäste per **+**, per Suche („… als Gast hinzufügen“) oder per Text-Import
   anlegen
4. **Jedes Einlass-Gerät vorher einmal online öffnen und das Event
   auswählen** - nur so liegt die Liste dieses Events offline vor. Die
   Event-Auswahl gilt pro Gerät; standardmäßig ist das Event von heute
   (sonst das nächste) aktiv
5. Nach dem Event: Event-Verwaltung → **Export CSV** (eine Zeile pro Person,
   mit Uhrzeit und Account), danach ggf. Event löschen

Bedienung am Einlass:
- **Check-in**: ein Tap. **Auschecken**: Button gedrückt halten. Nach jeder
  Aktion erscheint unten eine Leiste mit **Rückgängig**
- Suche ignoriert Umlaute/Akzente und Wortreihenfolge („max mueller“ findet
  „Müller, Max“) und zeigt Treffer im jeweils anderen Tab an
- Tab **Abendkasse**: Zähler für Personen ohne Listeneintrag (mehrere Geräte
  gleichzeitig und offline möglich, per `increment()`)
- Kopfzeile zeigt „im Saal“ = alle Eingecheckten + Abendkasse; Menü →
  **Statistik** zeigt Ankünfte pro 15 Minuten und wer wie viele eingecheckt hat
- Der Bildschirm bleibt bei geöffneter Liste wach (Wake Lock, wo unterstützt)
- Schreibfehler (z. B. abgelaufener Login) werden als rote Leiste angezeigt

Daten aus der Zeit vor Events (alte Collection `gaeste`) bietet die
Event-Verwaltung einmalig zur Übernahme in ein Event an.

## Projektstruktur (kurz)

- `src/app/(protected)/` - Hauptansicht, Formular, Import (nur eingeloggt
  erreichbar)
- `src/app/login/` - Login-Seite
- `src/app/gaesteliste/[veranstalter]/` + `src/components/AnfrageSeite.tsx` -
  öffentliche Anfrage-Seite (ohne Login)
- `src/app/(protected)/ansprechpartner/` - Gäste gruppiert nach Ansprechpartner
- `src/app/(protected)/events/`, `.../statistik/` - Event-Verwaltung, Statistik
- `src/lib/events.ts` - Events, Abendkasse, Mitglieder-Übernahme, Migration
- `src/lib/gaeste.ts` - Datenmodell und Firestore-Lese-/Schreibfunktionen
- `src/lib/suche.ts` / `src/lib/export.ts` - Such-Normalisierung, CSV-Export
- `src/contexts/` - Auth + Rolle, aktives Event (pro Gerät), Meldungsleiste
- `src/lib/veranstalter.ts`, `.../veranstalter/`, `.../zugaenge/`,
  `src/components/Beitreten.tsx` - Veranstalter, Zugänge, Kassen-Codes,
  Einladungen; `.../anfragen/` - Anfragen & Freigabe
- `src/lib/pdfImport.ts` + `src/lib/pdfNamen.ts` / `src/lib/csvImport.ts` / `src/lib/gaesteImport.ts` -
  Mitgliederlisten-Import (Parsing getrennt nach Format, Vorschau/Dubletten/
  Batch-Write gemeinsam)
- `firestore.rules` - Sicherheitsregeln (nur authentifizierte Nutzer dürfen
  lesen/schreiben)
- `public/sw.js` - handgeschriebener Service Worker für den Offline-Start
  (kein next-pwa, Begründung im Kommentar am Dateianfang)

## Testdurchlauf vor dem Einsatz

Vor dem echten Einlassbetrieb einmal manuell durchspielen:

### Grundfunktionen

- [ ] Login mit einem in der Firebase Console angelegten Account, Logout,
      erneuter Login
- [ ] Gast mit 2 Begleitpersonen anlegen, eine davon mit eigenem Namen
- [ ] Suche nach dem Hauptgast-Namen **und** nach dem Namen einer
      Begleitperson - beide müssen die Zeile finden (und bei Begleitung
      automatisch aufklappen)
- [ ] Check-in Hauptgast, Check-in einzelne Begleitperson, beide wieder
      auschecken (Button „Da ✓" gedrückt halten) und einmal per
      „Rückgängig" in der Leiste
- [ ] Filter „Alle" / „Noch nicht da" / „Schon da" schalten korrekt um
- [ ] Gast bearbeiten (Name ändern, Begleitpersonen-Anzahl ändern), löschen
      mit Bestätigung
- [ ] PDF- und CSV-Import: Vorschau prüfen, Dubletten werden markiert,
      dieselbe Datei zweimal importieren erzeugt keine doppelten Gäste

### PWA / Offline

- [ ] App einmal mit Internetverbindung öffnen und einloggen (Pflichtschritt:
      der Service Worker cacht die App erst dabei - „Zum Homescreen
      hinzufügen" braucht diesen ersten Online-Aufruf)
- [ ] „Zum Homescreen hinzufügen" auf dem tatsächlichen Einlass-Smartphone
      ausprobieren
- [ ] Flugmodus aktivieren, App komplett schließen, aus dem Homescreen-Icon
      neu öffnen - sie muss starten und die zuletzt geladene Gästeliste
      zeigen
- [ ] Im Flugmodus einen Check-in durchführen - Häkchen erscheint sofort
      (kein Warten, kein Hängenbleiben), Kopfzeile zeigt „Offline"
- [ ] Flugmodus wieder deaktivieren - Kopfzeile wechselt kurz auf
      „Synchronisiert…", dann „Aktuell"

### Der wichtigste Test: paralleler Offline-Check-in auf zwei Geräten

Das ist der Kern der gesamten Datenmodell-Architektur (`begleitung` als Map
statt Array, siehe `src/lib/gaeste.ts`) und sollte vor dem Event einmal echt
durchgespielt werden, nicht nur angenommen:

1. Einen Gast mit mindestens 2 Begleitpersonen anlegen
2. Zwei Smartphones (oder zwei Browser), beide vorher schon einmal online
   eingeloggt und mit der Liste synchronisiert
3. **Beide Geräte in den Flugmodus versetzen**
4. Auf Gerät A: bei diesem Gast Begleitperson 1 einchecken
5. Auf Gerät B: beim selben Gast Begleitperson 2 einchecken (bewusst eine
   andere Person als auf Gerät A)
6. Beide Geräte wieder mit dem Internet verbinden, kurz warten bis beide
   „Aktuell" zeigen
7. Auf **beiden** Geräten prüfen: Begleitperson 1 **und** Begleitperson 2
   sind als eingecheckt markiert

Fehlt nach Schritt 7 eine der beiden Änderungen, ist etwas am Datenmodell
kaputt - dann nicht live gehen, sondern prüfen, dass `checkInBegleitung` in
`src/lib/gaeste.ts` weiterhin gezielte Feld-Updates auf einzelne Map-Keys
schreibt und niemals das gesamte `begleitung`-Objekt überschreibt.

## Bekannte Einschränkungen

- Der PDF-Import erkennt Tabellenspalten an ihren x-Positionen und übernimmt
  nur die Namensspalten ganz links (Buchstaben, keine Ziffern/@) als
  „Nachname, Vorname“ - Adresse, Telefon und E-Mail werden nicht
  importiert. Zeilen, die nicht wie ein Name aussehen („Stand …“,
  Kopf-/Fußzeilen), werden abgewählt. Ohne erkennbare Tabelle werden ganze
  Zeilen ohne Wörter mit Ziffern/@ übernommen - vor dem Import einmal durch
  die Vorschau scrollen.
- Beim CSV-Import wird ohne erkennbare Spaltenüberschrift („Nachname"/
  „Vorname" oder „Name") die erste Spalte als Name angenommen - auch hier
  lohnt ein Blick in die Vorschau vor dem Bestätigen.
