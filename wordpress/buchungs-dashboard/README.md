# ST Buchungs-Dashboard

Mobile Lese-Übersicht über anstehende Amelia-Buchungen — für unterwegs, ohne
Amelia-Plan-Upgrade (Elite) und ohne Umweg über Gmail.

## Was es tut und was bewusst nicht

- Zeigt alle Buchungen der nächsten 30 Tage (Zeit, Service, Mitarbeiter,
  Kunde, Telefon, Status) als mobil-optimierte Kartenliste, sortiert nach
  Datum. "Ausstehend" ist farblich hervorgehoben.
- Filter "Alle / Anfragen / Bestätigt": erkennt an "(bestätigt)" im
  Service-Namen, ob eine Buchung noch beim Anfrage-Platzhalter
  ("Individuelle Anfrage") hängt oder schon auf das (bestätigt)-Duplikat mit
  echtem Mitarbeiter umgehängt wurde — passend zu Jörgs Kategorie-Mechanik
  (versteckte Kategorie "Bestätigt" mit einem Duplikat pro Dienstleistung,
  allen Mitarbeitern zugeordnet, damit im Nachhinein ein freier Mitarbeiter
  eingesetzt werden kann). Rein clientseitig, kein zusätzlicher Request.
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
- **Kategorie/Dienstleistung/Mitarbeiter ändern:** noch nicht gebaut, siehe
  Abschnitt "Nächster Schritt" unten — dafür fehlt noch eine Information.

## Sicherheit

Buchungsdaten enthalten Namen, Telefonnummern und Angebotsart — sensibler als
die reine Verfügbarkeitsanzeige der anderen Bausteine in diesem Projekt.
Deshalb bewusst **kein** statisches Secret-Token (wie beim Team-App-Proxy),
sondern echte WordPress-Anmeldung:

- Der Shortcode `[st_booking_dashboard]` rendert nur etwas, wenn der
  aufrufende Nutzer eingeloggt ist und `manage_options` hat (Admin).
- Jede REST-Route (`booking-overview`, `booking-approve`,
  `amelia-bootstrap-debug`) prüft dieselbe Berechtigung serverseitig,
  unabhängig vom Shortcode, und verlangt einen gültigen WordPress-REST-Nonce
  (`X-WP-Nonce`-Header). Ohne aktive, eingeloggte Session gibt es keine
  Daten und keine Aktion — auch nicht, wenn jemand die REST-URL direkt
  aufruft.
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

## Nächster Schritt: "Smart Freigeben" (17.08.2026, Jörgs Idee)

**Die Idee:** Klick auf "Freigeben" bei einer Anfrage-Buchung löst nicht
mehr sofort die Freigabe aus, sondern erst eine Prüfung: welche der
Mitarbeiter, die zur gewählten Geschlechts-Präferenz des Kunden passen,
sind am Termin-Datum laut Amelia tatsächlich frei? Bei genau einem Treffer
sofort automatisch zuweisen und freigeben. Bei mehreren ein Auswahl-Popup
im Dashboard, Jörg tippt auf eine Option, der Rest (Kategorie auf
"Bestätigt", Dienstleistung auf die passende "(Bestätigt)"-Variante,
Mitarbeiter setzen, freigeben) läuft automatisch. Bei null Treffern:
Meldung statt Aktion, Jörg entscheidet manuell.

Bewusst **kein Cowork/LLM** für die Entscheidungslogik — "wer ist frei"
und "passt das Geschlecht" sind reine Ja/Nein-Abfragen auf strukturierten
Daten, kein Sprachverständnis nötig. Gehört in deterministischen Code,
läuft dadurch bei jedem Klick sofort und kostenlos.

### Referenzdaten (Stand 17.08.2026, über den "Referenz anzeigen"-Button geholt)

**Kategorien:** 8 = Anfrage, 7 = Bestätigt (weitere Kategorien existieren,
sind für diesen Baustein nicht relevant).

**Anfrage → Bestätigt Service-Paare** (per Namensmuster erkennbar, gleiche
Dauer in beiden):

| Basis-Dienstleistung | Anfrage-ID | Bestätigt-ID | Dauer |
|---|---|---|---|
| Intuitive Tantramassage | 37 | 33 | 5400s |
| Frauen-Heilmassage | 39 | 35 | 7200s |
| Intimmassage Workshop | 38 | 34 | 12600s |
| Ritual zu Dritt | 40 | 36 | 7200s |

**Die drei Geschlechts-Pseudo-Mitarbeiter** (das wählt der Kunde tatsächlich
im Buchungsformular, landet als `providerId` auf dem Termin):

| providerId | Bedeutung |
|---|---|
| 38 | Geschlecht egal |
| 37 | männliche Begleitung gewünscht |
| 36 | weibliche Begleitung gewünscht |

**Echte Mitarbeiter für die Anfrage-Zuweisung** (Amelia-ID, Geschlecht laut
Jörg 17.08.2026 — alle außer Jörg & Eva, die haben eigene feste
Buchungswege, siehe auch `apps-script/anfragen-verfuegbarkeit-sync`):

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

### Bauplan

1. `booking-overview`-SQL um die oben genannten Rohfelder erweitern.
2. Neue Route `POST /booking-reassign` (`{appointmentId, providerId}`):
   baut daraus das komplette Payload-Objekt (Rest aus der DB-Zeile), setzt
   `categoryId` fest auf 7 und `serviceId` auf das zur aktuellen
   Dienstleistung passende Bestätigt-Pendant (Tabelle oben, oder per
   Namensmuster "X (Anfrage)" → "X (Bestätigt)" auflösen), ruft
   `st_amelia_ajax_call_('POST', '/appointments/' . $id, [], $payload)`.
3. Neue Route, die für eine Liste von Kandidaten-Mitarbeitern Amelias
   eigenen `/slots`-Endpunkt abfragt (Tagesbereich um den Termin,
   `serviceId` = Bestätigt-Pendant, `providerIds` = Kandidat,
   `serviceDuration` = Dienstleistungsdauer) und prüft, ob die exakte
   Startzeit des Termins in der Ergebnisliste auftaucht — dieselbe Abfrage,
   die Amelias eigene Oberfläche beim Dropdown-Wechsel selbst auslöst
   (siehe `/slots`-Beispiel im DevTools-Mitschnitt vom 16.08.).
4. Dashboard-UI: "Freigeben" bei einer Anfrage-Buchung löst zuerst den
   Verfügbarkeits-Check aus statt direkt freizugeben — 1 Treffer: sofort
   zuweisen + freigeben (bestehende `/booking-approve`-Route danach
   aufrufen). Mehrere Treffer: Auswahl-Popup mit Namen. Null Treffer:
   Meldung, keine Aktion.
