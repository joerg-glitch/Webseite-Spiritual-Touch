# Team-Verfügbarkeit → Amelia: Status & Plan (Stand 03.08.2026)

## Es gibt bereits ein laufendes System — kein Neubau nötig

Ein früherer Chat hat das bereits gebaut und in Betrieb genommen (Notion:
„Buchungssystem — Übergabe & Dokumentation (Juni 2026)"). Verifiziert per
direktem Zugriff auf die echten Google-Kalender (03.08.2026):

**Architektur (live):**
```
WordPress/Elementor-Widget (spiritual-touch.de/team-app/, PIN-Login)
  ↓ POST
WPCode-PHP-Proxy (/wp-json/st/v1/cal)
  ↓ POST
Google Apps Script
  ↓
Google-Kalender "Verfügbarkeit" (ein gemeinsamer Kalender für alle)
  ↓ (manuell, durch Claude-Chat-Sitzungen — kein Cron)
Busy-Blocker je Hilfskalender/Person → Amelia liest daraus
```

**Bestätigte Übersetzungs-Regel** (aus echten Kalenderdaten von
Tara/Asmita/Alea/Stephanie/Maxine rekonstruiert):
- Arbeitsfenster: **09:00–23:00**
- Kein Eintrag in "Verfügbarkeit" für einen Tag → Ganztages-Blocker
  09:00–23:00 im Hilfskalender
- Ganztägiger Eintrag mit nur Namen → kein Blocker (ganzer Tag frei)
- "bis HH:MM" → Blocker HH:MM–23:00
- "ab HH:MM" → Blocker 09:00–HH:MM
- "ab HH:MM bis HH:MM" (z. B. "Alea ab 11:30 bis 17:00 M.ende") → **zwei**
  Blocker (09:00–ab-Zeit UND bis-Zeit–23:00), Mitte bleibt frei — kommt in
  der Praxis vor (Alea, Jen); die ursprüngliche Drei-Fälle-Annahme war zu
  einfach
- **Mehrtägige Ganztages-Einträge** (z. B. "Asmita" 06.–08.08., Google-Format
  mit exklusivem Enddatum) gelten für **jeden Tag in der Spanne** — nicht
  nur den Start-Tag. (Eigener Analysefehler am 03.08. korrigiert: fälschlich
  als Lücke am 07.08. gemeldet, war aber korrekt kein Block nötig.)
- Amelia schreibt echte Buchungen direkt in denselben Hilfskalender (z. B.
  "2,5h (Asmita)" mit Kundendaten) — kein Konflikt mit der Blocker-Logik
- **Bestätigt vom Nutzer:** Team trägt positive Anwesenheit ein; die
  Amelia/Hilfskalender-Mechanik selbst liest "immer frei, außer explizit
  geblockt" — die Inversion beim Übersetzen ist genau die Brücke dazwischen

**Nutzt die Team-App:** Tara, Asmita, Amila, Sarah, Dominik, Konstantin,
Alea, Stephanie, Karen, Maxine (10 Personen).
**Sonderfälle ohne Team-App:** Jörg (eigener Kalender, Standard 9–23 Uhr
frei außer geblockt), Eva (privater Kalender regelt Verfügbarkeit direkt).

## Was archiviert ist (nicht mehr relevant)

Teil 2 "Kundenbuchung" (öffentliches Buchungsformular, Geschlechter-Filter,
Storno-Workflow etc.) ist am 28.07.2026 archiviert — Amelia Pro übernimmt
das nativ. Die fachliche Logik (Geschlechter-Filter, Angebots-Zuordnung,
Puffer-Regeln) bleibt nur als Referenz stehen, falls sie mal in Amelia
nachgebildet werden muss.

## Offene Punkte / gefundene Probleme (Stand 03.08.2026)

1. **Team-App-Live-Code war nie mit dem Backend verbunden.** Der am
   31.07. laut Notion-Doku "behobene" Login/Fetch-Fix wurde nie ins
   Elementor-HTML-Widget eingespielt — die live Seite lief noch mit
   hartcodierten Test-PINs (`1234`/`5678`) und erfundenen Browser-Testdaten,
   kein einziger `fetch()`-Aufruf an `/wp-json/st/v1/cal`. Bestätigt durch
   direkten Blick in den Live-Code am 03.08.2026.
   **→ Korrigierte Version liegt bereit:** `team-app/team-kalender-widget.html`
   in diesem Repo — echte Backend-Anbindung (Login, Eintragen, Ändern,
   Löschen) **plus neue Ganztägig-Checkbox** (blendet die Uhrzeit-Felder
   aus, sendet `allDay:true` ohne Zeiten). Muss noch von dir ins Elementor-
   Widget eingefügt und live getestet werden.
   **Offene Annahme:** Die von `list` zurückgegebenen `entries[]` haben
   vermutlich dieselben Felder wie `create`/`update` (`id`, `date`, `from`,
   `to`, `allDay`) — nicht 100% bestätigt, da der Apps-Script-Quellcode
   nicht vorliegt. Falls nach dem Einspielen Einträge falsch/leer
   angezeigt werden, brauche ich den `getByPin`/`list`-Teil des Apps
   Scripts, um die Feldnamen abzugleichen.
2. **Unsauberes Bookkeeping bei Asmita/Maxine:** einzelne Blocker haben ein
   falsches `sourceDate` in der Beschreibung (das Event selbst liegt am
   richtigen Tag, nur das Label stimmt nicht), dazu harmlose Duplikate
   (derselbe Blocker zweimal angelegt, u. a. am 06.08. bei Asmita zeitgleich
   mit einer echten Buchung). Kein akutes Live-Risiko, zeigt aber: der
   manuelle Prozess prüft nicht, was schon existiert, bevor er neu anlegt.
3. **Kernproblem:** Die Übersetzung Verfügbarkeit → Hilfskalender läuft
   manuell durch Claude-Chat-Sitzungen statt automatisiert — fehleranfällig
   (siehe Punkt 2) und erfordert jedes Mal einen neuen Chat.

(Der zuvor hier vermerkte "fehlende Blocker bei Asmita am 07.08." war ein
eigener Analysefehler — siehe Regel-Ergänzung "mehrtägige Ganztages-
Einträge" oben. Es besteht dort keine Lücke, nichts zu tun.)

## Stand 03.08.2026 (Abend): Apps Script bekommen und korrigiert

Echter Apps-Script-Code (`team-app/App Script`) geprüft. Gefundene Bugs:
- `listEntries` gab kein `allDay`-Feld zurück → Widget zeigte nie korrekt
  "Ganztägig" beim Bearbeiten
- `update`-Aktion kannte `allDay` gar nicht (weder im `doPost`-Switch noch
  in `updateEntry`) → Ändern eines Ganztägig-Eintrags wäre vermutlich kaputt
  gegangen
- Teilverfügbarkeit wurde als echter Uhrzeit-Termin angelegt statt (wie vom
  Nutzer gewünscht) als Ganztages-Event mit Zeit im Titel

Alle drei behoben. Neue Konvention: **jeder Eintrag ist ein Ganztages-Event**
(bessere Sichtbarkeit); bei Teilverfügbarkeit steht die Zeit im Titel
("Alea 11:00–14:00 Uhr"), Zuordnung/Zeiten zusätzlich strukturiert in der
Beschreibung (`member:Name;from:HH:MM;to:HH:MM`) — im selben Stil wie die
bestehende Hilfskalender-Konvention (`autoBlock:true;sourceDate:...;member:...`).
`updateEntry` macht jetzt Löschen+Neuanlegen statt `setTime()` (robuster bei
Ganztägig-Wechsel).

## Stand 03.08.2026 (spät): gefundenes Test-Skript eingearbeitet

Nutzer hatte bereits ein reiferes Sync-Skript aus einer früheren Test-
Session (Screenshots, kein Repo-Eintrag) — mit Locking, Sync-Log-Sheet,
Watchdog+E-Mail-Alarm, Tags statt Text-Parsing, allgemeinem Frei-Fenster-
Algorithmus (mehrere Verfügbarkeit-Einträge pro Tag korrekt zusammenführen).
Deutlich reifer als meine erste Version — übernommen als neue Basis für
`team-app/App Script - Sync`.

**Kompatibilitätskonflikt gefunden und gelöst:** Das alte Skript erwartete
für Teilverfügbarkeit echte Uhrzeit-Termine mit Titel = exakt der Name
(altes `createEntry`-Verhalten, vor der Ganztägig-mit-Zeit-im-Titel-
Umstellung von heute). Erweitert um Erkennung des neuen Formats (Tags) +
Fallback auf alte Freitext-Einträge. Team-App-Skript (`App Script`) läuft
jetzt ebenfalls über Tags (`member`/`from`/`to`) statt Beschreibungstext —
einheitlicher Mechanismus in beiden Skripten.

## Stand 05.08.2026: erster Produktivlauf geprüft

Vollständiger Soll/Ist-Abgleich aller 10 Hilfskalender gegen die
Verfügbarkeit-Einträge (05.–25.08.) durchgeführt. Ergebnis: Sync
funktioniert korrekt für strukturierte Team-App-Einträge und die meisten
Alt-Einträge. Drei Lücken gefunden — alle auf denselben Freitext-Parser-
Bug zurückzuführen (Alea 08.08. fehlender zweiter Blocker, Maxine 20.08.
und Stephanie 20.08. fehlender Blocker komplett, weil "bis M.ende 17:00"
bzw. "bis ... 17 Uhr" nicht erkannt wurden). Parser robuster gemacht
(sucht jetzt die nächste Uhrzeit irgendwo nach "ab"/"bis", nicht nur
direkt danach; erkennt auch "Uhr" als Einheit, nicht nur "h"). Betrifft
nur alte, handgetippte Freitext-Einträge — bei über die Team-App
angelegten Terminen (strukturierte Tags) tritt das nicht auf.

## Stand 14.08.2026: Ganztägig-Checkbox-Bug live bestätigt und behoben

Nutzer meldete: Teilverfügbarkeit (z.B. Stephanie 09:00–18:00) landet korrekt
im Google-Kalender, aber die Team-App zeigt beim Ändern fälschlich
„Ganztägig“ angehakt. Ursache: die live deployte Apps-Script-Version war
älter als Commit `e5d3d77` (05.08.) — `listEntries` bestimmte „Ganztägig“
noch über `ev.isAllDayEvent()` statt über die `from`/`to`-Tags. Da laut
Konvention seit `0b886a4` (03.08.) **jeder** Eintrag technisch ein
Ganztages-Event ist (Uhrzeit nur im Titel), lieferte das für ausnahmslos
alle Einträge `allDay: true` zurück — Code im Repo war bereits korrekt,
nur nicht neu bereitgestellt. Nutzer hat **Bereitstellen → Neue Version**
nachgeholt → Fehler bestätigt behoben.

## Empfehlung für die nächsten Schritte

1. ~~Aktualisiertes Apps Script (`team-app/App Script`) im Apps-Script-Editor
   einfügen und **Bereitstellen → Neue Version**~~ — erledigt, 14.08.2026.
2. `team-app/team-kalender-widget.html` ist schon mit dem Button-Fix
   (Ändern/Löschen) aktuell — nochmal komplett live testen: Anlegen,
   Ändern, Löschen, Ganztägig, inkl. Wechsel Ganztägig ↔ Uhrzeit beim
   Ändern.
3. **Noch offen (wartet auf Go):** Übersetzung Verfügbarkeit → Hilfskalender
   als wiederkehrende Routine einrichten, inkl. Invertierung bei Ganztägig
   (bestehender Blocker muss raus, wenn ganztägig eingetragen wird) —
   direkter Google-Calendar-Zugriff ist in dieser Session vorhanden.
4. Ursprünglich geplanter PHP/SQLite-Neubau: **verworfen** — nicht mehr
   nötig, die Team-App existiert bereits und funktioniert im Kern.

## Personalisierung

Design-System der Team-App ist bereits im Notion-Dokument definiert
(CSS-Variablen `--st-sand`, `--st-clay` etc., warme Erdtöne) — passt zum
"Spiritual Touch"-Charakter, keine Änderung nötig.
