# Raum-1-Kopie + Kalender-Einladung an echte Mitarbeiter-Mails

Zusatz-Automatik zum bestehenden Buchungssystem (23.08.2026, Jörgs Idee).
Löst zwei Probleme, die entstehen, weil das Team **keinen** Zugriff auf die
@spiritual-touch.de-Mail-Domain oder die internen Hilfskalender hat/haben
soll:

1. Amelia benachrichtigt einen zugewiesenen Mitarbeiter per Mail an
   `anfragen+NAME@spiritual-touch.de` — landet aber nur im gemeinsamen
   `anfragen@`-Postfach, das das Team nicht sieht.
2. Der bestätigte Termin landet im persönlichen Hilfskalender der Person
   (`NAME@spiritual-touch.de`, siehe `team-app/App Script - Sync`) — auch
   darauf hat das Team keinen Zugriff.

Bisher hat Jörg deshalb manuell "du hast einen neuen Termin" in den
Google-Chat-Room der Person geschrieben. Diese Automatik ersetzt das.

## Drei Teile — Teil 1 ist ein reiner Mail-Filter, Teil 2 und 3 sind Code

### Teil 1: Mitarbeiter-Mail weiterleiten (kein Skript nötig)

Jedes Teammitglied hat einen eigenen Google-Chat-Room mit eigener
Mailadresse (`NAME@spiritual-touch.de`) — eine Mail dorthin landet
automatisch im jeweiligen Chat-Room, ganz ohne dass die Person Zugriff auf
die Mail-Domain braucht.

**Einrichtung** (im `anfragen@spiritual-touch.de`-Postfach, einmal pro
Person, z. B. für Asmita):

1. Gmail → Einstellungen → Filter und blockierte Adressen → Neuen Filter
   erstellen.
2. "An" = `anfragen+asmita@spiritual-touch.de`.
3. Weiter → "Weiterleiten an" → `Asmita@spiritual-touch.de` auswählen
   (ggf. vorher als Weiterleitungsadresse bestätigen, falls Gmail das für
   Erstverknüpfung verlangt).
4. Filter erstellen. Für jede Person wiederholen (Liste unten).

### Teil 2: Termin-Kopie nach Raum 1 + Kalender-Einladung (Code.gs)

Kopiert jeden neuen, echten Termin aus dem Hilfskalender einer Person in
den Kalender "Raum 1" und trägt ihre **echte** persönliche Mailadresse als
Gast ein — Google Calendar verschickt daraufhin automatisch eine
Einladungsmail. So bekommt die Person eine Kalender-Einladung an eine
Adresse, die sie tatsächlich liest, ohne dass sie Zugriff auf den
internen Hilfskalender braucht.

**Einrichtung:**

1. Neues Projekt unter [script.google.com](https://script.google.com)
   anlegen, eingeloggt als `joerg@spiritual-touch.de` (hat Zugriff auf
   Raum 1 und alle Hilfskalender).
2. Inhalt von `Code.gs` einfügen.
3. Einmal manuell "runSyncNow" ausführen (▶-Button) → Google fragt nach
   Kalender-Berechtigungen → erlauben.
4. Zeitgesteuerten Trigger einrichten (Uhr-Symbol links): Funktion
   `syncRaumEinladungen`, zeitgesteuert, "Minuten-Timer" → **"Jede
   Minute"** (schnellste verfügbare Option) — damit die Kalender-
   Einladung praktisch zeitgleich mit Amelias Mitarbeiter-Mail ankommt
   und niemand im Team nachfragen muss, wo der Termin bleibt.
5. Zweiten Trigger einrichten: Funktion `syncTeamChangesBackToAmelia`,
   zeitgesteuert, "Tage-Timer" → einmal täglich (Uhrzeit egal, z. B.
   nachts) — siehe "Teil 3" unten.
6. `WP_RESCHEDULE_SECRET` in `Code.gs` (Konfigurationsbereich oben) auf
   ein selbst gewähltes, langes Passwort setzen — und **denselben** Wert
   in `wordpress/buchungs-dashboard/wpcode-snippet.php` bei
   `ST_RESCHEDULE_SECRET` eintragen. Dort außerdem
   `ST_RESCHEDULE_ADMIN_USER_ID` auf eine echte WP-Admin-Nutzer-ID setzen
   (siehe Kommentar dort).

**Wie es erkennt, was ein "echter" Termin ist:** Der Hilfskalender enthält
zwei Arten von Einträgen — die eigenen Verfügbarkeits-Blocker von
`team-app/App Script - Sync` (Titel "Blockiert (Verfügbarkeit-Sync)",
intern per Tag markiert) und die echten, von Amelia geschriebenen
Termine. Das Skript überspringt die Blocker und kopiert nur den Rest.

**Wie es Duplikate verhindert (auch bei Mitarbeiter-Wechsel UND
Verlegung):** Statt den Quell-Termin selbst zu markieren (das ist der
26.08.2026-Vorfall, siehe unten), verfolgt das Skript jeden Termin über
seine **echte Amelia-Termin-ID** — Jörg hat dafür Amelias
Kalender-Vorlage um `Termin-ID: %appointment_id%` in der Beschreibung
ergänzt (Amelia → Einstellungen → Termine → "Titel und Beschreibung der
Veranstaltung"). Diese ID bleibt stabil, auch wenn Amelia bei einer
Umbesetzung oder Verlegung den Kalendereintrag komplett neu anlegt (neue
Google-Event-ID, aber gleiche Amelia-Termin-ID). Bei jedem Lauf
vergleicht das Skript den gespeicherten Stand (Mitarbeiter, Zeit, Titel,
Ort) mit dem aktuellen Amelia-Termin:
- **Unverändert** → nichts zu tun.
- **Anderer Mitarbeiter** → bestehende Raum-1-Einladung umhängen (alten
  Gast raus, neuen rein) statt eine zweite Kopie anzulegen.
- **Andere Zeit/Titel/Ort** (z. B. Kunde verschiebt den Termin) →
  bestehende Raum-1-Kopie wird auf die neue Zeit/Titel/Ort aktualisiert.

Für ältere Termine ohne diese Beschreibungszeile (vor der
Vorlagen-Änderung) fällt das Skript auf den alten Titel+Zeit-Fingerabdruck
zurück — der erkennt eine Umbesetzung noch, eine Verlegung aber nicht
(siehe "Offene Punkte" unten).

**Das Team KANN die Raum-1-Kopie selbst verschieben** — siehe "Teil 3"
unten für die Automatik, die das täglich zurück nach Amelia einspielt.

### Teil 3: Rückrichtung Kalender → Amelia (`syncTeamChangesBackToAmelia`)

**Warum:** Jörgs ausdrückliche Vorgabe (27.08.2026), nachdem er den ersten
Vorschlag (`setGuestsCanModify(false)`, Raum-1-Kopie fest sperren)
ausdrücklich abgelehnt hat: "Das Team muss seine Termine selbst im
Google-Kalender verschieben können. Das ist einfach. Sonst müsste es mir
jedes Mal eine Nachricht schreiben. Dann geht es über drei Ecken, und ich
muss die ganzen Änderungen durchführen. Dann habe ich nichts gewonnen."
Gewünscht: eine Automatik im Hintergrund, die einmal täglich prüft, was
das Team verändert hat, und es automatisch in Amelia einspielt — "ohne
dass ich eingreifen muss, einfach nur im Hintergrund. Ich muss das auch
nicht unbedingt wissen."

**Wie es funktioniert:** Einmal täglich vergleicht `syncTeamChangesBack
ToAmelia()` für jeden per echter Amelia-Termin-ID getrackten Raum-1-Termin
die tatsächliche Start-/Endzeit mit der zuletzt bekannten Amelia-Zeit (im
selben `PropertiesService`-Eintrag gespeichert wie beim Vorwärts-Sync).
Weicht sie ab, hat das Team den Termin verschoben — die neue Zeit wird
per `UrlFetchApp.fetch()` an die neue WordPress-Route `POST
/booking-reschedule` geschickt (siehe `wordpress/buchungs-dashboard/
wpcode-snippet.php` bzw. dessen README), abgesichert per gemeinsamem
Geheimnis im Header `X-ST-Reschedule-Secret` (`WP_RESCHEDULE_SECRET`).
Die Route trägt die neue Zeit über denselben internen Amelia-Endpunkt ein,
den auch die Zuweisung im Buchungs-Dashboard benutzt (`/appointments/{id}`
"Aktualisieren") — Amelia selbst schreibt danach die neue Zeit in den
Hilfskalender zurück, der nächste Minuten-Lauf sieht dort dann bereits
den neuen (mit Raum 1 übereinstimmenden) Stand und tut nichts weiter.

Erfolgreiche Übertragungen laufen **komplett ohne Benachrichtigung** an
Jörg, wie ausdrücklich gewünscht. Nur echte Fehler (WordPress nicht
erreichbar, Amelia lehnt den Request ab) landen per Mail bei ihm
(`sendAlert()`), damit ein hängengebliebener Termin nicht unbemerkt
bleibt.

**Bewusst nicht geprüft:** Doppelbuchungen/Kollisionen mit anderen
Terminen — Jörg hat dieses Risiko am 27.08.2026 in Kenntnis akzeptiert, um
ganz ohne manuellen Freigabe-Schritt auszukommen. Betrifft nur Termine mit
echter Amelia-Termin-ID (`id_`-Schlüssel in `PropertiesService`) — Alt-
Termine ohne `Termin-ID:`-Zeile in der Beschreibung (siehe "Offene
Punkte") werden beim täglichen Rücklauf übersprungen, weil dafür keine
Amelia-Termin-ID zum Zurückschreiben vorliegt.

**Manueller Testlauf:** Im Editor die Funktion `runReverseSyncNow`
auswählen und ▶ klicken (identisch zu `syncTeamChangesBackToAmelia`).

## ⚠️ Vorfall 26.08.2026: hunderte Duplikate bei Eva

Eva war anfangs (mit ihrem privaten Gmail-Kalender statt einem reinen
Amelia-Ressourcen-Konto) in `MEMBERS` enthalten. Zwei Probleme kamen
zusammen:

1. Ihr Kalender enthält ihr **ganzes Leben** (Arzttermine, "Arbeit",
   Hotel-Aufenthalt usw.), nicht nur Amelia-Termine — das Skript hat all
   das fälschlich als neue Termine erkannt.
2. Das ausführende Konto (`joerg@spiritual-touch.de`) hat auf ihrem
   privaten Kalender nur Lese-, keine Schreibrechte — das Markieren
   "schon kopiert" (`setTag`) schlug deshalb jedes Mal mit "Action not
   allowed" fehl. Weil das Kopieren VOR dem Markieren passierte, hat sie
   dadurch jede Minute erneut dieselben Termine kopiert bekommen —
   hunderte doppelte Kalendereinladungen in Raum 1.

**Behoben:**
- Eva aus `MEMBERS` entfernt (sie kopiert ihre Termine seither selbst).
- Strukturell behoben (26.08.2026, zweiter Fund): Statt den Quell-Termin
  selbst zu markieren (brauchte Schreibrechte auf dem Hilfskalender — bei
  Eva nicht vorhanden, daher die Endlosschleife), merkt sich das Skript
  jetzt einen Fingerabdruck in `PropertiesService` und **liest** die
  Hilfskalender nur noch. Kann bei niemandem mehr passieren, selbst wenn
  irgendwann bei jemand anderem nur Lesezugriff besteht.
- Neue Funktion `cleanupEvaMistakenCopies()` in `Code.gs` — löscht alle
  Duplikate in Raum 1 in einem Rutsch, ohne Absage-Mails zu verschicken.
  Braucht einmalig die "Calendar API" als erweiterten Dienst (Editor →
  Dienste (+) → "Calendar API" hinzufügen), dann im Editor die Funktion
  auswählen und ▶ klicken.

## Offene Punkte

✅ **Mila** ist neu im Team und hat noch keinen Hilfskalender —
absichtlich außen vor gelassen, bis das analog zu den anderen (siehe
`team-app`-README) eingerichtet ist. Dann hier in `MEMBERS` ergänzen.

✅ **Mitarbeiter-Wechsel** (23.08.2026 von Jörg angefragt) wird erkannt:
bestehende Raum-1-Einladung wird umgehängt statt eine zweite anzulegen.

✅ **Terminverlegung** (26.08.2026 von Jörg angefragt, Amelia → Kalender)
wird seit dem Umstieg auf die echte Termin-ID ebenfalls erkannt: ändert
sich Datum/Uhrzeit/Titel/Ort in Amelia, wird die bestehende Raum-1-Kopie
automatisch mitverschoben statt eine Karteileiche stehen zu lassen.

⚠️ **Kein Re-Sync bei Terminen ohne `Termin-ID:`-Zeile** in der
Beschreibung (vor der Vorlagen-Änderung vom 26.08.2026 erzeugt) — die
fallen auf den alten Titel+Zeit-Fingerabdruck zurück, der eine
Umbesetzung noch erkennt, eine Verlegung aber nicht. Betrifft nur
Alt-Termine; alles ab dem 26.08.2026 hat die ID und ist davon nicht
betroffen.

✅ **Rückrichtung Kalender → Amelia** (27.08.2026 von Jörg gefordert,
nachdem er die ursprünglich vorgeschlagene feste Sperre der Raum-1-Kopie
ausdrücklich abgelehnt hat) ist seit "Teil 3" oben gebaut: Das Team
verschiebt Raum-1-Termine frei, eine tägliche Automatik trägt die neue
Zeit automatisch in Amelia ein — ohne Rückfrage, ohne Benachrichtigung an
Jörg außer bei echten Fehlern. Bewusst akzeptiertes Restrisiko:
keine Doppelbuchungsprüfung vor dem Zurückschreiben (siehe "Teil 3").

## Echte Mailadressen (Stand 23.08.2026, von Jörg)

| Name | Mailadresse (für Kalender-Einladung) |
|---|---|
| Tara | tara.spiritual@gmail.com |
| Eva | eva.saur1993@gmail.com (seit 26.08.2026 **nicht** in `MEMBERS`, siehe "Vorfall" oben — kopiert ihre Termine selbst) |
| Jörg | joerg@spiritual-touch.de (nicht Teil dieser Automatik) |
| Asmita | rositsa.bogdanova232@gmail.com |
| Amila | uta.schuppert@gmail.com |
| Sarah | sarahfriedrich321@gmail.com |
| Dominik | bimo83@t-online.de |
| Konstantin | konstantion.dellbruegge@gmail.com |
| Alea | alea.tantramassage@gmail.com |
| Stephanie | stephanie@primal-living.de |
| Karen | karenzeiler24@gmail.com |
| Maxine | parampampas@yahoo.com |
| Mila | annamilena369@gmail.com (noch nicht in `MEMBERS`, siehe "Offene Punkte") |

## Sicherheit

Das Skript **liest** die Hilfskalender nur — schreibt oder markiert dort
nichts (seit dem Umstieg auf den Fingerabdruck-Abgleich am 26.08.2026,
siehe oben). Braucht deshalb für die Hilfskalender nur Lesezugriff, keinen
Schreibzugriff.

Es schreibt in zwei Richtungen, beide bewusst begrenzt:
- **Vorwärts** (jede Minute) ausschließlich in Raum 1 (neue Events, oder
  Gästeliste/Zeit/Titel/Ort bestehender Events bei einer erkannten
  Umbesetzung/Verlegung in Amelia).
- **Rückwärts** (einmal täglich, seit 27.08.2026, siehe "Teil 3") sendet
  ausschließlich die neue Start-/Endzeit eines vom Team verschobenen
  Raum-1-Termins an die WordPress-Route `/booking-reschedule` — nie
  direkt an die Amelia-Datenbank, sondern über denselben internen
  Amelia-Endpunkt, den auch das Buchungs-Dashboard benutzt (siehe README
  dort). Abgesichert per gemeinsamem Geheimnis (`WP_RESCHEDULE_SECRET` /
  `ST_RESCHEDULE_SECRET`), das **nirgends im Klartext committet** werden
  darf — beide Konfigurationsstellen enthalten nur Platzhalter, echte
  Werte werden ausschließlich in den jeweiligen Editoren (Apps Script /
  WPCode) eingetragen, nie ins Repo.

In keinem der beiden Fälle wird ein Hilfskalender direkt beschrieben oder
ein Amelia-Termin per rohem Datenbank-Zugriff verändert.
