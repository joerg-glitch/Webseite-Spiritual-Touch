# ST Buchungs-Dashboard

Mobile Lese-Übersicht über anstehende Amelia-Buchungen — für unterwegs, ohne
Amelia-Plan-Upgrade (Elite) und ohne Umweg über Gmail.

## Was es tut und was bewusst nicht

- Zeigt alle Buchungen der nächsten 30 Tage (Zeit, Service, Mitarbeiter,
  Kunde, Telefon, Status) als mobil-optimierte Kartenliste, sortiert nach
  Datum. "Ausstehend" ist farblich hervorgehoben.
- Filter "Alle / Anfragen / Bestätigt": erkennt an der `providerId` der
  Buchung, ob sie noch bei einem der drei Geschlechts-Pseudo-Mitarbeiter
  hängt oder schon auf einen echten Mitarbeiter umgehängt wurde — passend
  zu Jörgs Kategorie-Mechanik (versteckte Kategorie "Bestätigt" mit einem
  Duplikat pro Dienstleistung, damit im Nachhinein ein freier Mitarbeiter
  eingesetzt werden kann). Rein clientseitig, kein zusätzlicher Request
  (siehe "Anfragen/Bestätigt-Filter"-Fix weiter unten für die Historie).
- Liest **direkt aus der Amelia-Datenbank** (read-only SQL) — kein
  Amelia-REST-API-Produkt nötig, das ist ab Elite-Plan gated. Diese Lösung
  läuft in jedem Plan, weil sie einfach dieselbe Datenbank liest, die Amelia
  selbst nutzt.
- **Freigeben direkt im Dashboard** (Status "Ausstehend" → "Freigegeben"),
  per "Freigeben"-Button an jeder ausstehenden Buchung. Ruft dabei nicht
  irgendeinen eigenen Code auf, sondern denselben internen Amelia-Endpunkt,
  den Amelias eigene Oberfläche selbst benutzt (`admin-ajax.php?action=
  wpamelia_api&call=/appointments/status/{id}`), mit der gerade aktiven
  Login-Session des Admins. Dadurch laufen Bestätigungsmail,
  Google-Kalender-Sync und Zahlungsstatus-Folgeaktionen exakt wie bei einem
  normalen Klick in Amelia — kein Nachbau, kein rohes Datenbank-UPDATE.
- **Smart Freigeben:** Klick auf "Freigeben" bei einer Anfrage-Buchung
  ermittelt, welche Mitarbeiter:innen zur Geschlechts-Präferenz des Kunden
  passen, und zeigt sie zur Auswahl — auch wenn nur eine Person infrage
  kommt. Jörg wählt nach einem kurzen Blick in den eigenen Kalender
  manuell aus, danach laufen Kategorie/Dienstleistung/Mitarbeiter setzen
  und Freigeben automatisch. Bewusst **keine** automatische
  Verfügbarkeitsprüfung (siehe Abschnitt "Smart Freigeben" unten, warum
  ein erster Versuch darüber verworfen wurde). Siehe dort auch für
  Referenzdaten.

## Sicherheit

Buchungsdaten enthalten Namen, Telefonnummern und Angebotsart — sensibler als
die reine Verfügbarkeitsanzeige der anderen Bausteine in diesem Projekt.
Deshalb bewusst **kein** statisches Secret-Token (wie beim Team-App-Proxy),
sondern echte WordPress-Anmeldung:

- Der Shortcode `[st_booking_dashboard]` rendert nur etwas, wenn der
  aufrufende Nutzer eingeloggt ist und `manage_options` hat (Admin).
- Jede REST-Route (`booking-overview`, `booking-approve`,
  `booking-availability`, `booking-reassign`, `amelia-reference`,
  `amelia-bootstrap-debug`) prüft dieselbe Berechtigung serverseitig,
  unabhängig vom Shortcode, und verlangt einen gültigen WordPress-REST-Nonce
  (`X-WP-Nonce`-Header). Ohne aktive, eingeloggte Session gibt es keine
  Daten und keine Aktion — auch nicht, wenn jemand die REST-URL direkt
  aufruft.
- **Ausnahme `booking-reschedule`:** Diese Route wird nicht vom Dashboard
  im Browser aufgerufen, sondern serverseitig von `apps-script/
  raum-einladung-sync` und `team-app/App Script` (kein WordPress-Login
  vorhanden, siehe dort). Statt der Nonce-/Session-Prüfung verlangt sie
  ein gemeinsames Geheimnis im Header `X-ST-Reschedule-Secret`
  (`hash_equals()`-Vergleich gegen `ST_RESCHEDULE_SECRET`). Für den
  eigentlichen Amelia-Request wird intern kurzzeitig ein fest hinterlegter
  Admin-Account simuliert (`wp_set_current_user(ST_RESCHEDULE_ADMIN_USER_ID)`),
  damit derselbe Cookie-Mint-Mechanismus wie bei den anderen Routen
  greift — das ist kein echter Login, wirkt nur für die Dauer dieses
  einen Requests. ⚠️ `ST_RESCHEDULE_SECRET` und `ST_RESCHEDULE_ADMIN_USER_ID`
  müssen vor Go-Live in `wpcode-snippet.php` mit echten Werten befüllt
  werden (siehe Kommentare direkt über der Konstante).
- Die Freigeben-Aktion (und alles Zukünftige, das echte Amelia-Requests
  nachschickt) **speichert nirgends** Login-Cookies, Nonces oder Tokens im
  Code oder in der Datenbank. Sie liest bei jedem Aufruf live `$_COOKIE` aus
  dem gerade laufenden Request (also die Session des Admins, der das
  Dashboard gerade benutzt) und reicht diese Cookies serverseitig an Amelias
  eigenen internen Endpunkt weiter. Der Amelia-Nonce wird jedes Mal frisch
  von der echten Amelia-Bookings-Seite abgegriffen, nie fest hinterlegt.
  ⚠️ Genau deshalb bitte **niemals** echte Cookie-Werte oder Tokens (z. B.
  aus einem DevTools-Mitschnitt) in dieses Repo committen — nur die
  Request-*Struktur* (URL, Payload-Form) ist relevant, nie die konkreten
  Session-Werte selbst. Falls doch mal ein Mitschnitt mit echten Werten
  irgendwo landet (Dokument, Screenshot): sicherheitshalber in WordPress
  überall ausloggen ("Log out everywhere" im Profil), das invalidiert alle
  darin enthaltenen Cookies/Tokens sofort.

## Deployment

1. **WPCode** → Neuer Snippet (PHP Snippet, "Auto Insert" = nicht nötig, da
   Funktionen + Shortcode über PHP-Code-Type liefen wie beim bestehenden „ST
   Kalender Proxy"-Snippet).
2. Inhalt von `wpcode-snippet.php` einfügen, Snippet aktivieren.
3. Neue (oder bestehende private) WordPress-Seite anlegen, dort den
   Shortcode `[st_booking_dashboard]` einfügen (Elementor: Shortcode-Widget,
   oder Gutenberg: Shortcode-Block).
4. Seite auf dem Handy öffnen (dabei im selben Browser als Admin eingeloggt
   sein) — am besten danach "Zum Home-Bildschirm hinzufügen", dann verhält
   sie sich wie eine App.

**Versionsnummer prüfen:** Ganz unten im Dashboard steht seit dem
21.08.2026 eine Versionsnummer (z. B. "Version 2026-08-21.4"). Nach jedem
Deploy kurz die Seite neu laden und die Nummer mit der `ST_BD_VERSION` ganz
oben in `wpcode-snippet.php` vergleichen — stimmen sie überein, ist das
Deploy wirklich angekommen. Bei jeder inhaltlichen Änderung an der Datei
wird die Nummer erhöht (Datum + laufende Nummer, siehe Verlauf im
Datei-Header).

## Falls die erste Ausführung einen SQL-Fehler zeigt

Die Abfrage geht von den Standard-Amelia-Tabellen/-Spalten aus
(Tabellenpräfix `txva_`, siehe `database/wordpress-content.sql` in diesem
Repo). Amelia-Schema kann je nach Plugin-Version leicht abweichen. Diagnose:

```
https://spiritual-touch.de/wp-json/st/v1/booking-overview?debug=1
```

(im Browser aufrufen, während als Admin eingeloggt) — listet die tatsächlichen
Spalten von `amelia_appointments`, `amelia_customer_bookings`, `amelia_users`
und `amelia_services`. Damit lässt sich die SQL-Abfrage in `wpcode-snippet.php`
in ein bis zwei Zeilen korrigieren — dasselbe Vorgehen, mit dem seinerzeit der
Team-App-Login-Bug (`getActiveSheet()` statt festem Tab-Namen) gefunden wurde.

## Dispatch: Coworking-Agent legt eine neue Anfrage direkt an

**Anwendungsfall:** Eine Anfrage kommt außerhalb von Amelia rein (Telefon,
WhatsApp, Mail). Statt das manuell in Amelia einzutragen, schickt Jörg einem
Claude-Chat (Claude Code, mit Netzwerkzugriff) eine Nachricht mit Kategorie/
Dienstleistung, Mitarbeiter:in, Datum/Uhrzeit und den Kundendaten — der
Agent trägt es über `/booking-dispatch` direkt in Amelia ein und gibt es im
selben Zug frei.

### Zwei Stufen (Testphase, seit 18.09.2026)

Jörg will den Agenten erst ein paar Wochen beobachten, bevor er ihm
erlaubt, direkt freizugeben. Deshalb läuft der Ablauf standardmäßig in
zwei getrennten Nachrichten:

1. **"Da ist eine Anfrage reingekommen…"** → `/booking-dispatch` legt sie
   als **"Anfrage" (pending)** an. Sie erscheint im Buchungs-Dashboard
   (Filter "Anfragen") und kann in Ruhe geprüft werden — noch keine
   Kundenmail, noch kein Hilfskalender-Eintrag.
2. **"Passt, gib frei[, und kopiere in Raum 2]"** → `/booking-dispatch-confirm`
   gibt frei (löst jetzt Amelias Bestätigungsmail aus, Amelia schreibt
   automatisch in den Hilfskalender der zuständigen Person) und kopiert
   optional in einen Raumkalender.

Sobald sich das bewährt hat, kann Jörg dem Agenten auch sagen **"gib
direkt frei"** — dann übergibt `/booking-dispatch` gleich `status:
"approved"` und Schritt 2 entfällt (Raum-Kopie ginge in dem Fall trotzdem
nur über einen separaten `/booking-dispatch-confirm`-Aufruf ohne erneutes
Freigeben, da die Route "erneut freigeben" für einen schon freigegebenen
Termin unschädlich, aber unnötig ist — in der Praxis also weiterhin am
einfachsten: Raum-Wunsch immer als eigene, zweite Nachricht).

### Stufe 1 — `POST /wp-json/st/v1/booking-dispatch`

Abgesichert per gemeinsamem Geheimnis im Header `X-ST-Dispatch-Secret`
(`ST_DISPATCH_SECRET`) — kein WP-Login vorhanden, da ein Chat-Agent
aufruft, kein Browser. Nutzt für die Amelia-Session intern dieselbe
`ST_RESCHEDULE_ADMIN_USER_ID` wie `/booking-reschedule`.

Body:
```json
{
  "serviceId": 33,
  "providerId": 7,
  "date": "2026-09-25",
  "time": "14:00",
  "durationSeconds": 7200,
  "status": "pending",
  "customer": {
    "firstName": "Anna",
    "lastName": "Beispiel",
    "email": "anna@beispiel.de",
    "phone": "+49 151 23456789"
  },
  "internalNotes": "z. B. Herkunft der Anfrage (WhatsApp/Telefon)"
}
```

`serviceId`/`providerId` sind Amelia-IDs — der Agent löst Jörgs
Klartext-Angaben ("Kategorie X", "Mitarbeiter Y") vorher über die
schon vorhandene, rein lesende Route `/amelia-reference` (Kategorien,
Dienstleistungen mit Kategorie-ID, Mitarbeiter mit Name) in IDs auf.
`status` weglassen oder `"pending"` = nur anlegen (Standardfall in der
Testphase); `"approved"` nur, wenn Jörg in derselben Nachricht ausdrücklich
sofortige Freigabe sagt. Ein Kunde mit gleicher E-Mail wird wiederverwendet
statt dupliziert. Antwort enthält die neue `appointmentId` — die braucht
Schritt 2.

`durationSeconds` ist optional und nur relevant für Services mit Amelias
"Preise nach Dauer"-Funktion (mehrere Dauer/Preis-Varianten innerhalb
**einer** Dienstleistung, z. B. Basis 1,5 Std./€250 plus 2 Std./€290,
2,5 Std./€340, …, sichtbar unter `durationOptions` in der
`/amelia-reference`-Antwort). Weglassen = Basis-Dauer des Service. Angegeben,
aber keine gültige Variante für diesen Service → `422
invalid_duration_for_service` mit der Liste erlaubter Werte in der Antwort,
statt stillschweigend die falsche Dauer zu nehmen. Amelia berechnet den
Preis serverseitig selbst aus `serviceId` + `duration` — im Payload wird
kein eigener Preis mitgeschickt.

### Stufe 2 — `POST /wp-json/st/v1/booking-dispatch-confirm`

Gleiches Geheimnis (`X-ST-Dispatch-Secret`). Body:
```json
{ "appointmentId": 123, "room": 2 }
```
`room` ist optional (`1`/`2`/`3`) — weglassen, wenn nur freigegeben werden
soll, ohne in einen Raumkalender zu kopieren. Gibt intern denselben
bereits bewährten `/appointments/status`-Weg wie der "Freigeben"-Button im
Dashboard, danach (falls `room` gesetzt) den Raum-Kopie-Schritt unten.

### Raum-Kopie: reine Google-Calendar-Sache, hat mit Amelia nichts zu tun

Jörg hat den früheren automatischen Kopier-Mechanismus
Hilfskalender→Raum-1 abgeschaltet ("zu viel Chaos im Kalender"). Es gibt
in Amelia selbst **kein** Feld für den Raum — laut Jörg (18.09.2026)
"lässt sich das dort nicht lösen, das geht nur im Google Kalender". Sobald
ein Termin freigegeben ist, schreibt Amelia ihn automatisch in den
persönlichen Hilfskalender der zuständigen Person (wie schon immer, siehe
"Smart Freigeben" unten) — von dort kopiert `/booking-dispatch-confirm`
ihn bei Bedarf per Zuruf in einen der drei Raumkalender.

Technisch: `st_copy_to_room_calendar_()` in `wpcode-snippet.php` delegiert
an eine neue Aktion **`copyToRoom`** im bereits laufenden
`team-app/App Script` (dasselbe Apps-Script-Projekt, das auch PIN-Login,
Verfügbarkeit und "Termine ändern" bedient — keine neue Bereitstellung
nötig, nur die neue Aktion). Die Funktion sucht den Termin per
`Termin-ID:`-Zeile über alle bekannten Hilfskalender und legt eine Kopie
im Zielraum an; dieselben drei Raumkalender-IDs wie in
`apps-script/raum-einladung-sync/Code.gs` (`ROOM_CALENDAR_IDS`, dort
Ausgangsquelle, hier dupliziert). Idempotent: ruft Jörg "kopiere in Raum
2" versehentlich zweimal für denselben Termin auf, entsteht keine zweite
Kopie.

Eigenes Geheimnis `DISPATCH_ROOM_SECRET` im Apps Script (Aufrufer ist
WordPress, nicht der PIN-geschützte Team-App-Weg) — `ST_APPS_SCRIPT_URL`
und `ST_APPS_SCRIPT_DISPATCH_SECRET` in `wpcode-snippet.php` müssen auf
dieselbe /exec-URL bzw. denselben Geheimwert gesetzt sein.

### Für den Claude-Chat, der die Dispatch-Nachricht bekommt

1. **Neue Anfrage:** Kategorie/Dienstleistung + Mitarbeiter:in aus Jörgs
   Nachricht per `GET /wp-json/st/v1/amelia-reference` (Admin-Session oder
   `X-ST-Dispatch-Secret`-Header) in IDs auflösen, dann:
   ```bash
   curl -sS -X POST 'https://spiritual-touch.de/wp-json/st/v1/booking-dispatch' \
     -H 'Content-Type: application/json' \
     -H 'X-ST-Dispatch-Secret: <von Jörg mitgeteilter Wert>' \
     -d '{"serviceId":33,"providerId":7,"date":"2026-09-25","time":"14:00","customer":{"firstName":"Anna","lastName":"Beispiel","email":"anna@beispiel.de","phone":"+49 151 23456789"}}'
   ```
   Antwort kurz bestätigen (z. B. "Anfrage #123 angelegt, wartet auf deine
   Freigabe") — die `appointmentId` merken, Schritt 2 braucht sie.
2. **Freigabe-Zuruf** ("passt, gib frei" / "gib frei und kopiere in Raum
   2"):
   ```bash
   curl -sS -X POST 'https://spiritual-touch.de/wp-json/st/v1/booking-dispatch-confirm' \
     -H 'Content-Type: application/json' \
     -H 'X-ST-Dispatch-Secret: <von Jörg mitgeteilter Wert>' \
     -d '{"appointmentId":123,"room":2}'
   ```
3. Bei einem Fehler immer die `error`/`detail`-Felder wörtlich an Jörg
   zurückmelden statt zu raten — beide Handler geben bei jedem Fehlschritt
   gezielt Diagnosedaten mit.
   `ST_DISPATCH_SECRET` steht nicht im Repo (Secret, siehe Abschnitt
   "Geheimnisse" ganz unten) — Jörg teilt den aktuellen Wert dem
   jeweiligen Chat direkt mit.

### ⚠️ Noch nicht live verifiziert: Anlegen-Payload

Alle anderen Schreib-Aktionen in dieser Datei (Freigeben, Zuweisen,
Verschieben) wurden erst per DevTools-Mitschnitt einer echten Amelia-
Aktion gebaut, dann live getestet (siehe Abschnitt "Smart Freigeben" unten
für die Methode). Für **komplett neue** Anfragen gibt es diesen Mitschnitt
noch nicht — `st_build_create_payload_()` in `wpcode-snippet.php` ist eine
begründete Ableitung aus dem bekannten "Aktualisieren"-Payload (siehe
"Payload-Form" unten), nicht bestätigt:

- Unklar, ob `POST admin-ajax.php?action=wpamelia_api&call=/appointments`
  (ohne ID) tatsächlich der richtige Endpunkt fürs Neu-Anlegen ist.
- Unklar, ob ein neuer Kunde wirklich per eingebettetem `"customer"`-Objekt
  im Booking (statt `customerId`) angelegt wird, und ob die erwarteten
  Feldnamen stimmen.
- Unklar, in welcher Form die neue Termin-ID in der Antwort steckt —
  `st_extract_new_appointment_id_()` probiert mehrere plausible Pfade.

**Vor dem ersten echten Einsatz:** Einmal eine Test-Anfrage über
`/booking-dispatch` mit `status: "pending"` schicken (keine Bestätigungsmail),
das Ergebnis prüfen (`ok`/`error`, in Amelia nachsehen, ob wirklich ein
Termin + Kunde angelegt wurden) und bei einem Fehler mit den mitgelieferten
Diagnosedaten (`amelia_response`, `payload_sent`) nachbessern lassen — exakt
derselbe Iterationsweg, mit dem auch die anderen Routen hier fertig gebaut
wurden.

### Health-Check & Benachrichtigung bei Ausfall

`GET /wp-json/st/v1/booking-dispatch-healthcheck` prüft rein lesend, ob das
Nonce-Scraping (`st_scrape_amelia_nonce_()`) noch funktioniert — genau die
Stelle, die am 21.08.2026 schon einmal durch eine Amelia-/WordPress-
Änderung kaputt ging. Ein WP-Cron-Job ruft das automatisch alle 6 Stunden
auf; schlägt es fehl, geht höchstens einmal täglich eine Warn-Mail an
`ST_DISPATCH_ALERT_EMAIL` (Jörgs Adresse, oben in `wpcode-snippet.php`
gesetzt) raus, solange das Problem besteht. Deckt **nicht** ab, ob der
Anlegen-Payload selbst noch zu Amelias Schema passt (das würde einen
Schreibtest brauchen, bewusst nicht automatisch, um nicht ungewollt
Testtermine zu erzeugen) — nur, ob die Grundvoraussetzung (Admin-Session,
Nonce) noch steht. Dieselbe Voraussetzung nutzt auch die Freigabe in
`/booking-dispatch-confirm` (Stufe 2) — ein grüner Health-Check deckt also
beide Dispatch-Routen ab. Die Raum-Kopie (Apps Script, `copyToRoom`) läuft
technisch unabhängig davon und wird von diesem Health-Check nicht geprüft.

## Geheimnisse & Konfigurationswerte — Referenz

Namen, Zweck und Fundort aller Werte, die für Dispatch gebraucht werden —
**ohne echte Werte**, die dokumentiert Jörg bewusst an anderer Stelle
(siehe seine Entscheidung vom 18.09.2026: Repo-Historie ist praktisch
unlöschbar, siehe der Datenbank-Sicherheitshinweis ganz oben im
Haupt-README). Wer einen Wert braucht, fragt Jörg im jeweiligen Chat
danach.

| Name | Zweck | Datei/Konstante |
|---|---|---|
| Dispatch-Geheimnis (Claude → WordPress) | Header `X-ST-Dispatch-Secret` bei `/booking-dispatch` und `/booking-dispatch-confirm` | `ST_DISPATCH_SECRET` in `wordpress/buchungs-dashboard/wpcode-snippet.php` |
| Reschedule-Geheimnis (Apps Script → WordPress) | Header `X-ST-Reschedule-Secret` bei `/booking-reschedule` | `ST_RESCHEDULE_SECRET` in `wpcode-snippet.php`, muss exakt `WP_RESCHEDULE_SECRET` in `apps-script/raum-einladung-sync/Code.gs` **und** `team-app/App Script` entsprechen |
| Admin-Nutzer-ID für Server-zu-Server-Aufrufe | `wp_set_current_user()` für Nonce-Scraping ohne echten Browser-Login (Reschedule + Dispatch) | `ST_RESCHEDULE_ADMIN_USER_ID` in `wpcode-snippet.php` |
| Raum-Kopie-Geheimnis (WordPress → Apps Script) | Feld `secret` bei Aktion `copyToRoom` | `ST_APPS_SCRIPT_DISPATCH_SECRET` in `wpcode-snippet.php`, muss exakt `DISPATCH_ROOM_SECRET` in `team-app/App Script` entsprechen |
| Apps-Script-Web-App-URL (Team-App-Backend) | Ziel für den `copyToRoom`-Aufruf | `ST_APPS_SCRIPT_URL` in `wpcode-snippet.php` — dieselbe `/exec`-URL, die die Team-App schon nutzt |
| Alarm-Empfänger | Ziel der Health-Check-Warnmail | `ST_DISPATCH_ALERT_EMAIL` in `wpcode-snippet.php` (aktuell Jörgs Adresse, kein Secret) |

Jede Konstante trägt im Code selbst einen Platzhalter
(`DEIN-ZUFAELLIGES-PASSWORT-HIER…` bzw. `BITTE-EXEC-URL-EINTRAGEN`) —
solange der noch drinsteht, ist die jeweilige Route nicht einsatzbereit
(die Handler erkennen das teils selbst, z. B. `apps_script_not_configured`).

## Nicht Teil dieses Bausteins (mögliche nächste Schritte)

- Push-Benachrichtigung bei neuer Buchung (derzeit: Dashboard muss aktiv
  geöffnet werden, kein automatischer Alert).

## Aus dem DevTools-Mitschnitt vom 16.08. ausgewertet

Von den 6 mitgeschnittenen Requests waren zwei die eigentlichen
Schreib-Aktionen, der Rest waren Nebeneffekte der Oberfläche (Amelia prüft
z. B. automatisch freie Slots/Coupons neu, wenn im Formular ein Dropdown
wechselt — das musste nicht separat nachgebaut werden):

- **Freigeben** — `POST .../appointments/status/{id}` mit Body
  `{"status":"approved"}`. Einfach, in sich abgeschlossen, **bereits
  eingebaut** (Button an jeder ausstehenden Buchung im Dashboard).
- **"Aktualisieren"** — `POST .../appointments/{id}` mit dem **kompletten
  Termin-Objekt** als Body (Kategorie, Service, Mitarbeiter, Kundendaten,
  Freitext-Nachricht, Zahlungslink-Einstellung, uvm. — alles in einem
  Objekt). Das ist vermutlich die Aktion hinter Kategorie/Dienstleistung/
  Mitarbeiter ändern.

## Rückrichtung Kalender/Team-App → Amelia (`/booking-reschedule`)

Gehört technisch zu `apps-script/raum-einladung-sync` und `team-app/`,
nicht zu Smart Freigeben — hier dokumentiert, weil die Route in dieser
Datei lebt. **Zwei unabhängige Aufrufer:**

1. **`apps-script/raum-einladung-sync`** (täglich): Jörgs ausdrückliche
   Vorgabe (27.08.2026): Das Team muss bestätigte Termine frei im
   Google-Kalender verschieben können, ohne ihm jedes Mal Bescheid geben
   zu müssen — "sonst geht es über drei Ecken". Statt einer automatischen
   Kalender-Kopie (früherer Ansatz, siehe README des Skripts, Abschnitt
   "Kurswechsel") gibt Jörg dafür jedem Teammitglied direkten Zugriff auf
   den eigenen Hilfskalender. Eine tägliche Automatik im Apps-Script-
   Projekt vergleicht für jeden per Termin-ID gefundenen Raumkalender-
   Termin dessen Zeit direkt mit dem zugehörigen Hilfskalender-Eintrag
   (gilt als "zuletzt bekannter Amelia-Stand", da davon ausgegangen wird,
   dass niemand den Hilfskalender selbst bearbeitet) und trägt eine
   Abweichung über `/booking-reschedule` automatisch nach.
2. **`team-app/App Script`** (sofort, bei Bedarf): Im Menüpunkt "Termine"
   der Team-App kann jedes Mitglied eigene Termine direkt über einen
   "Ändern"-Button anpassen (siehe `team-app/README.md`) — ruft dieselbe
   Route synchron auf, sobald gespeichert wird. Ersetzt den ursprünglich
   angedachten Ansatz mit eingebettetem Amelia-Mitarbeiter-Panel.

Beide Wege laufen ganz ohne Freigabe-Schritt und ohne dass Jörg davon
erfährt (nur echte Fehler landen per Mail bei ihm, bei der Team-App direkt
als Fehlermeldung in der App).

**Route:** `POST /booking-reschedule` mit Body
`{appointmentId, newBookingStart, newBookingEnd}` — die beiden Zeitfelder
als UTC-MySQL-Strings (`"YYYY-MM-DD HH:MM:SS"`). `st_fetch_appointment_raw_()`
liefert dafür zusätzlich `category_id` (Join auf `amelia_services`), damit
`st_build_reschedule_payload_()` — im Unterschied zu
`st_build_reassign_payload_()` — `categoryId`/`serviceId`/`providerId`
unverändert aus der DB übernehmen kann und nur `bookingStart`/`date`/`time`/
`duration` überschreibt. Ruft danach denselben
`st_amelia_ajax_call_('POST', '/appointments/' . $id, [], $payload)` wie
`/booking-reassign` auf — also wieder Amelias eigener interner Endpunkt,
kein rohes DB-UPDATE, dieselbe Begründung wie überall sonst in diesem
Baustein (native Kalender-Sync/Notifications bleiben erhalten).

**Bewusst nicht gebaut:** Keine Doppelbuchungs-/Kollisionsprüfung vor dem
Zurückschreiben — Jörg hat dieses Risiko am 27.08.2026 ausdrücklich in
Kenntnis akzeptiert, um ganz ohne manuellen Freigabe-Schritt auszukommen.

**Fallback ohne Termin-ID:** `/booking-reschedule` akzeptiert entweder
`appointmentId` direkt, oder — für Termine ohne `Termin-ID:`-Zeile in der
Kalenderbeschreibung (ältere Buchungen von vor Jörgs Amelia-Vorlagen-
Änderung) — ersatzweise `providerId` + `oldBookingStart` + `oldBookingEnd`.
In dem Fall löst der Handler die Termin-ID selbst per DB-Abgleich auf
(`SELECT id FROM amelia_appointments WHERE providerId = … AND
bookingStart = … AND bookingEnd = …`) — eindeutig, weil ein:e
Mitarbeiter:in nicht zwei Termine mit exakt derselben Start-/Endzeit haben
kann. Der Apps-Script-Aufrufer (1) braucht diesen Fallback nicht (arbeitet
nur mit Termin-ID); der Team-App-Aufrufer (2) nutzt ihn, damit auch sehr
alte Buchungen ohne Termin-ID änderbar sind, siehe `team-app/README.md`.

## "Smart Freigeben" — Referenzdaten & Verlauf

**Die Idee:** Klick auf "Freigeben" bei einer Anfrage-Buchung ermittelt,
welche Mitarbeiter:innen zur Geschlechts-Präferenz des Kunden passen, und
zeigt sie im Dashboard zur Auswahl — auch wenn nur eine Person infrage
kommt. Jörg tippt auf eine Option (nach einem kurzen Blick in seinen
eigenen Kalender), der Rest (Kategorie auf "Bestätigt", Dienstleistung auf
die passende "(Bestätigt)"-Variante, Mitarbeiter setzen, freigeben) läuft
automatisch.

Bewusst **kein Cowork/LLM** für die Entscheidungslogik — "passt das
Geschlecht" ist eine reine Ja/Nein-Abfrage auf strukturierten Daten, kein
Sprachverständnis nötig. Gehört in deterministischen Code, läuft dadurch
bei jedem Klick sofort und kostenlos.

**Status:** gebaut und am 23.08.2026 live erfolgreich getestet (Termin
#57 automatisch Dominik zugewiesen, Freigeben hat funktioniert,
Bestätigungsmail raus, Termin korrekt in Amelia/Dominiks Kalender
eingetragen, Uhrzeit stimmte). Routen `/booking-availability` und
`/booking-reassign` in `wpcode-snippet.php`, Dashboard-UI mit
Auswahl-Popup.

### Verworfen: automatische Verfügbarkeitsprüfung gegen Amelias `/slots`

Ursprünglich (21.–23.08.2026) sollte "Freigeben" zusätzlich prüfen,
welche der geschlechtspassenden Kandidat:innen am Termin tatsächlich frei
sind, über Amelias eigenen `/slots`-Endpunkt (derselbe interne AJAX-Call
wie bei den Schreib-Aktionen, siehe unten). Nach mehreren Korrekturrunden
(Selbstblockade durch den gerade bewerteten Termin selbst, dann eine
Breiten-Plausibilitätsprüfung dagegen) zeigte ein Test mit 9
Kandidatinnen am 23.08.2026 den entscheidenden Fund: **Amelias `/slots`
lieferte für jede einzelne Kandidatin exakt dieselbe generische Antwort**
— keine echte, personenbezogene Verfügbarkeitsprüfung, sondern
offensichtlich ein von der angefragten `providerId` unabhängiges Muster.
Ergebnis: alle 9 Kandidatinnen wurden fälschlich als frei gemeldet,
obwohl real nur 2 es waren. Dazu kam die Prüfung durch 9 sequenzielle
externe Requests spürbar langsam daher.

Auf Jörgs Wunsch entfernt (Version 2026-08-23.4) — Details zum
verworfenen Ansatz stehen im Git-Verlauf (Versionen 2026-08-21.6 bis
2026-08-23.3), falls das je wieder aufgegriffen werden soll (z. B. mit
Amelias öffentlichem Buchungsformular als Vergleichsquelle statt des
internen `/slots`-Calls). Smart Freigeben zeigt seither einfach **alle**
zur Geschlechts-Präferenz passenden Kandidat:innen — "System schlägt vor,
Mensch entscheidet" statt automatischer Verfügbarkeitslogik.

### Weiterhin gültige Fixes (betreffen die Schreib-Aktionen)

**Zeitzone (17.08.2026):** Amelia speichert `bookingStart`/`bookingEnd`
in der DB als UTC, die eigene Oberfläche rechnet für die Anzeige auf
Site-Zeitzone (Berlin) um. Fix: `get_date_from_gmt()` in
`st_booking_overview_handler` (Anzeige) und `st_build_reassign_payload_`
(`bookingStart`/`date`/`time` im Zuweisen-Request) — Letzteres am
23.08.2026 live bestätigt (siehe "Status" oben).

**Amelia-Nonce nicht gefunden (behoben 21.08.2026):** Der serverseitige
Abruf von `admin.php?page=wpamelia-bookings` (nötig, um Amelias Sicherheits-
Nonce für die internen Schreib-Aufrufe frisch zu holen) bekam die
WordPress-**Login-Seite** zurück statt der echten Amelia-Seite. Grund:
WordPress schützt `/wp-admin/`-Seiten (auch `admin.php`/`admin-ajax.php`)
mit einem zusätzlichen Auth-Cookie, das der Browser nur an Aufrufe
**innerhalb** `/wp-admin/` schickt (Cookie-Pfad-Beschränkung,
`ADMIN_COOKIE_PATH`). Das Dashboard läuft bewusst außerhalb von
`/wp-admin`, dieser Cookie landet deshalb strukturell nie in `$_COOKIE`.
**Fix:** `st_forward_cookies_()` erzeugt den fehlenden Admin-Cookie jetzt
selbst per `wp_generate_auth_cookie()` für den bereits per
`manage_options` geprüften aktuellen Nutzer — dieselbe WordPress-Funktion,
die auch beim echten Login greift. Kurzlebig (10 Minuten Gültigkeit), da
nur für den einen unmittelbaren Server-zu-Server-Request gebraucht,
nirgends gespeichert.

**Entschieden (23.08.2026): Eva als Backup, Jörg bewusst nicht.** Auf
Nachfrage bestätigt: Ist niemand der regulären Mitarbeiterinnen frei, soll
Eva als Backup zur Auswahl stehen — "die Verfügbarkeitslogik, die der
Kunde sieht, [soll] immer verfügbar [sein], solange irgendein Teammitglied
da ist oder Eva". Sie steht deshalb mit ihrer echten Amelia-ID (2) in
`st_real_providers_()`, wie jede andere Mitarbeiterin auch. Jörg selbst
bleibt bewusst außen vor (eigene Entscheidung vom 21.08.2026) — er merkt
einen fehlenden männlichen Treffer daran, dass die Anfrage auf "Anfrage"
stehen bleibt, und entscheidet dann selbst, ob er den Termin manuell
übernimmt.

**Behoben (23.08.2026): Anfragen/Bestätigt-Filter zeigte falsche Werte.**
Ursache: `isConfirmed()` im Dashboard prüfte bisher, ob `"(bestätigt)"` im
Servicenamen steckt — das erfasst nur die vier extra angelegten
Anfrage/Bestätigt-Servicepaare. Normale Dienstleistungen, die nie über
dieses Namensmuster liefen (z. B. "Körperarbeit (Sexological Bodywork)",
direkt mit einem echten Mitarbeiter gebucht), wurden dadurch fälschlich
als "Anfrage" markiert. **Fix:** `isConfirmed()` prüft jetzt die
`providerId` der Buchung gegen die drei Pseudo-Mitarbeiter (36/37/38) —
dafür liefert `booking-overview` jetzt zusätzlich `provider_id` mit.
Zuverlässiger, weil unabhängig vom jeweiligen Servicenamen.

### Referenzdaten (Stand 17.08.2026, über den "Referenz anzeigen"-Button geholt)

**Kategorien:** 8 = Anfrage, 7 = Bestätigt (weitere Kategorien existieren,
sind für diesen Baustein nicht relevant).

⚠️ **21.08.2026, beim ersten Live-Test gefunden:** Der reale
Dienstleistungskatalog ist größer als hier ursprünglich dokumentiert — z. B.
gibt es "Intuitive Tantramassage" **dreifach** mit eigenen Service-IDs (13
unter Kategorie "Angebote für Männer", 14 unter "Angebote für Frauen", 37
unter "Anfrage"). Eine feste Anfrage→Bestätigt-Tabelle mit nur den vier
"(Anfrage)"-IDs erfasst diese anderen Varianten nicht — ein echter Termin
mit `serviceId 13` schlug deshalb mit `unknown_service_pairing` fehl.

**Fix:** `st_confirmed_service_id_()` sucht das "(Bestätigt)"-Gegenstück
jetzt live per Namens-/Dauer-Abgleich in der DB (Basisname ohne
"(Anfrage)"-Suffix, gleiche Dauer, Kategorie 7) statt über eine feste
ID-Tabelle — dadurch werden automatisch auch die Varianten unter "Angebote
für Männer"/"Angebote für Frauen"/"Zu Zweit" erkannt, sofern Name und Dauer
zum Bestätigt-Duplikat passen. Kein Gegenstück gefunden → bewusst Fehler
(`unknown_service_pairing`) statt Raten. Bekannte Fälle, die dadurch
**nicht** Smart-Freigeben-fähig sind (kein passendes Bestätigt-Duplikat):
Bodyflow-Massage, Körperarbeit, sowie "Intuitive Tantramassage" unter
"Angebote für Frauen" (ID 14, 7200s — die einzige "Bestätigt"-Variante hat
5400s, passt nicht). Falls Letzteres eigentlich auch automatisiert laufen
soll, bei Jörg nachfragen, ob da eine Dauer-Inkonsistenz im
Amelia-Katalog vorliegt.

Vollständige Dienstleistungsliste (Stand 21.08.2026, zur Nachvollziehbarkeit
statt einer gekürzten Anfrage/Bestätigt-Tabelle):

| ID | Name | Kategorie | Dauer |
|---|---|---|---|
| 19 | Bodyflow-Massage | Angebote für Männer (3) | 3600s |
| 31 | Bodyflow-Massage | Angebote für Frauen (4) | 3600s |
| 22 | Frauen-Heilmassage | Angebote für Frauen (4) | 7200s |
| 39 | Frauen-Heilmassage (Anfrage) | Anfrage (8) | 7200s |
| 35 | Frauen-Heilmassage (Bestätigt) | Bestätigt (7) | 7200s |
| 17 | Intimmassage Workshop | Angebote für Männer (3) | 12600s |
| 21 | Intimmassage Workshop | Zu Zweit (5) | 12600s |
| 30 | Intimmassage Workshop | Angebote für Frauen (4) | 12600s |
| 38 | Intimmassage Workshop (Anfrage) | Anfrage (8) | 12600s |
| 34 | Intimmassage Workshop (Bestätigt) | Bestätigt (7) | 12600s |
| 13 | Intuitive Tantramassage | Angebote für Männer (3) | 5400s |
| 14 | Intuitive Tantramassage | Angebote für Frauen (4) | 7200s |
| 37 | Intuitive Tantramassage (Anfrage) | Anfrage (8) | 5400s |
| 33 | Intuitive Tantramassage (Bestätigt) | Bestätigt (7) | 5400s |
| 16 | Intuitive Tantramassage für Paare | Zu Zweit (5) | 5400s |
| 23/25/32 | Körperarbeit (Sexological Bodywork) | Männer/Zu Zweit/Frauen (3/5/4) | 9000s |
| 28 | Körperorientiertes Coaching einzeln | Coaching & Begleitung (6) | 5400s |
| 29 | Körperorientiertes Coaching zu zweit | Coaching & Begleitung (6) | 7200s |
| 11/12 | kostenloses Kennenlern-Gespräch (mit Eva) | Kennenlern-Gespräch (2) | 1800s |
| 15 | Ritual zu Dritt | Zu Zweit (5) | 7200s |
| 40 | Ritual zu Dritt (Anfrage) | Anfrage (8) | 7200s |
| 36 | Ritual zu Dritt (Bestätigt) | Bestätigt (7) | 7200s |
| 27 | Somatic Experiencing (SE) ® | Coaching & Begleitung (6) | 5400s |
| 26 | Tantramassage lernen für Paare | Zu Zweit (5) | 14400s |

**Die drei Geschlechts-Pseudo-Mitarbeiter** (das wählt der Kunde tatsächlich
im Buchungsformular, landet als `providerId` auf dem Termin) — am
21.08.2026 gegen die echte Referenz erneut geprüft, IDs unverändert
korrekt:

| providerId | Bedeutung |
|---|---|
| 38 | Geschlecht egal |
| 37 | männliche Begleitung gewünscht |
| 36 | weibliche Begleitung gewünscht |

Es gibt daneben noch weitere Pseudo-Mitarbeiter in Amelia, die **keine**
Geschlechts-Präferenz sind (39 "andere Begleitung anfragen", 40 "Blind
Date") — landet so ein Termin im Dashboard bei "Freigeben", liefert
`st_gender_preference_()` bewusst `null` und die Route
`unknown_gender_pseudo_provider` statt zu raten; Jörg weist dann manuell in
Amelia zu.

**Echte Mitarbeiter für die Anfrage-Zuweisung** (Amelia-ID, Geschlecht laut
Jörg 17.08.2026, IDs am 21.08.2026 gegen die echte Referenz erneut
geprüft und unverändert — alle außer Jörg, der hat einen eigenen festen
Buchungsweg (siehe Entscheidung 21.08.2026 oben) und bleibt bewusst
außerhalb der Automatik. Eva am 23.08.2026 als Backup für "weiblich"
ergänzt, siehe Entscheidung oben — läuft technisch genau wie die anderen,
nur eben zusätzlich, nicht exklusiv:

| Name | Amelia-ID | Geschlecht |
|---|---|---|
| Tara | 4 | weiblich |
| Asmita | 5 | weiblich |
| Alea | 6 | weiblich |
| Stephanie | 7 | weiblich |
| Karen | 8 | weiblich |
| Sarah | 9 | weiblich |
| Maxine | 17 | weiblich |
| Amila | 28 | weiblich |
| Dominik | 29 | männlich |
| Eva | 2 | weiblich (Backup, seit 23.08.2026) |

⚠️ **Offen:** Konstantin taucht in der Amelia-Mitarbeiterliste nicht auf
(9 statt 10 Personen aus dem Verfügbarkeits-Sync). Vor dem Bauen bei Jörg
nachfragen, ob er in Amelia noch angelegt werden muss oder ob er bewusst
nicht Teil der Anfrage-Zuweisung sein soll.

### Payload-Form für die Zuweisung (aus dem DevTools-Mitschnitt vom 16.08. bekannt)

Der "Aktualisieren"-Request (`POST admin-ajax.php?action=wpamelia_api&call=
/appointments/{id}`) erwartet das **komplette** Termin-Objekt zurück, z. B.:

```json
{
  "bookings": [{"coupon": {"id": null}, "customerId": 23, "customFields": {...}, "duration": 5400, "extras": [], "id": 64, "packageCustomerService": null, "persons": 1, "status": "pending"}],
  "bookingStart": "2026-08-19 10:00:00",
  "categoryId": 7,
  "date": "2026-08-19",
  "id": 38,
  "internalNotes": "",
  "lessonSpace": false,
  "locationId": 11,
  "notifyParticipants": 1,
  "providerId": 17,
  "recurring": [],
  "removedBookings": [],
  "serviceId": 33,
  "time": "10:00",
  "createPaymentLinks": true
}
```

**Wichtige Erkenntnis:** Alle diese Felder (außer `categoryId`, `serviceId`,
`providerId`, die geändert werden sollen) lassen sich vermutlich direkt aus
der Datenbank lesen — dieselbe Erweiterung der `booking-overview`-SQL-Abfrage
(zusätzlich `customerId`, `duration`, `persons`, `internalNotes`,
`locationId`, `couponId`, die JSON-Spalte `customFields` roh übernehmen,
`bookingStart` in Datum/Uhrzeit aufteilen). Damit entfällt vermutlich ein
weiterer DevTools-Mitschnitt (Fetch-vor-dem-Ändern) — nur beim ersten Test
genau prüfen, ob wirklich alle Felder korrekt befüllt sind, bevor das an
einer echten Buchung ausprobiert wird.

### Bauplan (Stand: gebaut, live getestet, vereinfacht)

1. ✅ Statt die `booking-overview`-Liste zu erweitern (würde bei jedem
   Dashboard-Laden interne Felder wie `customFields`/`internalNotes`/Coupon
   für alle sichtbaren Buchungen mitschicken, siehe "Sicherheit"), holt eine
   neue, engere Abfrage (`st_fetch_appointment_raw_()`) die Rohfelder nur für
   die eine Buchung, die gerade freigegeben/zugewiesen wird.
2. ✅ Neue Route `POST /booking-reassign` (`{appointmentId, providerId}`):
   baut daraus das komplette Payload-Objekt (Rest aus der DB-Zeile), setzt
   `categoryId` fest auf 7 und `serviceId` auf das zur aktuellen
   Dienstleistung passende Bestätigt-Pendant (Tabelle oben), ruft
   `st_amelia_ajax_call_('POST', '/appointments/' . $id, [], $payload)`.
3. ✅ Route `GET /booking-availability` (`?appointmentId=`): liefert die zur
   Geschlechts-Präferenz passenden Kandidat:innen (per
   `st_gender_preference_()` + `st_candidate_providers_()`). Enthielt
   zwischenzeitlich (21.–23.08.2026) zusätzlich eine Prüfung gegen Amelias
   `/slots`-Endpunkt, ob die jeweilige Person am Termin frei ist — auf
   Jörgs Wunsch wieder entfernt, siehe Abschnitt "Verworfen: automatische
   Verfügbarkeitsprüfung" oben.
4. ✅ Dashboard-UI: "Freigeben" bei einer Anfrage-Buchung (erkannt an der
   `providerId`, siehe "Anfragen/Bestätigt-Filter"-Fix oben) zeigt immer
   die Kandidat:innen-Auswahl, auch bei nur einer Person — Jörg wählt
   manuell aus, danach laufen Zuweisung (`/booking-reassign`) und Freigabe
   (`/booking-approve`) automatisch. Bereits "(bestätigt)"-Buchungen laufen
   weiter über die alte Direkt-Freigeben-Route.
