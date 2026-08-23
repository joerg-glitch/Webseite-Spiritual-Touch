# Termin-Rückspiegelung: Google Kalender → Amelia

Zusatz-Automatik zum bestehenden Buchungssystem (23.08.2026, Jörgs Idee).
Löst zwei Probleme, die entstehen, weil das Team ursprünglich **keinen**
Zugriff auf die @spiritual-touch.de-Mail-Domain oder die internen
Hilfskalender hatte:

1. Amelia benachrichtigt einen zugewiesenen Mitarbeiter per Mail an
   `anfragen+NAME@spiritual-touch.de` — landet aber nur im gemeinsamen
   `anfragen@`-Postfach, das das Team nicht sieht.
2. Der bestätigte Termin landet im persönlichen Hilfskalender der Person
   (siehe `team-app/App Script - Sync`) — auch darauf hatte das Team
   ursprünglich keinen Zugriff.

## ⚠️ Kurswechsel (27.08.2026) — bitte zuerst lesen

Der ursprüngliche Plan für Problem 2 war: jeden neuen Termin automatisch
in eine Kopie im Kalender "Raum 1" spiegeln und der echten persönlichen
Mailadresse eine Kalender-Einladung schicken. Jörgs Entscheidung danach:

> Ich habe mich jetzt dafür entschieden, den Hilfskalender dem jeweiligen
> Teammitglied freizugeben, und die können sich dann den Termin selbst in
> einen Raum legen. Wir haben einen Schritt der Automatisierung weniger.

**Das heißt konkret:**
- Es gibt **keine automatische Raum-1-Kopie mehr**. Jedes Teammitglied
  bekommt stattdessen direkten Google-Calendar-Zugriff auf den **eigenen**
  Hilfskalender (siehe "Hilfskalender freigeben" unten) — ein rein
  manueller Schritt in Google Calendar, kein Code.
- Das Verschieben eines Termins in einen Raumkalender macht die Person
  danach bei Bedarf selbst, direkt in Google Calendar.
- Übrig bleibt genau eine Automatik: **einmal täglich prüfen, ob sich an
  einem echten Amelia-Termin (egal in welchem Kalender er gerade liegt)
  Datum, Uhrzeit oder Dauer geändert haben, und das nach Amelia
  zurückspielen.** Das übernimmt `Code.gs`.

Die Mitarbeiter-Mail-Weiterleitung (Teil 1 unten) ist von diesem
Kurswechsel **nicht** betroffen und bleibt unverändert.

## Teil 1: Mitarbeiter-Mail weiterleiten (kein Skript nötig)

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
4. Filter erstellen. Für jede Person wiederholen.

## Teil 2: Hilfskalender freigeben (kein Skript nötig)

Ersetzt die frühere Raum-1-Kopie. Für jedes Teammitglied einmalig, in
Google Calendar (als `joerg@spiritual-touch.de`, dem der Hilfskalender
gehört):

1. Google Calendar öffnen → links bei "Andere Kalender" den Hilfskalender
   der Person suchen → Drei-Punkte-Menü → "Einstellungen und Freigabe".
2. Unter "Für bestimmte Personen freigeben" → "Nutzer hinzufügen" → die
   **echte persönliche Mailadresse** der Person eintragen (Tabelle unten
   — bewusst nicht die @spiritual-touch.de-Adresse, die soll das Team ja
   gerade nicht für den Hilfskalender brauchen).
3. Berechtigung: "Änderungen an Terminen vornehmen" (nicht nur "Details
   aller Termine ansehen") — die Person muss den Termin ja selbst
   verschieben können.
4. Für jedes Teammitglied wiederholen (Tabelle unten).

Die Person sieht neue Termine damit sofort und nativ in ihrem eigenen
Google-Calendar-Account, sobald sie den freigegebenen Kalender zu ihrer
Ansicht hinzufügt — keine Wartezeit, keine separate Einladung nötig.

## Teil 3: Termin-Rückspiegelung (`Code.gs`, täglicher Trigger)

**Warum:** Jörgs ausdrückliche Vorgabe (27.08.2026), nachdem er den
ursprünglichen Vorschlag (Raum-1-Kopie fest sperren, `setGuestsCanModify
(false)`) ausdrücklich abgelehnt hat: "Das Team muss seine Termine selbst
im Google-Kalender verschieben können. Das ist einfach. Sonst müsste es
mir jedes Mal eine Nachricht schreiben. Dann geht es über drei Ecken, und
ich muss die ganzen Änderungen durchführen. Dann habe ich nichts
gewonnen." Gewünscht: eine Automatik im Hintergrund, die einmal täglich
prüft, was das Team verändert hat, und es automatisch in Amelia
einspielt — "ohne dass ich eingreifen muss, einfach nur im Hintergrund.
Ich muss das auch nicht unbedingt wissen."

**Wie es funktioniert:** `syncTerminAenderungenZurueck()` durchsucht
einmal täglich alle bekannten Kalender (jeden Hilfskalender + alle
Raumkalender, siehe `ROOM_CALENDAR_IDS` in `Code.gs`) nach Terminen mit
der von Jörg ergänzten Beschreibungszeile `Termin-ID: %appointment_id%`
(Amelia → Einstellungen → Termine → "Titel und Beschreibung der
Veranstaltung"). Für jede gefundene Termin-ID wird in **einem** Sammel-
Request bei WordPress der aktuell in Amelia gespeicherte Stand
(`bookingStart`/`bookingEnd`) abgefragt (`GET`-artige Route
`/amelia-appointment-times`, rein lesend) und mit der tatsächlichen
Kalender-Zeit verglichen. Weichen sie ab, hat das Team den Termin
verschoben — die neue Zeit wird per `UrlFetchApp.fetch()` an
`POST /booking-reschedule` geschickt (siehe `wordpress/
buchungs-dashboard/wpcode-snippet.php`), abgesichert per gemeinsamem
Geheimnis im Header `X-ST-Reschedule-Secret` (`WP_RESCHEDULE_SECRET`).
Die Route trägt die neue Zeit über denselben internen Amelia-Endpunkt
ein, den auch die Zuweisung im Buchungs-Dashboard und die Team-App
benutzen — Amelia bleibt so die einzige Stelle, die echte Termine ändert.

**Zustandslos:** Anders als der ursprüngliche Ansatz merkt sich dieses
Skript nichts selbst (kein `PropertiesService`-Fingerabdruck mehr) — der
"zuletzt bekannte Stand" wird bei jedem Lauf frisch bei Amelia erfragt.
Einfacher und robuster: keine veralteten Einträge, kein Aufräumen nötig,
kein Limit von `PropertiesService` zu beachten.

**Raumwechsel selbst lösen nichts aus** — sie ändern nichts an Datum,
Uhrzeit oder Dauer, also gibt es dafür auch nichts zurückzuspielen. Das
Skript findet den Termin einfach im neuen Kalender wieder (über die
Termin-ID, unabhängig davon, in welchem der gelisteten Kalender er gerade
liegt).

**Mehrdeutigkeit:** Taucht dieselbe Termin-ID gleichzeitig in mehr als
einem der gelisteten Kalender auf (z. B. eine Karteileiche aus einem
früheren Test), wird dieser Termin übersprungen und als Warnung an Jörg
gemeldet, statt eine der beiden Zeiten zu raten.

**Bewusst nicht geprüft:** Doppelbuchungen/Kollisionen mit anderen
Terminen — Jörg hat dieses Risiko am 27.08.2026 in Kenntnis akzeptiert, um
ganz ohne manuellen Freigabe-Schritt auszukommen. Betrifft nur Termine mit
echter Amelia-Termin-ID — Alt-Termine ohne `Termin-ID:`-Zeile in der
Beschreibung (siehe "Offene Punkte" unten) werden von diesem Skript gar
nicht erst gefunden.

Erfolgreiche Übertragungen laufen **komplett ohne Benachrichtigung** an
Jörg, wie ausdrücklich gewünscht. Nur echte Fehler (WordPress nicht
erreichbar, Amelia lehnt den Request ab, ein Kalender ist nicht erreichbar,
eine Termin-ID ist mehrdeutig) landen per Mail bei ihm (`sendAlert()`).

**Einrichtung:**

1. Neues Projekt unter [script.google.com](https://script.google.com)
   anlegen, eingeloggt als `joerg@spiritual-touch.de` (hat Zugriff auf
   alle Hilfskalender und Raumkalender).
2. Inhalt von `Code.gs` einfügen.
3. `ROOM_CALENDAR_IDS` prüfen/ergänzen — aktuell ist nur Raum 1 bekannt.
   Gibt es weitere Raumkalender, deren IDs dort ergänzen.
4. `WP_RESCHEDULE_SECRET` auf ein selbst gewähltes, langes Passwort
   setzen — und **denselben** Wert in `wordpress/buchungs-dashboard/
   wpcode-snippet.php` bei `ST_RESCHEDULE_SECRET` eintragen. Dort
   außerdem `ST_RESCHEDULE_ADMIN_USER_ID` auf eine echte WP-Admin-
   Nutzer-ID setzen (siehe Kommentar dort), falls noch nicht geschehen.
5. Einmal manuell `runSyncNow` ausführen (▶-Button) → Google fragt nach
   Kalender-Berechtigungen → erlauben.
6. Zeitgesteuerten Trigger einrichten: Funktion
   `syncTerminAenderungenZurueck`, zeitgesteuert, "Tage-Timer" → einmal
   täglich (Uhrzeit egal, z. B. nachts). **Nur dieser eine Trigger** —
   die frühere Minuten-Automatik entfällt komplett.

## ⚠️ Vorfall 26.08.2026 (historisch)

Betraf den inzwischen entfernten Kopier-Mechanismus, hier zur
Nachvollziehbarkeit stehen gelassen: Eva war anfangs (mit ihrem privaten
Gmail-Kalender statt einem reinen Amelia-Ressourcen-Konto) in der
Kopier-Liste enthalten. Zwei Probleme kamen zusammen:

1. Ihr Kalender enthält ihr **ganzes Leben** (Arzttermine, "Arbeit",
   Hotel-Aufenthalt usw.), nicht nur Amelia-Termine — das Skript hat all
   das fälschlich als neue Termine erkannt.
2. Das ausführende Konto (`joerg@spiritual-touch.de`) hatte auf ihrem
   privaten Kalender nur Lese-, keine Schreibrechte — das Markieren
   "schon kopiert" schlug deshalb jedes Mal fehl, wodurch sie jede Minute
   erneut dieselben Termine kopiert bekam — hunderte doppelte
   Kalendereinladungen in Raum 1.

**Warum das jetzt strukturell nicht mehr passieren kann:** Seit dem
Kurswechsel oben schreibt dieses Skript **nirgends mehr** in einen
Hilfskalender oder Raumkalender — es liest nur und schreibt ausschließlich
nach WordPress/Amelia. Die Ursache des Vorfalls (Schreibversuch auf einen
Kalender ohne Schreibrechte) kann dadurch gar nicht mehr auftreten, egal
bei wem. Evas Hilfskalender ist deshalb wieder Teil der Scan-Liste.
Sollten noch Duplikate aus dem allerersten Testlauf der alten Version in
Raum 1 herumliegen, hilft `cleanupCalendarEventsForGuest_()` in `Code.gs`
(Kommentar dort) beim Aufräumen.

## Offene Punkte

⚠️ **Weitere Raumkalender (Raum 2, 3, …)?** `ROOM_CALENDAR_IDS` in
`Code.gs` kennt aktuell nur Raum 1. Gibt es weitere Räume, deren
Kalender-IDs bitte ergänzen — sonst erkennt das Skript eine Verlegung
dorthin nicht (der Termin taucht dann in keinem der gelisteten Kalender
mehr auf, bis er wieder in einen bekannten Kalender verschoben wird).

✅ **Mila** ist neu im Team und hat noch keinen Hilfskalender —
absichtlich mit `null` in `HILFSKALENDER` außen vor gelassen, bis das
analog zu den anderen (siehe `team-app`-README) eingerichtet ist. Dann
dort ergänzen.

✅ **Mitarbeiter-Wechsel und Terminverlegung durch Amelia/Jörg** betreffen
dieses Skript nicht mehr direkt — es interessiert sich nur noch dafür, ob
die Kalender-Zeit von der Amelia-Zeit abweicht, unabhängig davon, wer/was
zuletzt geändert hat.

⚠️ **Kein Re-Sync bei Terminen ohne `Termin-ID:`-Zeile** in der
Beschreibung (vor der Vorlagen-Änderung vom 26.08.2026 erzeugt) — die
findet dieses Skript gar nicht erst (kein Fallback mehr, anders als in
der Team-App, siehe dort). Betrifft nur Alt-Termine; alles ab dem
26.08.2026 hat die ID und ist davon nicht betroffen.

## Echte Mailadressen (für die Hilfskalender-Freigabe, Stand 23.08.2026)

| Name | Mailadresse (für die Google-Calendar-Freigabe) |
|---|---|
| Tara | tara.spiritual@gmail.com |
| Eva | eva.saur1993@gmail.com |
| Jörg | joerg@spiritual-touch.de (Kalender-Eigentümer, nicht Teil dieser Liste) |
| Asmita | rositsa.bogdanova232@gmail.com |
| Amila | uta.schuppert@gmail.com |
| Sarah | sarahfriedrich321@gmail.com |
| Dominik | bimo83@t-online.de |
| Konstantin | konstantion.dellbruegge@gmail.com |
| Alea | alea.tantramassage@gmail.com |
| Stephanie | stephanie@primal-living.de |
| Karen | karenzeiler24@gmail.com |
| Maxine | parampampas@yahoo.com |
| Mila | annamilena369@gmail.com (noch nicht in `HILFSKALENDER`, siehe "Offene Punkte") |

## Sicherheit

Das Skript **liest** die gelisteten Kalender nur — schreibt oder markiert
dort nichts. Braucht deshalb für Hilfskalender und Raumkalender nur
Lesezugriff, keinen Schreibzugriff (die Schreibberechtigung, die das Team
für die Hilfskalender bekommt, ist für die *Personen*, nicht für dieses
Skript).

Schreibt ausschließlich nach WordPress, in zwei Schritten:
1. Rein lesend: `/amelia-appointment-times` fragt den aktuellen Amelia-
   Stand für gefundene Termin-IDs ab.
2. Nur bei erkannter Abweichung: `/booking-reschedule` trägt die neue
   Zeit ein — nie direkt an die Amelia-Datenbank, sondern über denselben
   internen Amelia-Endpunkt, den auch das Buchungs-Dashboard und die
   Team-App benutzen (siehe deren READMEs).

Beide Routen sind per gemeinsamem Geheimnis abgesichert
(`WP_RESCHEDULE_SECRET` / `ST_RESCHEDULE_SECRET`), das **nirgends im
Klartext committet** werden darf — beide Konfigurationsstellen enthalten
nur Platzhalter, echte Werte werden ausschließlich in den jeweiligen
Editoren (Apps Script / WPCode) eingetragen, nie ins Repo.
