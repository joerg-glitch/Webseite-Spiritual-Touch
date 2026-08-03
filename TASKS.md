# Tasks: Team-Verfügbarkeit → Amelia (Stand 03.08.2026)

## Phase 0 — Bestandsaufnahme (erledigt, 03.08.2026)
- Notion-Doku gelesen, echte Kalenderdaten aller Hilfskalender gegen die
  Doku geprüft
- Übersetzungsregel empirisch bestätigt (09:00–23:00-Fenster, inkl.
  Zwei-Blocker-Fall bei "ab...bis...")
- Lücke bei Asmita (07.08.) und unsauberes Labeling gefunden

**Test:** abgeschlossen — dieser Abgleich war der Test.

## Phase 1 — Login-Live-Test bestätigen
- Du testest PIN-Login, Eintragen/Ändern/Löschen, Ganztägig-Checkbox auf
  spiritual-touch.de/team-app/

**Test:** Du bestätigst "Login funktioniert" oder beschreibst den Fehler.

## Phase 2 — Lücke schließen + Bestand bereinigen
- Fehlenden Blocker für Asmita (07.08., 09:00–23:00) anlegen
- Mislabelte `sourceDate`-Beschreibungen korrigieren, echte Duplikate
  löschen (nur exakte Doppel, keine echten Buchungen anfassen)

**Test:** Erneuter Abgleich aller 10 Hilfskalender gegen die
Verfügbarkeit-Einträge für die nächsten 14 Tage — keine Lücke, keine
Duplikate mehr.

## Phase 3 — Übersetzung automatisieren (Routine statt manuellem Chat)
- Einmaliges Vorgehen, das für alle 10 Personen die Verfügbarkeit-Einträge
  liest und Hilfskalender-Blocker idempotent nachführt (prüft `sourceDate`
  in der Beschreibung, bevor es neu anlegt)
- Als wiederkehrende Routine einrichten (täglich)

**Test:** Routine einmal manuell auslösen, prüfen dass keine Duplikate
entstehen und neue Verfügbarkeits-Einträge korrekt übersetzt werden.

## Phase 4 — Laufender Betrieb beobachten
- 1–2 Wochen laufen lassen, stichprobenartig prüfen ob Amelia-Buchbarkeit
  mit echter Verfügbarkeit übereinstimmt

**Test:** Stichprobe über 5–10 Tage, keine Fehlbuchungen.

## Phase 5 — Entscheidung
- Reicht die Routine dauerhaft, oder soll die Übersetzung doch fest in
  Apps Script (stündlich, wie ursprünglich geplant) verlagert werden?

**Test:** Kurzer Soll/Ist-Vergleich nach 2–4 Wochen.
