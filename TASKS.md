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

## Phase 3 — Übersetzung automatisieren (erledigt: Code bereitgestellt, 03.08.2026)
- Eigenständiges Apps-Script-Projekt `team-app/App Script - Sync` gebaut —
  läuft **ohne Cowork-Assistent/Claude-Session**, per stündlichem
  Zeit-Trigger direkt bei Google
- Regel: kein Eintrag -> ganztägig blockiert; ganztägig verfügbar -> kein
  Blocker; Teilverfügbarkeit -> Blocker vor/nach der angegebenen Zeit
- Idempotent: löscht/erzeugt nur eigene `autoBlock:true`-Events, fasst
  echte Amelia-Buchungen nie an
- Legacy-Alteinträge (ohne `member:`-Tag) werden per Freitext-Erkennung
  ("ab"/"bis"/Zeit-Bindestrich) bestmöglich mitverarbeitet

**Noch offen:** Du richtest das neue Apps-Script-Projekt ein (Code
einfügen, `setupHourlyTrigger` einmal manuell ausführen, Kalender-
Berechtigung bestätigen), danach `runSyncNow` einmal zum Testen.

**Test:** Nach `runSyncNow`: alle 10 Hilfskalender stichprobenartig prüfen
— Ganztägig-Einträge ohne Blocker, Tage ohne Eintrag komplett blockiert,
Teilverfügbarkeit korrekt vor/nach der Zeit blockiert, keine Duplikate.

## Phase 4 — Laufender Betrieb beobachten
- 1–2 Wochen laufen lassen, stichprobenartig prüfen ob Amelia-Buchbarkeit
  mit echter Verfügbarkeit übereinstimmt

**Test:** Stichprobe über 5–10 Tage, keine Fehlbuchungen.

## Phase 5 — Entscheidung
- Reicht die Routine dauerhaft, oder soll die Übersetzung doch fest in
  Apps Script (stündlich, wie ursprünglich geplant) verlagert werden?

**Test:** Kurzer Soll/Ist-Vergleich nach 2–4 Wochen.
