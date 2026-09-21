# Hinweis für Claude Code

Diese Datei wird bei jeder neuen Claude-Code-Sitzung in diesem Repo
automatisch gelesen — im Unterschied zu allem, was nur in einer früheren
Chat-Sitzung besprochen wurde (das hat eine neue Sitzung nicht im
Gedächtnis). Für die volle Projektübersicht siehe `README.md`.

**Wichtig zum Verständnis der Ordnerstruktur:** Dieses Repo wird nicht
automatisch deployt. Code in `wordpress/*/wpcode-snippet.php` läuft erst,
wenn Jörg ihn manuell in ein WPCode-Snippet auf spiritual-touch.de
einfügt; Code in `apps-script/*/Code.gs` bzw. `team-app/App Script`
erst, wenn er ihn manuell in den jeweiligen Google-Apps-Script-Editor
einfügt und dort **neu bereitstellt** (nicht nur speichert). Nach jeder
Code-Änderung hier im Repo also: Jörg bekommt die fertige Datei zum
Einfügen, nichts läuft von selbst.

## WICHTIG: Coworking-Agent / Dispatch — Amelia-Buchungen per Chat anlegen

Wenn Jörg eine Nachricht schickt, die wie eine Buchungsanfrage oder ein
Freigabe-Zuruf klingt — z. B. "Da ist eine Anfrage reingekommen für
[Dienstleistung] bei [Mitarbeiter:in] am [Datum/Zeit], Kunde [Name/Mail/
Telefon]", oder "Passt, gib Termin XY frei" / "gib frei und kopiere in
Raum 2" — **geht es NICHT darum, irgendeinen Kalender-Eintrag zu
erstellen.** Es gibt dafür ein fertiges, live getestetes Bridge-System
zwischen Chat und Amelia (WordPress-Buchungsplugin). Nutze IMMER dieses
System, **niemals** ein generisches Kalender-Werkzeug (Google Calendar
MCP o. Ä.) direkt, um selbst einen Termin anzulegen, zu verschieben oder
zu löschen — das würde Amelia komplett umgehen: keine echte
Kundenbuchung, keine Bestätigungsmail, taucht nicht im Buchungs-Dashboard
auf, keine Preisberechnung.

Vollständige Doku, inkl. Beispiel-Payloads und Stand der Live-Tests:
`wordpress/buchungs-dashboard/README.md`, Abschnitt **"Dispatch"**.
Immer dort nachlesen, bevor eine Dispatch-Nachricht beantwortet wird —
der Stand kann sich ändern. Eigenständige, mobil-taugliche Kurzanleitung
(kein Repo-Zugriff nötig, für Jörgs eigene Ablage): `DISPATCH.md`.
Kurzfassung des Ablaufs:

1. **IDs auflösen.** Jörg nennt Kategorie/Dienstleistung und
   Mitarbeiter:in in Klartext. Per
   `GET https://spiritual-touch.de/wp-json/st/v1/amelia-reference`
   (Header `X-ST-Dispatch-Secret`) in echte Amelia-IDs auflösen. Die
   Antwort enthält je Dienstleistung auch `durationOptions` — manche
   Dienstleistungen haben mehrere Dauer/Preis-Varianten (Amelias "Preise
   nach Dauer"), z. B. ist "2 Stunden" oft eine Variante *derselben*
   Dienstleistung, keine eigene. Bei Unklarheit über Dauer/Kategorie
   lieber kurz bei Jörg nachfragen als raten — siehe die Lektion mit
   Termin #116 in der README.
2. **Anfrage anlegen.**
   `POST https://spiritual-touch.de/wp-json/st/v1/booking-dispatch`
   mit `serviceId`, `providerId`, `date`, `time`, optional
   `durationSeconds` (aus Schritt 1), `customer`
   (`firstName`/`lastName`/`email`/`phone`), `internalNotes` optional,
   `status` weglassen (Standard: nur "pending" anlegen — Testphase!) oder
   explizit `"approved"` **nur**, wenn Jörg in derselben Nachricht
   ausdrücklich sofortige Freigabe sagt.
   Neue Kunden werden automatisch angelegt (seit 21.09.2026, über Amelias
   eigenen `/users/customers`-Endpunkt — live bestätigt, siehe README).
   Schlägt ein Versuch trotzdem mit `customer_create_failed` oder
   `customer_created_but_id_not_found` fehl: NICHT einfach nochmal
   versuchen — Jörg den genauen Fehler (inkl. `debug`/`amelia_response`)
   zeigen, notfalls den Kunden einmal manuell in Amelia anlegen (Kunden →
   Neuer Kunde, gleiche E-Mail) als Workaround, dann denselben
   Dispatch-Aufruf wiederholen.
3. **Freigeben** (meist eine zweite, spätere Nachricht, z. B. "passt, gib
   frei" oder "gib frei und kopiere in Raum 2").
   `POST https://spiritual-touch.de/wp-json/st/v1/booking-dispatch-confirm`
   mit `appointmentId` (aus der Antwort von Schritt 2) und optional
   `room` (`1`/`2`/`3`) fürs Kopieren in einen Raumkalender — das ist ein
   reiner Google-Calendar-Schritt (kein Amelia-Feld), läuft aber
   ebenfalls über diese eine Route, nicht über eigenes Kalender-Tooling.

**Secrets:** `X-ST-Dispatch-Secret` steht absichtlich NICHT im Repo
(siehe README, Abschnitt "Geheimnisse & Konfigurationswerte" — Namen und
Fundorte stehen dort, echte Werte nicht). Jörg teilt den aktuellen Wert
direkt im jeweiligen Chat mit. Fehlt er, danach fragen — nicht raten,
nicht umgehen, nicht durch ein anderes Werkzeug ersetzen.

**Bei jedem Fehler:** die Antwort enthält `error`/`detail`-Felder mit
gezielten Diagnosedaten (beide Routen sind darauf ausgelegt) — die
wörtlich an Jörg zurückmelden statt zu raten oder es einfach nochmal
anders zu versuchen.
