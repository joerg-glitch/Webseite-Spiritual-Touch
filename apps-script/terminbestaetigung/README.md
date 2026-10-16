# Terminbestätigung per Mail (Raumkalender → Kunde)

Ersetzt die frühere Amelia-Terminbestätigung (Oktober 2026, nachdem
Einzelbuchungen von Amelia zurück auf WPForms + Google Calendar gewandert
sind).

## Ablauf

```
Kunde → WPForms → Anfragenkalender (Kundendaten in der Beschreibung)
        ↓ Jörg verteilt und KOPIERT den Termin in Raum 1/2/3,
        ↓ Titel der Kopie z. B. "Tantramassage 2h (Asmita)"
Raumkalender → Skript (alle 10 Min.) → Bestätigungsmail an den Kunden
```

Das Kopieren in den Raumkalender ist der Auslöser — kein zusätzlicher
Handgriff. Es wird nur **einmal** je Termin bestätigt; spätere
Verschiebungen lösen keine zweite Mail aus.

## Woher kommen die Daten?

| Platzhalter | Quelle |
|---|---|
| `{{Vorname}}` / `{{Name}}` | Beschreibung, Zeile `Name:` im Block `Gastdaten:` (Vorname = erstes Wort) |
| *(Empfänger)* | Beschreibung, Zeile `Mail:` im Block `Gastdaten:` |
| `{{Dauer}}` / `{{Preis}}` | Beschreibung, Zeile `Dauer: 2 Stunden - 290,00 €` |
| `{{Datum}}` / `{{Uhrzeit}}` | **Start des Raumkalender-Termins** (nicht des Anfragen-Termins) — Verschiebst Du die Kopie vor dem Lauf, stimmt die Mail |
| `{{Begleitung}}` | Titel der Kopie: erster Vorname aus der Liste `TEAM` in `Code.gs` |

Der Freitext `Nachricht:` des Kunden wird nie ausgewertet.

## Zweisprachigkeit (Deutsch / English)

Das WPForms-Formular hat ein Feld **„Sprache / Language“**; seine Zeile
`Sprache: …` steht in der Terminbeschreibung im Block `Gastdaten:` (vor
`Nachricht:`). Das Skript wählt danach die Vorlage:

| Zeile in der Beschreibung | Vorlage | Betreff |
|---|---|---|
| enthält „English“/„Englisch“ | Doc „Terminbestätigung englisch“ | Appointment confirmation |
| „Deutsch“, unbekannter Wert oder Zeile fehlt | Doc „Terminbestätigung deutsch“ | Terminbestätigung |

In der englischen Mail werden Datum und Dauer mit übersetzt
(„Saturday, 17 October 2026“, „2 hours“, „€290.00“). Die Platzhalter im
englischen Doc heißen **genauso** wie im deutschen (`{{Datum}}`, `{{Dauer}}`
…), nur der Text drumherum ist Englisch. Beide Doc-IDs stehen in `VORLAGEN`
in `Code.gs`. Eine weitere Sprache = weiteres Doc + Eintrag dort + Erkennung
in `leseTermin_`.

Der Link „terms and conditions“ im englischen Doc zeigt noch auf die deutsche
AGB-Seite — bei Bedarf im Doc auf eine englische Seite umstellen.

## Vorlage vorbereiten (einmalig)

Im Google Doc „Terminbestätigung deutsch“ die kursiven Wörter durch
Platzhalter ersetzen (Kursiv dabei wegnehmen, Fett darf bleiben). Die
Formatierung eines Platzhalters übernimmt das Skript von seiner ersten
Klammer `{{`; unsichtbare Formatwechsel mitten im Platzhalter schaden nicht:

| Im Doc steht jetzt | Ersetzen durch |
|---|---|
| `Hallo Name,` | `Hallo {{Vorname}},` |
| `Datum:` + `Datum` | `Datum: {{Datum}}` |
| `Uhrzeit` (in „um … Uhr“) | `{{Uhrzeit}}` |
| `Uhrzeit` (in „pünktlich um … vor Ort“) | `{{Uhrzeit}}` |
| `Begleitung:` + `Teammitglied` | `Begleitung: {{Begleitung}}` |
| `Dauer:` + `Termin-Dauer` | `Dauer: {{Dauer}}` |
| `Honorar:` + `Preis` | `Honorar: {{Preis}}` |

Alles andere (Text, Fett, AGB-Link, Logo) wird so übernommen. Textänderungen
an der Vorlage wirken sofort, ohne am Skript etwas zu ändern.

## Einrichtung

1. [script.google.com](https://script.google.com) → neues Projekt, eingeloggt
   als `joerg@spiritual-touch.de`.
2. `Code.gs` einfügen; in den Projekteinstellungen „appsscript.json im Editor
   anzeigen“ und dessen Inhalt durch die Datei hier ersetzen (Zeitzone).
3. `vorlageTesten` ausführen (▶) → Berechtigungen erlauben (Kalender, Docs,
   Gmail) → in Gmail liegen zwei Entwürfe (Deutsch und English) mit
   Beispieldaten. Aussehen prüfen.
4. `einrichten` ausführen: setzt den Startzeitpunkt und legt den
   10-Minuten-Trigger an. Nur einmal nötig.
5. Testtermin **neu** in einen Raumkalender kopieren (Titel mit Vorname,
   z. B. `Tantramassage 2h (Asmita)`). Die bisherige Test-Kopie in Raum 2 ist
   älter als der Startzeitpunkt und wird bewusst ignoriert. Nach spätestens
   10 Minuten liegt der Entwurf in Gmail (`MODUS = 'ENTWURF'`).
6. Passt alles: in `Code.gs` `MODUS` auf `'SENDEN'` stellen. Ab dann geht die
   Mail direkt an den Kunden und steht in Gmail unter „Gesendet“.

Optional in `Code.gs`: `ABSENDER_ALIAS` (z. B. `anfragen@spiritual-touch.de`,
muss in Gmail unter „Senden als“ eingerichtet sein) und `ANTWORT_AN`.

## Sicherheitsnetze

- **Nur neue Termine:** Es zählen nur Termine, die nach „einrichten“ angelegt
  wurden — Altbestand (auch Amelia-Termine) wird nie angefasst.
- **Wartet statt zu raten:** Steht noch der Anfragen-Titel
  (`Tantramassage (Tantric massage)`) ohne Teammitglied im Titel, passiert
  nichts, bis der Name drinsteht.
- **Kein Doppelversand:** Erst markieren, dann senden. Schlägt das Markieren
  fehl, wird nichts gesendet.
- **Keine halbfertigen Mails:** Unbekannter/zerrissener Platzhalter, fehlender
  Name oder fehlende Dauer/Preis-Zeile → nichts wird gesendet, Jörg bekommt
  eine Fehlermail (je Termin höchstens alle 6 Stunden), der nächste Lauf
  versucht es erneut.
- Interne Termine (Blocker, Pausen) ohne `Gastdaten:`/`Mail:` werden
  ignoriert.

## Wartung

- Neues Teammitglied: Vorname in der Liste `TEAM` ergänzen.
- Neuer Raum: Eintrag in `RAUM_KALENDER` ergänzen.
- Mail noch einmal schicken: den Termin neu kopieren und die alte Kopie
  löschen (neue Kopie = neuer Termin).

## Erweiterungen (`Erweiterungen.gs`) – gebaut, noch ausgeschaltet

Vier Bausteine, die an den bestätigten Terminen im Raumkalender hängen. Datei
liegt im selben Projekt wie `Code.gs`. **Ausgeliefert ist alles aus**
(`FUNKTIONEN` ganz oben in der Datei, alle vier auf `false`): Solange die
Schalter aus sind, passiert nichts, auch wenn die Datei schon im Projekt liegt.

| Baustein | Was passiert | Wann | Vorlage |
|---|---|---|---|
| `team` | Info-Mail an die Begleitung (Adresse aus der Liste `TEAM_MAILS`) mit Termin, Raum, Gast (Name, Mobilnummer, Mail, Sprache), Wünschen und Nachricht des Gastes. **Nicht** an Jörg selbst (`TEAM_OHNE_MAIL`). | im Lauf der Kundenbestätigung (spätestens 10 Min. danach) | fester Text im Skript (`teamText_`) |
| `erinnerung` | Erinnerung an den Kunden | ab 24 h vor Beginn; nicht, wenn der Termin in <4 h beginnt oder erst <24 h vorher bestätigt wurde | Docs [deutsch](https://docs.google.com/document/d/10yp5r67Mffy7UD6BJYP1C8FlRUvbZSsVmZHpvdB-9w4/edit) / [englisch](https://docs.google.com/document/d/1A_IivOj9RRp0Z0GwFysH6udeay9F-nSR4EMPdsONcU4/edit) |
| `feedback` | Feedback-Anfrage an den Kunden | 3 Tage nach dem **Ende** des Termins (später als 7 Tage danach nicht mehr) | Docs [deutsch](https://docs.google.com/document/d/1eBWS5r0MvlD8SNrD1XS9KEYgwTEh0R9xeimYKo0CoZk/edit) / [englisch](https://docs.google.com/document/d/1UFzeWprIcdIjVniEP74XL3mlCKaqnZX3DCH14WuMlHc/edit) |
| `kontaktlog` | Jeder Kontakt (Bestätigung, Team-Info, Erinnerung, Feedback-Anfrage) wird als Zeile in einer Google-Tabelle protokolliert | sofort nach dem jeweiligen Versand | — |

Die Kundenvorlagen sind Kopien der Bestätigungs-Docs (gleiches Logo, gleiche
Signatur, gleiche Platzhalter) und werden wie diese im Doc bearbeitet. Das
Feedback-Doc übernimmt den Text der bisherigen Amelia-Feedback-Mail; die drei
Links (Feedback-Formular, Google, Trustpilot) sind direkt im Doc hinterlegt,
es gibt dafür keinen Platzhalter und nichts im Skript zu pflegen. Sprache
(Deutsch/English) wird auch hier aus der Zeile `Sprache:` gewählt.
Erinnerung und Feedback gehen nur zwischen 8 und 21 Uhr raus.

### Verhalten, das man kennen sollte
- Alles gilt nur für Termine, die `Code.gs` bestätigt hat. Altbestand bleibt
  unberührt, ebenso Termine ohne Teammitglied im Titel.
- **Absage:** Termin im Raumkalender löschen → Erinnerung und Feedback
  entfallen von selbst.
- **Verschiebung:** Erinnerung und Feedback richten sich nach der neuen Zeit,
  solange sie noch nicht gesendet wurden. Eine bereits gesendete Erinnerung
  wird nicht wiederholt.
- **Kein rückwirkender Versand:** Beim ersten Einschalten eines Bausteins
  merkt sich das Skript den Zeitpunkt. Team-Info und Kontaktverlauf gelten nur
  für Termine, die danach bestätigt wurden, Feedback nur für Termine, die
  danach enden. Die Erinnerung gilt für alle bestätigten, noch bevorstehenden
  Termine – direkt nach dem Einschalten bekommen also auch Termine in den
  nächsten 4–24 Stunden eine Erinnerung.
- Jeder Schritt hat seine eigene Markierung und Fehlerbehandlung: Ein Fehler
  im Kontaktverlauf blockiert weder Team-Info noch Erinnerung. Nach einem
  Fehler wird automatisch erneut versucht (Fehlermail höchstens alle 6 h je
  Termin und Schritt).

### Einschalten (empfohlene Reihenfolge)
1. `Code.gs` **und** `Erweiterungen.gs` aus dem Repo in das Apps-Script-Projekt
   übernehmen (Code.gs hat zwei kleine Einhängepunkte bekommen und verhält sich
   mit ausgeschalteten Erweiterungen unverändert).
2. `erweiterungenTesten` ausführen → fünf Beispiel-Entwürfe in Gmail
   (Erinnerung de/en, Feedback de/en, Team-Info). Aussehen prüfen.
3. `trockenlauf` ausführen → das Ausführungsprotokoll zeigt, was jetzt
   passieren würde, ohne etwas zu senden oder zu markieren.
4. Einen Baustein in `FUNKTIONEN` auf `true` stellen, mit `MODUS = 'ENTWURF'`
   beginnen, ein paar Tage beobachten, dann `MODUS = 'SENDEN'`.
   Reihenfolge-Vorschlag: `kontaktlog` → `team` → `erinnerung` → `feedback`.
5. Für `kontaktlog` zuerst `kontaktTabelleAnlegen` ausführen: Die Tabelle
   entsteht im eigenen Drive, der Link steht im Protokoll und kommt per Mail.
   **Nur für Dich freigeben.**

### Kontaktverlauf (Kundendatenbank)
- Blatt **Kontaktverlauf**: eine Zeile je Kontakt mit Zeit, Ereignis, Kunde,
  E-Mail, Telefon, Sprache, Termin, Uhrzeit, Begleitung, Raum, Dauer, Preis,
  Modus (gesendet/Entwurf), Termin-ID (Kalender) und einer leeren Spalte
  **Notiz** für eigene Anmerkungen.
- Blatt **Kunden**: Auswertung je E-Mail-Adresse (Name, Anzahl Termine, letzte
  Bestätigung) per Formel, nichts zu pflegen.
- Der Freitext der Gäste (`Nachricht`, `Wunsch`, `Alternativen`) wird
  **bewusst nicht** gespeichert (Datensparsamkeit). Ausgeschrieben steht er nur
  in der Team-Info an die Begleitung.
- Eingaben, die mit `=`, `+`, `-` oder `@` beginnen, werden als Text abgelegt,
  damit Kundeneingaben nie als Formel laufen.
- Die Tabelle enthält personenbezogene Daten über Massage-Kunden. Bitte
  festlegen, wie lange Einträge aufbewahrt werden (z. B. 2–3 Jahre nach dem
  letzten Termin) und Zeilen auf Wunsch löschen. Löschen einer Zeile hat keine
  Auswirkung auf den Versand.

### Team-Adressen pflegen
Eine Team-Info geht nur an Personen, die in `TEAM_MAILS` (`Erweiterungen.gs`)
mit Adresse eingetragen sind. Neues Teammitglied:
1. Vorname in `TEAM` (`Code.gs`) ergänzen → Termine mit diesem Namen im Titel
   werden erkannt und bestätigt.
2. Adresse in `TEAM_MAILS` eintragen, sobald sie existiert.

Steht jemand in `TEAM`, aber (noch) nicht in `TEAM_MAILS`, geht an den Gast
trotzdem alles normal raus. Jörg bekommt eine Mail „Keine Team-Adresse für …“
(höchstens alle 6 h je Termin), und die Team-Info wird automatisch nachgeholt,
sobald die Adresse eingetragen ist. Wer bewusst nie eine Team-Info bekommen
soll (Jörg), steht in `TEAM_OHNE_MAIL` – ohne Hinweismail. Vorbelegt sind die
Adressen `vorname@spiritual-touch.de` für alle bisherigen Mitglieder (Eva
bestätigt); **Mila fehlt noch**, bis ihre Adresse existiert.

### Offene Punkte vor dem Einschalten
- **Feedback-Anfragen sind rechtlich nicht dasselbe wie Erinnerungen:**
  Bewertungs-/Feedback-Mails gelten in Deutschland häufig als Werbung. Die
  Vorlage enthält deshalb am Ende eine kurze Abmelde-Zeile („Wenn Du solche
  Nachrichten nicht möchtest, sag uns kurz Bescheid.“); sicherer ist zusätzlich
  ein Hinweis bzw. Häkchen im WPForms-Formular. Das ist keine Rechtsberatung —
  bitte im Zweifel kurz prüfen lassen.
- **Abmelden:** Wer keine Feedback-Mails mehr will, antwortet per Mail. Eine
  automatische Sperrliste gibt es bisher nicht; Notiz „kein Feedback“ in der
  Kontakt-Tabelle ist der manuelle Weg.
- **Englisches Feedback-Formular:** Der Link im englischen Doc führt zur
  deutschen Seite `spiritual-touch.de/feedback-termine`. Falls es eine
  englische Version gibt, im englischen Doc austauschen.

## Hinweis zu den Amelia-Skripten

`raum-einladung-sync/` (Rückspiegelung nach Amelia) und die
Amelia-bezogenen Teile von `anfragen-verfuegbarkeit-sync/` werden für
Einzelbuchungen nicht mehr gebraucht, sobald Amelia dort nicht mehr
verwendet wird. Der Trigger von `syncTerminAenderungenZurueck` sollte dann
abgeschaltet werden; das ist unabhängig von diesem Skript.
