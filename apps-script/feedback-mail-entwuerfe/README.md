# Feedback-Mail-Entwürfe (Apps Script)

Täglich um ca. 08:00: Termine in Raum 1–3 von vor 3 Tagen prüfen, pro Gast einen
**Gmail-Entwurf** („Nachklang Deines Termins") anlegen und eine **Todoist-Aufgabe**
„Feedback-Mails freigeben (Datum)" mit Links zu den Entwürfen erstellen.
**Es wird nie eine Mail verschickt** – Jörg prüft und sendet selbst.

Läuft komplett bei Google, ohne Claude-Session und ohne Verbindungen, die ablaufen
können (wie `raum-einladung-sync`). Die Alternative als Claude-Routine steht in
[`routinen/feedback-mail/`](../../routinen/feedback-mail/README.md) – gleiche Regeln.

## Regeln (identisch zur Claude-Routine)

- Quelle ist der **Kalender** (tatsächlicher Termin); die Gast-Mail steht in der
  Terminbeschreibung (Zeile `Mail:`, auch als `mailto:`-Link).
- **Nur Termine mit Gast-Mailadresse** zählen; alles andere wird still ignoriert.
  Nie die Teilnehmerliste benutzen (Masseur:innen, `wpforms-calender-dummy@…`).
- Fenster **heute−5 … heute−3 Tage** (Auffangfenster für ausgefallene Läufe).
- **Paar** = gleiche Adresse zweimal zur gleichen Zeit (zwei Räume) oder Titel mit
  „Paar/Pärchen/Couple/zu zweit/zu dritt" → eine Mail an die vorhandene Adresse,
  beide Vornamen, Euch/Ihr-Form, Betreff „Nachklang Eures Termins".
- Sprache aus `Sprache:` – `English` → englische Vorlage.
- Eine Mail pro Adresse. **Doppelschutz:** schon ein Entwurf oder (14 Tage) eine
  gesendete Mail mit „Nachklang"/„Afterglow" → überspringen. Gmail-Fehler → lieber kein Entwurf.
- Zustandslos, schreibt nirgends in Kalender.

## Einrichtung (einmalig, ca. 10 Minuten)

1. [script.google.com](https://script.google.com) → neues Projekt, **als `joerg@spiritual-touch.de`**.
2. `Code.gs` einfügen. Unter Projekteinstellungen „appsscript.json im Editor anzeigen"
   aktivieren und den Inhalt von `appsscript.json` übernehmen (aktiviert den
   Gmail-Dienst für die Signatur).
3. **Todoist-Token** (optional, ohne ihn entstehen nur die Entwürfe): Todoist →
   Einstellungen → Integrationen → Entwickler → API-Token kopieren → im Apps-Script-Projekt
   Projekteinstellungen → Skripteigenschaften → `TODOIST_TOKEN` = Token.
   *(Der Token gehört nur dorthin, nie in den Code oder ins Repo.)*
4. Funktion **`dryRun`** ausführen → Berechtigungen (Kalender, Gmail, Extern, Mail)
   bestätigen → im Ausführungsprotokoll steht, welche Entwürfe entstehen würden.
5. Funktion **`createFeedbackDrafts`** einmal ausführen → Entwürfe prüfen
   (Empfänger, Anrede, Signatur/Logo, Todoist-Aufgabe). Direkt nochmal ausführen →
   es darf **nichts Neues** entstehen.
6. Funktion **`setupDailyTrigger`** einmal ausführen → tägliche Ausführung um 08:00.

## Bewusste Unterschiede zur Claude-Routine

- **Anrede immer „Hallo Vorname"** (nie „Lieber/Liebe") – ein Skript kann das
  Geschlecht nicht sicher erkennen. Wenn du „Lieber/Liebe" willst, ändere es im Entwurf.
- Todoist-Aufgabe nur bei neuen Entwürfen; ein zweiter Lauf am selben Tag erzeugt keine
  Entwürfe und damit auch keine zweite Aufgabe.
- Fehler (Kalender/Gmail/Todoist) kommen per Mail an Jörg (`ALERT_EMAIL`).

## Zu prüfen beim ersten Lauf

- **Signatur mit Logo:** Sie wird per Gmail-API geladen. Ist das Logo in Gmail als
  eingebettetes Bild gespeichert, kann es im Entwurf fehlen – dann Logo im Signatur-Editor
  per Bild-URL einbinden. Fehlt die Signatur ganz, greift ein Text-Fallback
  (`SIGNATURE_FALLBACK_HTML`).
- **Todoist-API:** nutzt `https://api.todoist.com/api/v1/tasks`. Klappt es nicht,
  steht der Grund in der Alert-Mail.
- **Gelöschter Entwurf** wird innerhalb des Fensters (max. 2 Tage) neu angelegt –
  Fenster verkleinern: `DAYS_FAR = 3`.

## Test der Logik ohne Google

```bash
node apps-script/feedback-mail-entwuerfe/test-logik.js
```

Prüft Mail-/Namen-Erkennung, Paar-Erkennung und Vorlagen mit **erfundenen** Beispieldaten
(nie echte Gastdaten ins Repo). Die Google-Dienste (Kalender, Gmail, Todoist) lassen sich
nur im Apps-Script-Editor per `dryRun` testen.
