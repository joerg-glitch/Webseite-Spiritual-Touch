# Monatsabrechnungsliste → Gmail-Entwurf (sevdesk)

Eigenständiges Google-Apps-Script-Projekt. Legt am 1. eines Monats einen
**Gmail-Entwurf** (nicht versendet) mit allen stattgefundenen Terminen des
Vormonats an — als Übersicht zur Übergabe an sevdesk.

## Was es tut

1. Liest die Kalender **Raum 1, Raum 2, Raum 3** und **Raum extern
   (z.B. GdT)** für den kompletten Vormonat.
2. Pro Termin eine Zeile: **Art des Termins · Dauer · Datum (+ Beginn) ·
   Teammitglied** (zusätzlich Raum, Original-Titel und ein Hinweis).
   Die **Art** wird aus dem Titel erkannt, Abkürzungen werden aufgelöst
   (z. B. „TM“ → „Tantramassage“, siehe `ART_RULES`).
3. Entwurf an `joerg@spiritual-touch.de` mit
   - Kontrollzeile „N gelesen = X berücksichtigt + Y nicht berücksichtigt“,
   - Summe je Teammitglied (Anzahl, Dauer, Stunden dezimal),
   - Tabelle aller berücksichtigten Termine,
   - **Aufstellung der nicht berücksichtigten Termine** mit Grund,
   - zwei **CSV-Anhänge** (`;`-getrennt, UTF-8): `Monatsabrechnung_…` für
     sevdesk/Excel und `Nicht_beruecksichtigt_…`.
4. Aufgabe in Todoist: **„Monatsabrechnungsliste erstellt“** (wiederkehrend
   am 1.) — abhaken, sobald der Entwurf geprüft und übergeben ist.

## Teammitglied ermitteln

| Reihenfolge | Quelle | Beispiel |
|---|---|---|
| 1 | Name im **Titel** | „Massage Tara“ → Tara |
| 2 | **Anleger** des Termins („Erstellt von …“): Mailadresse/Anzeigename | „2h TM dusche länger belegt,“ erstellt von Stephanie → Stephanie |
| 3 | sonst **unbekannt** → „Extern/Raumvermietung: Name <Mail>“ | „Coaching S.graul ST“ erstellt von Stefanie Graul |

Die **Beschreibung** wird nicht ausgewertet (dort stehen nur Gastnamen).
Termine unbekannter Personen bzw. der Raumvermietung kommen **immer** mit in
die Liste (gelb markiert, Hinweis „Bitte prüfen“).

> ⚠️ Bewusst **kein** Alias „Stefanie“ bei Stephanie hinterlegt: Stefanie
> Graul ist laut Beispiel eine externe Person.
> Jörg ist nicht in der Teamliste: Ein Termin ohne Teammitglied-Namen im
> Titel, den Jörg angelegt hat, erscheint als „unbekannt“.

## Nicht berücksichtigte Termine (nichts geht unbemerkt durch)

Jeder gelesene Kalendereintrag ist entweder in der Abrechnung oder steht mit
Grund in der Aufstellung. Gründe:

| Grund | Bedeutung |
|---|---|
| Termin von Jörg | Name „Jörg“ im Titel, kein Teammitglied (nicht abrechnungsrelevant) |
| Von Jörg angelegt, kein Teammitglied im Titel | Seminare, Kreise, Eigenes — oder eine Buchung ohne Namen → bitte prüfen |
| Hinweis auf Absage | „abgesagt/storniert/ausgefallen“ in Titel oder Beschreibung → prüfen, ob stattgefunden |
| Doublette | derselbe Termin steht in zwei Räumen (gleiche Termin-ID bzw. gleiches Teammitglied + Titel + Zeit) |
| Automatischer Blocker | „Blockiert (…)“ aus den Sync-Skripten |
| Von dir abgelehnt / abgesagt | Status im Kalender |
| Beginn im Nachbarmonat | Termin über Monatsgrenze zählt nur im Startmonat |
| Ganztägig | keine berechenbare Dauer |

**Dauer:** Maßgeblich ist **nur, was im Titel oder in der Beschreibung
steht** — nie die im Kalender blockierte Zeit (die enthält Puffer für
Aufräumen und Essen, meist 1–1,5 Std. mehr).

- Titel: „2h 30min“, „2,5h“, „3 h“, „45min“.
- Beschreibung: nur hinter dem Stichwort `Dauer:` (z. B.
  „Dauer: 2,5 Stunden - 340,00 €“ aus den Anfragen). Zahlen aus
  Gästenachrichten („… 2 Std. Termin …“) zählen bewusst nicht.
- Steht nirgends eine Dauer: Feld leer, Zeile gelb, Hinweis „bitte
  ergänzen“ (mit der Kalender-Blockzeit nur zur Info). Der Termin zählt in
  der Stundensumme 0 und die Mail nennt, wie viele Termine betroffen sind.

Bei Terminen mit mehreren Teammitgliedern („Stephanie & Amila“) zählt die
Dauer in der Personensumme für jede Person, in der Gesamtdauer nur einmal.

**Art nicht erkannt:** Passt keine Regel aus `ART_RULES` (z. B. Titel nur
aus Gastnamen wie „17:00 Elena 1h“), steht „(nicht erkannt)“ gelb markiert
in der Liste, der Original-Titel daneben.

## Robustheit

- **Täglicher Trigger mit Nachholen:** Läuft täglich ca. 06:00. Das Skript
  merkt sich den zuletzt erledigten Monat. Fällt der Lauf am 1. aus, wird er
  am Folgetag wiederholt — nie doppelt (zusätzlich Prüfung, ob der Entwurf
  schon existiert).
- Nur der eingebaute `CalendarApp` — keine Zusatzdienste, keine manuelle Aktivierung. Kalender-Aufrufe mit Wiederholung/Wartezeit.
- Sperre gegen parallele Läufe; Fehler → Warnmail an Jörg.
- Ist ein Raumkalender nicht lesbar: **kein stiller Teil-Bericht**, sondern
  Warnmail + Neuversuch am nächsten Tag. Ab dem 5. des Monats entsteht der
  Entwurf trotzdem, mit deutlichem Warnhinweis.
- Wiederkehrende Termine werden einzeln gezählt; abgesagte, abgelehnte,
  „Blockiert (…)“-Blocker und Doubletten (gleiche Termin-ID bzw.
  Teammitglied + Titel + Beginn, auch über Räume hinweg) werden nicht
  gezählt, stehen aber in der Aufstellung der nicht berücksichtigten Termine.

## Deployment

1. Neues Projekt auf [script.google.com](https://script.google.com) mit dem
   Konto `joerg@spiritual-touch.de`.
2. `Code.gs` einfügen (die Datei `appsscript.json` ist optional; es werden
   keine Zusatzdienste gebraucht).
3. `testlaufOktober` ausführen → Berechtigungen bestätigen → Entwurf in
   Gmail prüfen („TESTLAUF – Monatsabrechnungsliste Oktober 2026“) und
   anschließend löschen. Der Testlauf berührt den Merker nicht. (`testLetzterMonat`
   erzeugt dagegen einen echten Entwurf für den Vormonat.)
4. `installTrigger` einmal ausführen (richtet den täglichen Trigger ein).

Nachholen für einen bestimmten Monat: in `entwurfFuerMonatManuell` Jahr/Monat
anpassen und ausführen.

## Anpassen

- `TEAM_MEMBERS`: Namen/Schreibweisen und optional genaue Mailadressen für
  die Anleger-Zuordnung (bisher nur Eva hinterlegt; sonst wird der
  Vorname im Mail-Vorderteil/Anzeigenamen verglichen).
- `ART_RULES`: Titel → Art des Termins, erster Treffer gewinnt, z. B.
  `{ match: /\bTM\b/i, art: 'Tantramassage' }`. Vorbelegt mit den Amelia-
  Angeboten (Tantramassage, Intimmassage Workshop, Bodyflow, Coaching,
  Ritual …). Ohne Treffer steht „(nicht erkannt)“ in der Liste.
- `GIVE_UP_AFTER_DAY`: ab wann bei fehlendem Kalender trotzdem ein Entwurf
  mit Warnung entsteht (Standard 5).

## Kalender-IDs

| Kalender | ID |
|---|---|
| Raum 1 | `c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com` |
| Raum 2 | `c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com` |
| Raum 3 | `c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com` |
| Raum extern (z.B. GdT) | `c_611a7a193e4556c4ea970563ad4febea97e040fbd357211c24111b8fdbfb6966@group.calendar.google.com` |
