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
weiterhin rein über den Google Kalender (Raum-1-Kopie zwischen
Raumkalendern verschieben, siehe `apps-script/raum-einladung-sync/
README.md`), weil sich dabei am eigentlichen Amelia-Termin nichts ändert.

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
  Vorlagenzeile `Termin-ID: %appointment_id%`) lassen sich in der
  Termine-Ansicht bewusst nicht ändern — dafür fehlt der Schlüssel, den
  `/booking-reschedule` braucht.
