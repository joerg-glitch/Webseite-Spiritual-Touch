# Feedback-Mail-Routine

Täglich einmal: Termine in Raum 1–3 prüfen, die 3 Tage zurückliegen, und für
jeden Gast eine Feedback-Mail als **Gmail-Entwurf** anlegen. Dazu eine
**Todoist-Aufgabe** „Feedback-Mails freigeben (Datum)" mit allen neuen Entwürfen.
Jörg prüft und sendet.

Der komplette Prompt der Routine steht in [`routine-prompt.md`](routine-prompt.md).

> **Alternative ohne Claude:** Dieselben Regeln als Google Apps Script –
> [`apps-script/feedback-mail-entwuerfe/`](../../apps-script/feedback-mail-entwuerfe/README.md).
> Läuft bei Google selbst, keine Verbindung kann ablaufen. Unterschied: Anrede immer „Hallo Vorname".

## Warum so (einfach & robust)

| Entscheidung | Grund |
|---|---|
| **Kalender ist die Quelle**, nicht das Gmail-Label „04 – Erledigt" | Im Kalender steht der *tatsächliche* Termin (Terminwunsch ≠ Termin, Verlegungen). Das Label „Erledigt" heißt nur „Termin vergeben" – der Termin selbst steht im Kalender. Die Gast-Mailadresse steht in der Terminbeschreibung (`Mail:`). |
| **Nur Entwürfe, kein Versand** | Fehler kosten nichts; Jörg sieht jede Mail vor dem Senden. |
| **Routine schreibt nirgends** (Kalender/Labels/Gmail-Versand) | Kein Zustand, nichts kann kaputtgehen – gleiche Philosophie wie `apps-script/raum-einladung-sync`. |
| **Fenster heute−5 … heute−3 Tage** | Ein ausgefallener Lauf (Wochenende, Fehler) geht nicht verloren. |
| **Doppelte vermeiden über Gmail** (Entwürfe + Gesendet, Betreff „Nachklang"/„Afterglow") | Kein eigener Speicher nötig. Im Zweifel (Gmail-Fehler) lieber kein Entwurf. |
| **Eine Mail pro Adresse** | Zwei Einzelmassagen am selben Tag (zwei Räume, gleiche Mail) → nur eine Mail. |
| **Nur Termine mit Mailadresse** | Alles ohne Gast-Mail wird still ignoriert (kein Raten, keine Gmail-Namenssuche, nicht im Bericht). |
| **Paar-Variante** | Gleiche Adresse zweimal zur gleichen Zeit (zwei Räume) oder Titel mit „Paar/zu zweit/zu dritt" → eine Mail an die vorhandene Adresse, Anrede an beide Vornamen, Euch/Ihr-Form, Betreff „Nachklang Eures Termins". |
| **Eine Todoist-Aufgabe pro Tag** | Fällig heute, Beschreibung = eine Zeile je Entwurf mit Link. Bei Wiederholung am selben Tag wird kein Duplikat angelegt, sondern ein Kommentar ergänzt. Keine neuen Entwürfe → keine Aufgabe. |

## Was die Routine überspringt

Alles ohne Gast-Mailadresse (Massageaustausch, Coaching, ISTA Circle,
Team-Frühstück, Termine ohne Beschreibung …), abgesagte Termine, Ganztags-Termine,
Adressen auf `@spiritual-touch.de` und den WPForms-Platzhalter.

## Einrichtung

1. Neue geplante Aufgabe / Routine anlegen, **täglich** (Uhrzeit egal, z. B. 08:00).
2. Inhalt von `routine-prompt.md` (ab „Du bist der Feedback-Assistent …") als Prompt einfügen.
3. Verbindungen **Google Calendar**, **Gmail** (`joerg@spiritual-touch.de`) und **Todoist** aktivieren.
4. Einmal von Hand laufen lassen und prüfen (siehe Test).

## Test (vor dem Scharfschalten)

1. Manuell starten → es entstehen Entwürfe nur für Gast-Termine vor 3–5 Tagen.
2. Zweiten Lauf direkt danach starten → **keine** neuen Entwürfe (Bericht: „schon vorhanden").
3. Stichprobe: Anrede, Sprache (English-Gäste bekommen die englische Vorlage),
   Signatur mit Logo, Empfänger = Gast-Adresse, Paar-Termin → „Euch/Ihr" + beide Namen.
4. Todoist: genau eine Aufgabe „Feedback-Mails freigeben (…)" mit Links zu den Entwürfen.

## Offene Punkte (bitte kurz bestätigen)

- **Englische Vorlage** ist ein Vorschlag von Claude (Betreff „Afterglow of your
  appointment") – deutsche Vorlage ist 1:1 aus dem Screenshot.
- **Paar-Erkennung** läuft über Titel-Stichwörter und „gleiche Adresse, gleiche Zeit".
  Ein Paar, das als normaler Einzeltermin gebucht wurde, bekommt die Einzel-Mail –
  im Entwurf ggf. von Hand auf „Euch/Ihr" ändern. Der Bericht nennt je Entwurf
  „Einzel/Paar", damit du das schnell siehst.
- **Anrede**: Die Vorlage hat „Lieber Wolfgang". Die Routine nimmt „Lieber/Liebe"
  nur bei eindeutigem Vornamen, sonst „Hallo Vorname". Da du jeden Entwurf prüfst,
  korrigierst du Ausreißer beim Senden.
- Ein bewusst **gelöschter** Entwurf wird innerhalb des 3-Tage-Fensters
  (max. 2 Tage lang) erneut angelegt. Wenn dich das stört, Fenster im Prompt auf
  „genau heute−3" verkleinern.
