# Team-App

PIN-geschützte Web-App für das Team (`spiritual-touch.de/team-app/`,
Elementor-HTML-Widget). Backend ist ein Google-Apps-Script-Projekt
(`App Script`), erreichbar über den WPCode-Proxy `/wp-json/st/v1/cal`.

- **`App Script`** — bedient die App direkt (`doPost`): Verfügbarkeit
  eintragen / ändern / löschen. Die Einträge landen im gemeinsamen
  Google-Kalender „Verfügbarkeit".
- **`team-kalender-widget.html`** — das Widget (Login per PIN, Liste der
  eigenen Verfügbarkeiten, Formular inkl. „Ganztägig"-Checkbox).
- **`anleitung.html`** — Endnutzer-Anleitung fürs Team (Installation als
  Home-Bildschirm-App auf Android/iPhone).

## Rückbau Amelia-Anbindung (02.11.2026)

Die gesamte Anbindung an das Amelia-Booking-Tool wurde aus dem Repo
entfernt. Dazu gehörten:

- Verfügbarkeit → Hilfskalender-Sync (`App Script - Sync`)
- „Termine"-Ansicht und Termin-Ändern (Aktionen `appointments` /
  `reschedule` in `App Script`, Menüpunkt + Screens im Widget)
- Login-Bridge `wp-amelia-login-bridge.php`
- Anfragen-Verfügbarkeits-Sync und Raum-Einladungs-Sync (`apps-script/`)
- WPCode-Snippets Buchungs-Dashboard, Buchungsbestätigungs-Link und
  Google-Buchungslink (`wordpress/`)

Wiederherstellbar über die Git-Historie (Stand vor dem Rückbau-Commit).

⚠️ Die Team-App schreibt weiterhin nur in den Kalender „Verfügbarkeit";
ohne den früheren Sync wertet nichts mehr automatisch daraus etwas aus.

## Einrichtung

1. **`App Script`** im zugehörigen Apps-Script-Projekt einfügen,
   **Bereitstellen → Neue Version** (nicht nur speichern — bekannter
   Fallstrick).
2. `team-kalender-widget.html` ins Elementor-HTML-Widget einspielen.
3. Live testen: PIN-Login → Verfügbarkeit eintragen / ändern / löschen,
   „Ganztägig" prüfen.

## Sicherheit

Der `SECRET`-Wert in `App Script` (für den normalen Browser↔Apps-Script-
Verkehr) ist **kein** echtes Geheimnis — er stünde im Seitenquelltext
ohnehin offen. Echte Legitimation ist der vierstellige PIN, serverseitig
gegen das Roster-Sheet geprüft (siehe `getByPin()`).
