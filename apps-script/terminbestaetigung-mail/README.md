# Terminbestätigung per Mail: Raumkalender → Kunde

Ersetzt die frühere Amelia-Terminbestätigung. Kunden buchen über **WPForms**;
sobald Jörg den Termin in einen Raumkalender kopiert und die Begleitung in den
Titel schreibt, geht automatisch die Bestätigungsmail an den Kunden.

Eigenständiges Apps-Script-Projekt (script.google.com als
`joerg@spiritual-touch.de`), getrennt von den anderen Skripten in
`apps-script/`. Der Code steht in `Code.gs`, die Einrichtung im Kopfkommentar
dort.

## Ablauf

1. Kunde bucht über WPForms → Termin landet im **Anfragenkalender**, die
   Kundendaten stehen in der Beschreibung (Block `Gastdaten:`).
2. Jörg **kopiert** den Termin in einen Raumkalender (Raum 1/2/3) und nennt im
   Titel der Kopie die Begleitung, z. B. `Tantramassage 2h (Asmita)`.
3. Das Skript läuft alle 10 Minuten, liest Kunde/Dauer/Preis aus der
   Beschreibung und die Begleitung aus dem Titel, füllt die Mailvorlage
   (Google Doc, je Sprache) und verschickt die Bestätigung.

## Zwei Eingangswege, ein Skript

| | Buchungsformular | Eigene Termine (zweites Formular) |
|---|---|---|
| Kalender vor dem Kopieren | Anfragen | Verfügbarkeit |
| Beschreibung | beschriftet (`Gastdaten:` …) | Kurzformat, siehe unten |
| Dauer | aus `Dauer: …` | aus dem Titel (`2,5 Stunden`) |
| Preis | aus `Dauer: … - … €`, sonst `PREISLISTE` | `PREISLISTE` im Skript (oder `290 €` in der Beschreibung) |

In beiden Fällen kopierst du den Termin in einen Raumkalender und nennst die
Begleitung im Titel. Erst dann wird bestätigt.

### Kurzformat (eigene Termine)

Zwei Varianten, beide werden gelesen. Ab `Nachricht:` wird nichts mehr
ausgewertet (Freitext des Kunden); die Schlusszahl ist die Eintrags-ID.

```
beschriftet                          unbeschriftet
Vorname: Andrea                      Thomas              ← Name (erste Zeile)
Sprache: Deutsch                      Deutsch            ← Sprache, sonst Deutsch
Mobilnummer: 0160…   (ignoriert)      393315824625       ← Telefon (ignoriert)
Email: andrea@example.com            thomas@example.com  ← Mail
Nachricht:                            1653               ← Eintrags-ID (ignoriert)
1810
```

Die Mail muss in der Beschreibung stehen (`Email:`, `Mail:` oder als eigene
Zeile). Ohne Mailadresse (z. B. nur Telefonnummer) wird der Termin ignoriert.
Außerdem zählen nur Termine, die **nach `einrichten`** angelegt wurden.

Titel: `Tantramassage 2,5 Stunden Maxine` (Art + Dauer + Begleitung).

## Art, Dauer, Preis und Begleiter

**Art des Termins** wird aus dem Titel erkannt (die Formularoptionen):
Tantramassage, Paarmassage, Ritual zu Dritt, Körperarbeit (Sexological
Bodywork / Intuitive Körperarbeit), Workshop (Workshop/Berührungscoaching),
Beratung (Paar- oder Einzelberatung), De-Armouring.

**Dauer** in dieser Reihenfolge: Dauer-Zeile der Beschreibung, Dauer im Titel
(`3h`, `2,5 Stunden`). Bei Workshops und „andere Dauer“ ist die Dauer-Zeile
leer, dann muss die Dauer im Titel stehen. Die Länge des Kalendertermins zählt
**nicht**, weil dort Puffer für Vor- und Nachbereitung enthalten ist (Termine
sind immer 4 Stunden lang). Ohne erkennbare Dauer wird nichts gesendet.

**Preis** in dieser Reihenfolge: `… - 290,00 €` in der Dauer-Zeile
(Buchungsformular), sonst `PREISLISTE` im Skript nach Art und Dauer.
`PREISLISTE` ist für alle Arten × 2 / 2,5 / 3 Stunden angelegt; nur
Tantramassage ist gefüllt (290 / 340 / 390 €). Leere Einträge (`''`) trägst du
selbst nach. **Solange ein Preis fehlt, wird nichts gesendet** und Jörg
bekommt eine Fehlermail mit Art und Dauer. Andere Dauern (z. B. 4 Stunden)
ergänzt du als neue Zeile oder schreibst den Preis in die Beschreibung.

**Mehrere Begleiter:** Steht im Titel mehr als ein Teammitglied
(`(Erin & Dominik)`), erscheinen alle in der Mail (`Begleitung: Erin & Dominik`)
und alle bekommen die interne Mail. Erkannt werden nur Namen aus der Liste `TEAM`.

**Hinweis im Titel** wie „noch nicht bestätigt“ wird ignoriert: Sobald
Daten und Begleitung stimmen, geht die Bestätigung raus.

## Erwartetes Format der Terminbeschreibung (Buchungsformular)

```
Dauer: 2 Stunden - 290,00 €
…
Gastdaten:
Name: Max Mustermann    (oder "Vorname: Max", optional zusätzlich "Name: Mustermann")
Mail: max@example.com   (oder "Email: …")
Sprache: English        (optional, sonst Deutsch)
Nachricht: …            (Freitext, wird nie ausgewertet)
```

## Vorlagen (Google Docs)

Je Sprache ein Doc (`VORLAGEN` in `Code.gs`). Text, Fett/Kursiv, Links und
Logo werden übernommen. Platzhalter:

`{{Vorname}}` `{{Name}}` `{{Datum}}` `{{Uhrzeit}}` `{{Begleitung}}`
`{{Dauer}}` `{{Preis}}`

Unbekannte Platzhalter → es wird nichts gesendet, Jörg bekommt eine Mail.

## Einrichtung

1. Neues Projekt auf script.google.com als `joerg@spiritual-touch.de`.
2. `Code.gs` und `appsscript.json` einfügen.
3. `vorlageTesten` ausführen → Berechtigungen erlauben → Test-Entwürfe (de/en)
   liegen in Gmail. Aussehen prüfen.
4. `einrichten` ausführen (setzt `AKTIV_SEIT` und den 10-Minuten-Trigger).
   Nur einmal nötig.
5. Testtermin **neu** in einen Raumkalender kopieren (ältere Kopien zählen
   nicht, sie entstanden vor `AKTIV_SEIT`).
6. Wenn alles passt: `MODUS` von `'ENTWURF'` auf `'SENDEN'` stellen.

## Wichtig zu wissen

- **Kein Doppelversand:** Vor dem Versand wird am Termin eine unsichtbare
  Markierung gesetzt. Klappt das nicht, wird nicht gesendet. Späteres
  Verschieben/Ändern löst keine zweite Bestätigung aus.
- **Neues Teammitglied:** Vorname in der Liste `TEAM` ergänzen, sonst wartet das
  Skript auf einen erkannten Namen im Titel.
- **Nochmal bestätigen:** Termin neu kopieren, alte Kopie löschen.
- Fehler gehen als Mail an `ALERT_EMAIL` (max. 1× alle 6 h je Termin).

## Termin verschieben statt kopieren

Du kannst den Termin auch per „Kalender ändern“ vom Anfragenkalender in einen
Raumkalender **verschieben**, statt ihn zu kopieren. Das Skript funktioniert
dann genauso, mit diesen Unterschieden:

- Ein verschobener Termin behält seine ID und seine Anlegezeit (= Buchungszeit).
  Es zählen nur Termine, die **nach `einrichten`** gebucht wurden; ältere
  Buchungen, die du erst jetzt verschiebst, gelten als Altbestand und werden
  nicht bestätigt.
- Die Wartezeit für den Notfall-Entwurf läuft ab der letzten Änderung, also ab
  dem Verschieben bzw. Umbenennen.
- Die Markierung „bestätigt“ bleibt am Termin. Verschiebst du ihn später von
  Raum 1 nach Raum 2, kommt keine zweite Bestätigung (bei einer neuen Kopie
  schon).
- Der Termin verschwindet aus dem Anfragenkalender. Prüfe, ob dieser Kalender
  noch irgendwo als Belegung gelesen wird (Anfragen-Verfügbarkeits-Sync).

## Profil-Links und Kalenderdatei (.ics)

**Profil-Links:** Der Platzhalter `{{Begleitung}}` wird zu einem Link auf die
Profilseite: `https://spiritual-touch.de/praxis/team/<vorname>` (klein, Umlaute
ausgeschrieben, `Jörg` → `joerg`). Bei mehreren Begleitern ist jeder Name ein
eigener Link (`Erin & Dominik`). In der Textversion der Mail steht die Adresse
in Klammern hinter dem Namen. Einstellungen oben in `Code.gs`: `PROFIL_LINKS`,
`PROFIL_URL`, `PROFIL_SLUGS` (abweichende Endungen, `''` = kein Link). Die
Endungen im WordPress-Dump stimmen mit der Regel überein (alea, amila, asmita,
dominik, eva, joerg, karen, konstantin, maxine, sarah, stephanie, tara). Erin
und Selma sind nach der Regel eingetragen (`erin`, `selma`), Selma zusätzlich
ausdrücklich in `PROFIL_SLUGS` und `CHAT_ADRESSEN`.

**Kalenderdatei:** An jede Bestätigung hängt eine `.ics`-Datei (`Termin.ics`
bzw. `appointment.ics`). Der Gast öffnet sie und trägt den Termin mit einem Klick
in seinen Kalender ein. Beginn = Beginn des Termins, Ende = Beginn + **gebuchte**
Dauer + 30 Minuten Nachlauf (`ICS_NACHLAUF_MIN`; nicht der 4-Stunden-Block). Der Titel lautet „Termin bei Spiritual Touch“,
in der Beschreibung stehen Begleitung, Profil-Links und Dauer. Wer keine Dauer
erkennbar hat (Notfall-Entwurf), bekommt keine Datei. `ICS_ANHANG = false`
schaltet sie ab, `ICS_ORT` ist der „Ort“ (Olschewskibogen 12, 80935 München;
leer = kein Ort). In der Mailvorlage steht dazu der Satz „Den Termin findest Du als Kalenderdatei
im Anhang.“ (zwischen der Hinweisliste und „Sollte etwas Unvorhergesehenes …“).

## Ruhezeit und Datum/Uhrzeit in der Mail

Datum und Uhrzeit der Bestätigung kommen aus dem Termin **zum Zeitpunkt der
Bestätigung**, nicht aus der Buchung. Verschiebst du einen Termin (z. B. vom
20.11. 12:00 auf den 21.11. 13:00), steht in der Mail der neue Zeitpunkt. Damit
keine Mail mit einer Zwischenzeit rausgeht, wartet das Skript, bis der Termin
`RUHEZEIT_MIN` (5 Minuten) unverändert war. Danach (je nach Lauf bis zu 15
Minuten nach deiner letzten Änderung) kommt die Bestätigung. Eine spätere
Änderung von Datum oder Uhrzeit löst **keine** zweite Mail aus.

## Notfall-Entwurf bei unvollständigen Terminen

Erkennt das Skript einen Kundentermin, kann ihn aber nicht automatisch
bestätigen, legt es nach `NOTFALL_ENTWURF_NACH_MIN` (30 Minuten nach der
letzten Änderung des Termins) trotzdem einen **Gmail-Entwurf** mit den vorhandenen Daten an:

- Fehlendes steht als `[PREIS FEHLT]`, `[BEGLEITUNG FEHLT]` usw. in der Mail,
  oben ein roter Hinweis, was fehlt. Hinweis löschen und Lücken füllen, dann
  selbst senden.
- Fehlt die Kundenmail, geht der Entwurf an `joerg@spiritual-touch.de`
  (Empfänger dann eintragen). Die interne Mail an die Begleitung (siehe unten) kommt dazu, soweit
  bekannt. Betreff: `[UNVOLLSTÄNDIG] Terminbestätigung`.
- Immer nur Entwurf, nie ein automatischer Versand, auch bei `MODUS = 'SENDEN'`.
- Zusätzlich kommt eine Hinweismail an `ALERT_EMAIL`. Der Termin wird danach
  markiert; Änderungen am Termin lösen keine automatische Mail mehr aus.
- Die Wartezeit lässt dir Zeit, Titel oder Beschreibung nach dem Kopieren zu
  korrigieren; dann geht die normale Bestätigung raus. `0` = sofort,
  `-1` = ausgeschaltet.

**Erkennbarer Kundentermin** heißt: `Gastdaten:` oder eine Mailadresse in der
Beschreibung, oder Begleitung **und** Art des Termins im Titel. Interne Termine
(Blocker, „Massageaustausch …“) bleiben unberührt.

## Interne Mail an die Begleitung (Chat-Raum)

Zu **jeder** Bestätigung legt das Skript einen **zweiten Entwurf** an: eine interne
Mail an `vorname@spiritual-touch.de` jedes Begleiters im Titel (Vorname klein, Umlaute
ausgeschrieben, z. B. `joerg@`). Sie landet im Google-Chat-Raum der Person. Du
steuerst selbst, wann du sie abschickst, unabhängig von der Kundenmail. Bei
`MODUS = 'SENDEN'` wird sie direkt gesendet. Bei mehreren Begleitern geht eine
Mail an alle Adressen („Hallo Erin & Selma, ihr habt einen neuen Termin“).

Inhalt: Gruß, Kunde (Name), Termin (Datum, Uhrzeit, Dauer), Handynummer,
E-Mail-Adresse, Nachricht des Kunden und Grußformel. Der Betreff lautet
`Neuer Termin: <Name> – <Datum>, <Uhrzeit> Uhr`. Fehlende Angaben stehen als „–“.
Die Handynummer kommt aus `Mobilnummer:`/`Telefon:`/`Handy:` bzw. der Zahlenzeile
im unbeschrifteten Kurzformat, die Nachricht aus `Nachricht:` (die Eintrags-ID am
Ende wird entfernt).

Auch die Notfall-Entwürfe (siehe oben) bekommen die interne Mail, sofern eine
Begleitung bekannt ist.

Die Kundenmail geht **ohne** BCC raus (`BCC_AKTIV = false`); sonst bekäme der
Chat-Raum alles doppelt. Scheitert die interne Mail (z. B. keine Chat-Adresse für
die Person), bleibt die Kundenmail unberührt, und du bekommst eine Hinweismail
an `ALERT_EMAIL`.

Einstellungen oben in `Code.gs`: `INTERN_AKTIV` (interne Mail an/aus),
`CHAT_DOMAIN`, `CHAT_ADRESSEN` (abweichende Adressen; `''` = keine Mail für diese
Person), `BCC_AKTIV` (BCC in der Kundenmail, nur ohne interne Mail sinnvoll).
