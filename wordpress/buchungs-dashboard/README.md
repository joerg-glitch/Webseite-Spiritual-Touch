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

## Nächster Schritt: Kategorie/Dienstleistung/Mitarbeiter direkt im Dashboard ändern

Noch nicht gebaut, weil beim "Aktualisieren"-Request das **komplette**
Termin-Objekt zurückgeschickt werden muss — inklusive aller Felder, die
gar nicht geändert werden (Kundendaten, Freitext-Nachricht, Coupon,
Zusatzoptionen, Uhrzeit, Notiz-Feld usw.). Woher diese Werte für einen noch
unbekannten, beliebigen Termin nehmen? Zwei Möglichkeiten:

1. Es gibt einen eigenen Request, der beim Öffnen einer Buchung zum
   Bearbeiten den vollständigen Termin lädt (bevor irgendetwas geändert
   wird) — genau der fehlt im bisherigen Mitschnitt, vermutlich weil die
   Aufnahme erst mittendrin gestartet wurde.
2. Falls es diesen nicht gibt: die Liste, mit der die komplette
   Bookings-Seite beim Laden befüllt wird, enthält vermutlich schon alle
   Termine vollständig — dann reicht der allererste Request beim
   Seitenaufruf.

**Deshalb noch einmal ca. 5 Minuten, diesmal von Anfang an mitschneiden:**

1. In Chrome/Safari die Amelia-Bookings-Seite (Amelia → Bookings)
   **schließen**, falls offen.
2. DevTools öffnen (Rechtsklick → "Untersuchen"/"Inspect"), Reiter
   **Netzwerk/Network**, Filter auf **Fetch/XHR**, Netzwerk-Liste leeren
   (🚫-Symbol).
3. **Erst jetzt** die Amelia-Bookings-Seite neu laden/öffnen.
4. Die Buchung anklicken, die geändert werden soll, direkt ihr Bearbeiten-
   Fenster öffnen — **noch nichts ändern**.
5. Alle bis hierhin aufgetauchten Fetch/XHR-Requests durchgehen und die
   herauskopieren (Rechtsklick → "Copy as cURL"), deren URL `/appointments`
   oder `/bookings` enthält (nicht `/slots`, `/coupons` — die kennen wir
   schon). Am besten alle mitschicken, die in Frage kommen — lieber zu viel
   als zu wenig.
6. Danach wie beim letzten Mal Kategorie, Dienstleistung und Mitarbeiter
   ändern und speichern, den dabei auftauchenden "Aktualisieren"-Request
   nochmal mitschicken (zur Bestätigung, dass er identisch zum vorherigen
   Mitschnitt ist).

⚠️ Bitte die cURL-Befehle wie letztes Mal in ein Dokument kopieren und mir
so schicken — aber denk daran: die enthaltenen Cookie-/Token-Werte sind
live gültig, siehe Sicherheitshinweis oben. Sobald ich die Requests habe,
baue ich eine "Fetch aktuellen Termin → nur Kategorie/Service/Mitarbeiter
ändern → zurückschicken"-Aktion plus Dropdowns im Dashboard.
