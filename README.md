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

## Projektstruktur (kurz)

- `src/app/(protected)/` - Hauptansicht, Formular, Import (nur eingeloggt
  erreichbar)
- `src/app/login/` - Login-Seite
- `src/lib/gaeste.ts` - Datenmodell und Firestore-Lese-/Schreibfunktionen
- `src/lib/pdfImport.ts` / `src/lib/csvImport.ts` / `src/lib/gaesteImport.ts` -
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
      rückgängig machen (Tap auf „Da ✓")
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

- Der PDF-Import erkennt Kopf-/Fußzeilen heuristisch (Wiederholung über
  mehrere Seiten). Ist die Seitenzahl direkt in den Fußzeilentext eingebettet
  (z. B. „…Fax mobil SEITE 1"), wird die Zeile eventuell nicht automatisch
  abgewählt - vor dem Import einmal durch die Vorschau scrollen.
- Beim CSV-Import wird ohne erkennbare Spaltenüberschrift („Nachname"/
  „Vorname" oder „Name") die erste Spalte als Name angenommen - auch hier
  lohnt ein Blick in die Vorschau vor dem Bestätigen.
