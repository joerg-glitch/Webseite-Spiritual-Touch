# Monatsabrechnungsliste → Gmail-Entwurf (sevdesk)

Eigenständiges Google-Apps-Script-Projekt. Legt am 1. eines Monats einen
**Gmail-Entwurf** (nicht versendet) mit allen stattgefundenen Terminen des
Vormonats an — als Übersicht zur Übergabe an sevdesk.

## Was es tut

1. Liest die Kalender **Raum 1, Raum 2, Raum 3** und **Raum extern
   (z.B. GdT)** für den kompletten Vormonat.
2. Pro Termin eine Zeile: **Art des Termins · Dauer · Datum (+ Uhrzeit) ·
   Teammitglied** (zusätzlich Raum und ein Hinweis).
3. Entwurf an `joerg@spiritual-touch.de` mit
   - Summe je Teammitglied (Anzahl, Dauer, Stunden dezimal),
   - Tabelle aller Termine,
   - **CSV-Anhang** (`;`-getrennt, UTF-8) für sevdesk/Excel.
4. Aufgabe in Todoist: **„Monatsabrechnungsliste erstellt“** (wiederkehrend
   am 1.) — abhaken, sobald der Entwurf geprüft und übergeben ist.

## Teammitglied ermitteln

| Reihenfolge | Quelle | Beispiel |
|---|---|---|
| 1 | Name im **Titel** | „Massage Tara“ → Tara |
| 2 | Name in der **Beschreibung** | |
| 3 | **Anleger** des Termins („Erstellt von …“): Mailadresse/Anzeigename | „2h TM dusche länger belegt,“ erstellt von Stephanie → Stephanie |
| 4 | sonst **unbekannt** → „Extern/Raumvermietung: Name <Mail>“ | „Coaching S.graul ST“ erstellt von Stefanie Graul |

Termine unbekannter Personen bzw. der Raumvermietung kommen **immer** mit in
die Liste (gelb markiert, Hinweis „Bitte prüfen“). Die Spalte *Zuordnung* im
CSV zeigt, woher der Name stammt.

> ⚠️ Bewusst **kein** Alias „Stefanie“ bei Stephanie hinterlegt: Stefanie
> Graul ist laut Beispiel eine externe Person.
> Hinweis: Steht in einem Titel zufällig der Vorname einer Kundin, die so
> heißt wie ein Teammitglied (z. B. „Massage Sarah“), wird sie diesem
> zugeordnet — dann in der Zeile „Zuordnung = Titel“ gegenprüfen.

## Robustheit

- **Täglicher Trigger mit Nachholen:** Läuft täglich ca. 06:00. Das Skript
  merkt sich den zuletzt erledigten Monat. Fällt der Lauf am 1. aus, wird er
  am Folgetag wiederholt — nie doppelt (zusätzlich Prüfung, ob der Entwurf
  schon existiert).
- Calendar-API-Aufrufe mit Wiederholung/Wartezeit, vollständiges Blättern.
- Sperre gegen parallele Läufe; Fehler → Warnmail an Jörg.
- Ist ein Raumkalender nicht lesbar: **kein stiller Teil-Bericht**, sondern
  Warnmail + Neuversuch am nächsten Tag. Ab dem 5. des Monats entsteht der
  Entwurf trotzdem, mit deutlichem Warnhinweis.
- Wiederkehrende Termine werden einzeln gezählt; abgesagte, abgelehnte,
  „Blockiert (…)“-Blocker und Doubletten (gleiche Termin-ID bzw. Raum +
  Titel + Zeit) werden ignoriert.
- Ganztägige Termine haben keine Dauer → eigener Abschnitt „Bitte prüfen“,
  nicht in der Summe.

## Deployment

1. Neues Projekt auf [script.google.com](https://script.google.com) mit dem
   Konto `joerg@spiritual-touch.de`.
2. `Code.gs` einfügen; unter Projekteinstellungen „appsscript.json im Editor
   anzeigen“ aktivieren und `appsscript.json` übernehmen (aktiviert den
   erweiterten Dienst **Calendar API** — alternativ links *Dienste → + →
   Google Calendar API*, Kennung `Calendar`).
3. **Raum extern:** Die Kalender-ID ist noch nicht hinterlegt. Das Skript
   findet den Kalender über den Namen („Raum extern …“), solange er in
   Jörgs Kalenderliste sichtbar ist. Robuster: ID (Google Calendar →
   Einstellungen des Kalenders → *Kalender-ID*) in `ROOM_CALENDARS` bei
   „Raum extern“ eintragen.
4. `testLetzterMonat` ausführen → Berechtigungen bestätigen → Entwurf in
   Gmail prüfen. Danach den Test-Entwurf löschen und `merkerZuruecksetzen`
   ausführen (sonst gilt der Monat als erledigt).
5. `installTrigger` einmal ausführen (richtet den täglichen Trigger ein).

Nachholen für einen bestimmten Monat: in `entwurfFuerMonatManuell` Jahr/Monat
anpassen und ausführen.

## Anpassen

- `TEAM_MEMBERS`: Namen/Schreibweisen und optional genaue Mailadressen für
  die Anleger-Zuordnung (bisher nur Eva und Jörg bekannt; sonst wird der
  Vorname im Mail-Vorderteil/Anzeigenamen verglichen).
- `ART_RULES`: optionale Kurzbezeichnungen für „Art des Termins“, z. B.
  `{ match: /coaching/i, art: 'Coaching' }`. Ohne Regel wird der Titel ohne
  Mitarbeitername verwendet.
- `GIVE_UP_AFTER_DAY`: ab wann bei fehlendem Kalender trotzdem ein Entwurf
  mit Warnung entsteht (Standard 5).

## Kalender-IDs

| Kalender | ID |
|---|---|
| Raum 1 | `c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com` |
| Raum 2 | `c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com` |
| Raum 3 | `c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com` |
| Raum extern (z.B. GdT) | noch offen (Suche über Namen) |
