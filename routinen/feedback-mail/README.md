# Feedback-Mail-Routine

Täglich einmal: Termine in Raum 1–3 prüfen, die 3 Tage zurückliegen, und für
jeden Gast eine Feedback-Mail als **Gmail-Entwurf** anlegen. Jörg prüft und sendet.

Der komplette Prompt der Routine steht in [`routine-prompt.md`](routine-prompt.md).

## Warum so (einfach & robust)

| Entscheidung | Grund |
|---|---|
| **Kalender ist die Quelle**, nicht das Gmail-Label „04 – Erledigt" | Im Kalender steht der *tatsächliche* Termin (Terminwunsch ≠ Termin, Verlegungen). Das Label „Erledigt" heißt nur „Termin vergeben" – der Termin selbst steht im Kalender. Die Gast-Mailadresse steht in der Terminbeschreibung (`Mail:`). |
| **Nur Entwürfe, kein Versand** | Fehler kosten nichts; Jörg sieht jede Mail vor dem Senden. |
| **Routine schreibt nirgends** (Kalender/Labels/Gmail-Versand) | Kein Zustand, nichts kann kaputtgehen – gleiche Philosophie wie `apps-script/raum-einladung-sync`. |
| **Fenster heute−5 … heute−3 Tage** | Ein ausgefallener Lauf (Wochenende, Fehler) geht nicht verloren. |
| **Doppelte vermeiden über Gmail** (Entwürfe + Gesendet, Betreff „Nachklang"/„Afterglow") | Kein eigener Speicher nötig. Im Zweifel (Gmail-Fehler) lieber kein Entwurf. |
| **Eine Mail pro Adresse** | Zwei Einzelmassagen am selben Tag (zwei Räume, gleiche Mail) → nur eine Mail. |
| **Ohne Mailadresse = nicht raten** | Manche Termine (z. B. von Hand angelegt) haben keine Adresse → landen im Bericht, Jörg macht sie manuell. |

## Was die Routine überspringt

Team-Termine ohne Gast-Mail (Massageaustausch, Coaching, ISTA Circle,
Team-Frühstück …), abgesagte Termine, Ganztags-Termine, Adressen auf
`@spiritual-touch.de` und den WPForms-Platzhalter.

## Einrichtung

1. Neue geplante Aufgabe / Routine anlegen, **täglich** (Uhrzeit egal, z. B. 08:00).
2. Inhalt von `routine-prompt.md` (ab „Du bist der Feedback-Assistent …") als Prompt einfügen.
3. Verbindungen **Google Calendar** und **Gmail** (`joerg@spiritual-touch.de`) aktivieren.
4. Einmal von Hand laufen lassen und prüfen (siehe Test).

## Test (vor dem Scharfschalten)

1. Manuell starten → es entstehen Entwürfe nur für Gast-Termine vor 3–5 Tagen.
2. Zweiten Lauf direkt danach starten → **keine** neuen Entwürfe (Bericht: „schon vorhanden").
3. Stichprobe: Anrede, Sprache (English-Gäste bekommen die englische Vorlage),
   Signatur mit Logo, Empfänger = Gast-Adresse.

## Offene Punkte (bitte kurz bestätigen)

- **Englische Vorlage** ist ein Vorschlag von Claude (Betreff „Afterglow of your
  appointment") – deutsche Vorlage ist 1:1 aus dem Screenshot.
- **Anrede**: Die Vorlage hat „Lieber Wolfgang". Die Routine nimmt „Lieber/Liebe"
  nur bei eindeutigem Vornamen, sonst „Hallo Vorname". Da du jeden Entwurf prüfst,
  korrigierst du Ausreißer beim Senden.
- Ein bewusst **gelöschter** Entwurf wird innerhalb des 3-Tage-Fensters
  (max. 2 Tage lang) erneut angelegt. Wenn dich das stört, Fenster im Prompt auf
  „genau heute−3" verkleinern.
