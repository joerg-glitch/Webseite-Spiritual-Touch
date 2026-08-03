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
- Amelia schreibt echte Buchungen direkt in denselben Hilfskalender (z. B.
  "2,5h (Asmita)" mit Kundendaten) — kein Konflikt mit der Blocker-Logik

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

## Offene Punkte / gefundene Probleme (per Live-Check 03.08.2026)

1. **Login-Fix noch nicht von dir live getestet** (Stand Notion-Doc
   31.07.2026) — PIN-Login, Eintragen/Ändern/Löschen, Ganztägig-Checkbox.
2. **Lücke bei Asmita:** Für den 07.08. existiert weder ein
   Verfügbarkeits-Eintrag noch ein Blocker im Hilfskalender. Nach der
   geltenden Regel müsste der Tag komplett blockiert sein — aktuell wäre
   Asmita an dem Tag in Amelia fälschlich buchbar.
3. **Unsauberes Bookkeeping bei Asmita/Maxine:** einzelne Blocker haben ein
   falsches `sourceDate` in der Beschreibung (das Event selbst liegt am
   richtigen Tag, nur das Label stimmt nicht), dazu harmlose Duplikate
   (derselbe Blocker zweimal angelegt). Kein akutes Live-Risiko, zeigt aber:
   der manuelle Prozess prüft nicht, was schon existiert, bevor er neu
   anlegt.
4. **Kernproblem:** Die Übersetzung läuft manuell durch Claude-Chat-
   Sitzungen statt automatisiert — fehleranfällig (siehe 2+3) und
   erfordert jedes Mal einen neuen Chat.

## Empfehlung für die nächsten Schritte

1. Lücke bei Asmita (07.08.) schließen — ein einzelner, klar begründeter
   Kalender-Eintrag. Da das in ein Live-Buchungssystem schreibt: **auf
   dein Go warten**, bevor ich das anlege.
2. Übersetzung als **wiederkehrende Routine** einrichten (direkter
   Google-Calendar-Zugriff ist in dieser Session vorhanden) statt
   "manueller Cowork-Agent" — täglich, idempotent (prüft vor dem Anlegen,
   ob für den Tag schon ein korrekter Blocker existiert), rollierend für
   die nächsten ~45 Tage.
3. Ursprünglich geplanter PHP/SQLite-Neubau: **verworfen** — nicht mehr
   nötig, die Team-App existiert bereits und funktioniert im Kern.

## Personalisierung

Design-System der Team-App ist bereits im Notion-Dokument definiert
(CSS-Variablen `--st-sand`, `--st-clay` etc., warme Erdtöne) — passt zum
"Spiritual Touch"-Charakter, keine Änderung nötig.
