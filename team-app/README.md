# Team-App

PIN-geschützte Web-App für das Team (`spiritual-touch.de/team-app/`,
Elementor-HTML-Widget), Backend zwei getrennte Google-Apps-Script-Projekte:

- **`App Script`** — bedient die App direkt (`doPost`): Verfügbarkeit
  eintragen/ändern/löschen, eigene Amelia-Termine anzeigen und (seit
  27.08.2026) ändern.
- **`App Script - Sync`** — läuft unabhängig per stündlichem Trigger,
  übersetzt die "Verfügbarkeit"-Einträge in Blocker in den persönlichen
  Hilfskalendern, auf die Amelia für die Buchbarkeit zugreift. Wird von
  dieser README nicht behandelt, siehe Kommentare in der Datei selbst.

`anleitung.html` ist die Endnutzer-Anleitung fürs Team (Installation als
Home-Bildschirm-App auf Android/iPhone) — unverändert in diesem Update,
nicht Teil der folgenden technischen Doku.

## Neu (27.08.2026): Eigene Termine direkt ändern

**Hintergrund:** Amelia schreibt bestätigte Buchungen in den persönlichen
Hilfskalender jedes Mitglieds — auf den das Team keinen Zugriff hat. Bisher
gab es dafür zwei Ansätze, siehe "Verworfen" unten für den ersten. Jetzt:
Der Menüpunkt "Termine" zeigt die eigenen Buchungen im selben Kartenstil
wie Jörgs Buchungs-Dashboard (`wordpress/buchungs-dashboard/`) — Datum,
Uhrzeit, Dienstleistung, Kundenname. Ein Tipp auf "Ändern" öffnet ein
Formular für Datum/Von/Bis; Speichern schreibt die neue Zeit **direkt in
Amelia** — nicht in den Kalender-Termin selbst (der wird von Amelia
sowieso automatisch neu geschrieben, sobald die Änderung durch ist).

**Technisch:** `App Script` ruft dafür serverseitig dieselbe WordPress-
Route auf, die auch die tägliche Rückrichtung aus
`apps-script/raum-einladung-sync` nutzt: `POST /wp-json/st/v1/
booking-reschedule` (siehe `wordpress/buchungs-dashboard/
wpcode-snippet.php`), abgesichert per gemeinsamem Geheimnis
(`WP_RESCHEDULE_SECRET` im Apps Script, `ST_RESCHEDULE_SECRET` in der
WordPress-Datei — müssen exakt übereinstimmen). Vor dem Zurückschreiben
prüft `rescheduleAppointment()` in `App Script`, dass die übergebene
Amelia-Termin-ID wirklich gerade im **eigenen** Hilfskalender der
anfragenden Person auftaucht — verhindert, dass ein manipulierter Request
fremde Termine ändern könnte.

Raumwechsel (Raum 1/2/3) sind **nicht** Teil dieser Funktion — die laufen
rein über den Google Kalender: Jörg gibt jedes Hilfskalender direkt für
das jeweilige Mitglied frei (siehe `apps-script/raum-einladung-sync/
README.md`, Abschnitt "Hilfskalender freigeben"), die Person legt den
Termin bei Bedarf selbst in einen Raumkalender. Ein separates, einmal
täglich laufendes Skript (`apps-script/raum-einladung-sync`) findet den
Termin über die Termin-ID, egal in welchem Kalender er gerade liegt, und
meldet nur eine geänderte Zeit/Dauer zurück — Raumwechsel selbst ändern
nichts am Amelia-Termin und werden deshalb nicht gemeldet.

### Nachbesserung (27.08.2026, nach dem ersten Live-Test)

Zwei Dinge beim ersten Test auf dem echten Gerät aufgefallen:

1. **Verfügbarkeit-Sync-Blocker erschienen fälschlich als Termine.** Der
   ursprüngliche Filter in `listAppointments()` prüfte nur den Tag
   (`autoBlock=true`) — ältere Blocker aus `App Script - Sync`, die noch
   vor dessen Umstellung auf Tags angelegt wurden, tragen den Tag nicht und
   rutschten durch. `isAvailabilityBlock_()` erkennt jetzt zusätzlich den
   Titel ("Blockiert (Verfügbarkeit-Sync)") und die alte Text-Markierung —
   dieselbe Erkennungslogik wie im Verfügbarkeit-Sync selbst
   (`team-app/App Script - Sync`).
2. **Termine ohne Termin-ID zeigten "bitte Jörg Bescheid geben".** Jörgs
   Rückmeldung: "muss hier noch nicht bitte Jörg Bescheid geben, sondern
   die eigene Änderungsmöglichkeit gegeben sein." Für sehr alte Buchungen
   von vor der Amelia-Vorlagenänderung (`Termin-ID: %appointment_id%`
   fehlt in der Beschreibung) läuft das Ändern jetzt über einen Fallback:
   Statt der Termin-ID schickt die Team-App Mitarbeiter-ID
   (`PROVIDER_IDS` in `App Script`) + bisherige Start-/Endzeit — WordPress
   löst die Termin-ID daraus selbst per DB-Abgleich auf (eindeutig, da
   ein:e Mitarbeiter:in nicht zwei Termine mit exakt derselben Zeit haben
   kann). ⚠️ **Ausnahme: Konstantin.** Seine Amelia-Mitarbeiter-ID ist laut
   `wordpress/buchungs-dashboard/README.md` ungeklärt (er "taucht in der
   Amelia-Mitarbeiterliste nicht auf") — bei ihm funktioniert der Fallback
   erst, wenn das geklärt und in `PROVIDER_IDS` ergänzt ist. Betrifft nur
   seine Alt-Termine ohne Termin-ID; neue Termine mit Termin-ID sind davon
   nicht betroffen.

### Verworfen: eingebettetes Amelia-Mitarbeiter-Panel (16.08.2026)

Eine frühere Session hat stattdessen einen PIN-Auto-Login in eine
eingebettete Ansicht von Amelias eigenem Mitarbeiter-Panel gebaut
(`wp-amelia-login-bridge.php`, per iframe) — zum Zeitpunkt sinnvoll, weil
Amelias interne Ajax-API als "zu unsicher ohne Live-Zugriff nachzubauen"
eingeschätzt wurde. Diese Einschätzung ist inzwischen überholt: Das
Buchungs-Dashboard nutzt exakt diese interne API seit dem 23.08.2026 live
und erfolgreich (`st_amelia_ajax_call_()`), `/booking-reschedule` baut
direkt darauf auf. Der iframe-Ansatz wäre außerdem für das Team mit mehr
Reibung verbunden gewesen (eigene WordPress-Benutzerkonten pro
Mitarbeiter:in, Amelias eigene, nicht auf die Team-App abgestimmte
Oberfläche) — Jörgs ausdrücklicher Wunsch (27.08.2026): "Alles, was wir
direkt lösen können." `wp-amelia-login-bridge.php` ist deshalb **nicht**
Teil dieses Branches (Rest liegt auf `claude/amelia-appointments-team-app-
m43p57`, git-Historie zur Nachvollziehbarkeit). Die Aktion `identify` in
`App Script` (nur für die Login-Bridge gedacht) wurde aus demselben Grund
entfernt.

## Einrichtung

1. **`App Script`** im zugehörigen Apps-Script-Projekt einfügen,
   **Bereitstellen → Neue Version** (nicht nur speichern — bekannter
   Fallstrick, siehe Git-Historie).
2. `WP_RESCHEDULE_SECRET` oben in der Datei auf denselben Wert setzen wie
   `ST_RESCHEDULE_SECRET` in `wordpress/buchungs-dashboard/
   wpcode-snippet.php` (dort auch `ST_RESCHEDULE_ADMIN_USER_ID` setzen,
   falls noch nicht geschehen — siehe README dort).
3. `team-kalender-widget.html` ins Elementor-HTML-Widget einspielen.
4. Live testen: PIN-Login → "Termine" → eigene Buchungen erscheinen mit
   Kundenname → "Ändern" → Zeit anpassen → Speichern → nach kurzer Pause
   erscheint die neue Zeit in der Liste. Danach in Amelia (wp-admin) und im
   Hilfskalender gegenprüfen, dass die Änderung wirklich angekommen ist.

## Sicherheit

- Der `SECRET`-Wert in `App Script` (für den normalen Browser↔Apps-Script-
  Verkehr) ist **kein** echtes Geheimnis — er stünde im Seitenquelltext
  ohnehin offen. Echte Legitimation ist der vierstellige PIN, serverseitig
  gegen das Roster-Sheet geprüft (siehe `getByPin()`).
- `WP_RESCHEDULE_SECRET` dagegen ist ein echtes Server-zu-Server-Geheimnis
  (Apps Script → WordPress) und darf **nirgends im Browser sichtbar
  werden** — es wird ausschließlich serverseitig in `rescheduleAppointment()`
  verwendet, nie an den Client zurückgegeben.
- Termine ohne erkannte Amelia-Termin-ID (sehr alte Buchungen von vor der
  Vorlagenzeile `Termin-ID: %appointment_id%`) lassen sich seit der
  Nachbesserung oben trotzdem ändern — über den Fallback
  providerId+bisherige Zeit, mit derselben Eigentums-Prüfung wie beim
  Termin-ID-Weg (muss exakt im eigenen Hilfskalender auftauchen).
