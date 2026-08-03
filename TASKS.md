# Tasks: Team-Verfügbarkeits-App für Amelia

Voraussetzung vor Phase 1: Google-Cloud-Projekt + Service Account anlegen,
Service-Account-JSON-Key erzeugen, Service-Account-E-Mail auf allen
Hilfskalendern als Bearbeiter freigeben. (Kurzanleitung folgt beim Start von
Phase 1, kein API-Key wird ins Repo geschrieben.)

## Phase 1 — Lauffähiger Mini-Prototyp
- Google Calendar API Anbindung via Service Account (PHP)
- Skript: Event in einem Test-Hilfskalender anlegen, auflisten, löschen
- Konfiguration (Arbeitsfenster, Kalender-IDs) in einer zentralen Config-Datei

**Test:** Skript gegen einen echten Test-Hilfskalender laufen lassen,
Event via Calendar-API-Abfrage verifizieren (Erstellung + Löschung
funktionieren nachweisbar ohne manuelles Nachschauen im Browser).

## Phase 2 — Übersetzungslogik mit Beispieldaten
- Kernfunktion: Verfügbarkeits-Eintrag → Blocker-Event(e) berechnen
  (ganztag / ab / bis / kein Eintrag)
- Vier Beispiel-Fälle als Testdaten hinterlegen
- Event-Mapping-Tabelle (SQLite), damit Änderungen bestehende Events
  updaten statt Duplikate zu erzeugen

**Test:** Automatisiertes Testskript, das alle vier Beispiel-Fälle gegen
den Test-Hilfskalender durchspielt und die erzeugten Events (Anzahl,
Start-/Endzeit) gegen die erwarteten Werte prüft — läuft ohne manuelles
Zutun durch.

## Phase 3 — Bedienoberfläche
- Formular über persönlichen Link: Datum wählen, Typ wählen (ganztag/ab/bis),
  Liste bereits eingetragener Verfügbarkeiten mit Löschen-Option
- Responsive, einfache Optik in der abgestimmten Farbpalette

**Test:** Manueller Durchlauf im Browser (lokal oder Staging) — Eintrag
anlegen, Kalender-Event erscheint, Eintrag löschen, Blocker wird wieder auf
Ganztag zurückgesetzt.

## Phase 4 — Automatisierung & Übersicht
- Cron-Skript: erzeugt rollierend (60 Tage voraus) Ganztages-Blocker für
  Tage ohne Eintrag
- Übersichtsseite für dich: alle Teammitglieder + ihre nächsten
  Verfügbarkeiten auf einen Blick

**Test:** Cron-Skript manuell einmal ausführen, prüfen dass für neu in den
Horizont rückende Tage automatisch Blocker entstehen, für Tage mit
bestehendem Eintrag aber nichts doppelt angelegt wird.

## Phase 5 — Entscheidung
- Nach 2–4 Wochen echtem Einsatz: Nutzung, Fehinterpretationen durch Team,
  Wartungsaufwand bewerten
- Entscheidung: behalten / verbessern (z. B. Mehrfach-Zeitblöcke pro Tag
  ergänzen) / zurück zu rein manueller Pflege

**Test:** Kurzer Soll/Ist-Abgleich — stimmen Amelia-Buchbarkeit und
tatsächliche Team-Verfügbarkeit für den Testzeitraum überein (Stichprobe
über 5–10 Tage, keine Fehlbuchungen durch falsche Blocker)?
