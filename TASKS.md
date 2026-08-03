# Tasks: Team-Verfügbarkeit → Amelia (Stand 03.08.2026)

## Phase 0 — Bestandsaufnahme (erledigt, 03.08.2026)
- Notion-Doku gelesen, echte Kalenderdaten aller Hilfskalender gegen die
  Doku geprüft
- Übersetzungsregel empirisch bestätigt (09:00–23:00-Fenster, inkl.
  Zwei-Blocker-Fall bei "ab...bis...")
- Lücke bei Asmita (07.08.) und unsauberes Labeling gefunden

**Test:** abgeschlossen — dieser Abgleich war der Test.

## Phase 1 — Team-App live aktualisieren (erledigt: Code bereitgestellt, 03.08.2026)
- Live-Code geprüft: war die alte, nie verbundene Demo-Version (hartcodierte
  PINs, keine Backend-Anbindung, keine Ganztägig-Checkbox)
- Korrigierte Version mit echter Backend-Anbindung + Ganztägig-Checkbox
  liegt in `team-app/team-kalender-widget.html`
- **Noch offen:** Du fügst den Code ins Elementor-HTML-Widget ein und
  testest PIN-Login, Eintragen/Ändern/Löschen, Ganztägig live

**Test:** Du bestätigst "funktioniert" oder schickst die Fehlermeldung
(inkl. Browser-Konsole, falls Einträge nicht laden — dann brauche ich den
`list`-Teil des Apps Scripts, um die Feldnamen abzugleichen).

## Phase 2 — Bestand bereinigen
- Mislabelte `sourceDate`-Beschreibungen korrigieren, echte Duplikate
  löschen (nur exakte Doppel, keine echten Buchungen anfassen)

**Test:** Erneuter Abgleich aller 10 Hilfskalender gegen die
Verfügbarkeit-Einträge für die nächsten 14 Tage — keine Duplikate mehr.

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
