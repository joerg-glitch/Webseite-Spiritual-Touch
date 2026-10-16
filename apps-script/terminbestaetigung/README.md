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
   Gmail) → in Gmail liegt ein Entwurf mit Beispieldaten. Aussehen prüfen.
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

## Hinweis zu den Amelia-Skripten

`raum-einladung-sync/` (Rückspiegelung nach Amelia) und die
Amelia-bezogenen Teile von `anfragen-verfuegbarkeit-sync/` werden für
Einzelbuchungen nicht mehr gebraucht, sobald Amelia dort nicht mehr
verwendet wird. Der Trigger von `syncTerminAenderungenZurueck` sollte dann
abgeschaltet werden; das ist unabhängig von diesem Skript.
