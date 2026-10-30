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
| Preis | aus `Dauer: … - … €` | Preis in der Beschreibung (`290 €`) oder `PREISLISTE` im Skript |

In beiden Fällen kopierst du den Termin in einen Raumkalender und nennst die
Begleitung im Titel. Erst dann wird bestätigt.

### Kurzformat (eigene Termine)

```
Thomas                      ← Name (erste Zeile)
 Deutsch                    ← Sprache (Deutsch/English), sonst Deutsch
 393315824625               ← Telefon (wird ignoriert)
thomas@example.com          ← Mail, eigene Zeile
1653                        ← Eintrags-ID (wird ignoriert)
```

Titel: `Tantramassage 2,5 Stunden Maxine` (Dauer + Begleitung). Der Preis steht
nicht im Termin; trage ihn in `PREISLISTE` im Skript ein, z. B.
`{ '2 Stunden': '290,00 €', '2,5 Stunden': '350,00 €' }`. Fehlt die Dauer dort,
wird **nichts gesendet** und Jörg bekommt eine Fehlermail.

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
