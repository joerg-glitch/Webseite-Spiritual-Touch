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
| Dauer | aus `Dauer: …` | aus dem Titel (`2,5 Stunden`), sonst Termindauer |
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
(`3h`, `2,5 Stunden`), sonst die Länge des Kalendertermins (Start bis Ende).
Bei Workshops und „andere Dauer“ ist die Dauer-Zeile leer, dann greifen Titel
bzw. Termindauer.

**Preis** in dieser Reihenfolge: `… - 290,00 €` in der Dauer-Zeile
(Buchungsformular), sonst `PREISLISTE` im Skript nach Art und Dauer.
`PREISLISTE` ist für alle Arten × 2 / 2,5 / 3 Stunden angelegt; nur
Tantramassage ist gefüllt (290 / 340 / 390 €). Leere Einträge (`''`) trägst du
selbst nach. **Solange ein Preis fehlt, wird nichts gesendet** und Jörg
bekommt eine Fehlermail mit Art und Dauer. Andere Dauern (z. B. 4 Stunden)
ergänzt du als neue Zeile oder schreibst den Preis in die Beschreibung.

**Mehrere Begleiter:** Steht im Titel mehr als ein Teammitglied
(`(Erin & Dominik)`), erscheinen alle in der Mail (`Begleitung: Erin & Dominik`)
und alle bekommen das BCC. Erkannt werden nur Namen aus der Liste `TEAM`.

**Hinweis im Titel** wie „noch nicht bestätigt“ wird ignoriert: Sobald
Daten und Begleitung stimmen, geht die Bestätigung raus.

## Erwartetes Format der Terminbeschreibung (Buchungsformular)

```
Dauer: 2 Stunden - 290,00 €
…
Gastdaten:
Name: Max Mustermann
Mail: max@example.com
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

## Begleitung im BCC (Google-Chat-Raum)

Die Bestätigung geht zusätzlich als BCC an `vorname@spiritual-touch.de` jedes
Begleiters im Titel (Vorname aus dem Titel, klein, Umlaute ausgeschrieben, z. B.
`joerg@`). Die Mail landet so im Google-Chat-Raum der Person; der Kunde sieht
die Adresse nicht. Einstellungen oben in `Code.gs`: `BCC_AKTIV`, `BCC_DOMAIN`
und `BCC_ADRESSEN` (abweichende Adressen; `''` = kein BCC für diese Person).
Der Chat-Raum bekommt dieselbe Mail wie der Kunde, also **ohne** Telefon oder
Mailadresse des Kunden.
