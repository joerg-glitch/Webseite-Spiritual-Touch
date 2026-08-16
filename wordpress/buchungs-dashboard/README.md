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
- **Ändert nichts an Buchungen.** Die Freigabe ("Ausstehend" → "Freigegeben")
  bleibt bewusst in Amelia selbst — das Dashboard verlinkt nur dorthin. Grund:
  Der Freigabe-Klick in Amelia löst automatisch Bestätigungsmail,
  Google-Kalender-Eintrag und Zahlungsstatus-Folgeaktionen aus. Ein
  Nachbau dieser Aktion außerhalb von Amelia würde riskieren, dass genau
  diese Kette lautlos bricht — das wäre bei einer echten Kundenbuchung ein
  teurer Fehler. Wenn sich das Dashboard bewährt, kann eine Freigabe-Aktion
  als nächster, separater Schritt ergänzt werden (siehe unten).

## Sicherheit

Buchungsdaten enthalten Namen, Telefonnummern und Angebotsart — sensibler als
die reine Verfügbarkeitsanzeige der anderen Bausteine in diesem Projekt.
Deshalb bewusst **kein** statisches Secret-Token (wie beim Team-App-Proxy),
sondern echte WordPress-Anmeldung:

- Der Shortcode `[st_booking_dashboard]` rendert nur etwas, wenn der
  aufrufende Nutzer eingeloggt ist und `manage_options` hat (Admin).
- Die REST-Route `/wp-json/st/v1/booking-overview` prüft dieselbe Berechtigung
  serverseitig, unabhängig vom Shortcode, und verlangt einen gültigen
  WordPress-REST-Nonce (`X-WP-Nonce`-Header). Ohne aktive, eingeloggte
  Session gibt es keine Daten — auch nicht, wenn jemand die REST-URL direkt
  aufruft.

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

## Nächster Schritt: Freigeben + Kategorie/Dienstleistung/Mitarbeiter direkt im Dashboard ändern

Gewünscht, aber bewusst noch nicht gebaut — dafür wird eine Schreib-Aktion
gegen Amelia gebraucht (Status setzen, Service wechseln, Mitarbeiter setzen),
und die soll **nicht** per rohem Datenbank-UPDATE nachgebaut werden. Grund:
Amelias eigene Oberfläche löst bei diesen drei Aktionen automatisch
Bestätigungsmails, Google-Kalender-Sync und ggf. Preis-/Paket-Neuberechnung
aus. Ein rohes SQL-UPDATE auf `serviceId`/`providerId`/`status` würde diese
Kette umgehen — das fällt im Zweifel erst auf, wenn ein Kunde keine Mail
bekommen hat.

**Sicherer Weg:** Den echten internen Request nachbilden, den Amelias eigene
Oberfläche beim Klick auf "Freigeben" bzw. beim Ändern von Service/Mitarbeiter
tatsächlich verschickt — dann läuft die komplette Amelia-Logik automatisch
mit, der Proxy schickt nur denselben Request stellvertretend fürs Dashboard.

**Dafür einmalig nötig (ca. 10 Minuten):** In Chrome (oder Safari) am
Rechner, im wp-admin bei Amelia → Bookings, mit den DevTools mitschneiden:

1. DevTools öffnen (Rechtsklick auf die Seite → "Untersuchen" bzw.
   "Inspect"), oben den Reiter **Netzwerk / Network** wählen.
2. Filter oben im Netzwerk-Tab auf **Fetch/XHR** stellen (blendet Bilder/CSS
   etc. aus, nur die relevanten Anfragen bleiben übrig).
3. Eine bestehende Test-Buchung nehmen (oder eine Testbuchung anlegen) und
   nacheinander diese drei Aktionen jeweils **einzeln** ausführen, direkt
   danach in der Netzwerk-Liste den **neu aufgetauchten Request anklicken**,
   Rechtsklick → **"Copy as cURL"**, und mir den Text schicken:
   - a) Status von "Ausstehend" auf "Freigegeben" setzen
   - b) Die Dienstleistung der Buchung ändern (z. B. auf die
     "(bestätigt)"-Variante)
   - c) Den Mitarbeiter der Buchung ändern
4. Zwischen den drei Aktionen jeweils kurz warten, damit die Requests nicht
   durcheinandergeraten — am einfachsten: Netzwerk-Liste vor jeder Aktion
   mit dem 🚫-Symbol oben links leeren ("Clear").

Sobald ich die drei cURL-Kommandos habe, baue ich den Proxy so, dass er
exakt diese Requests serverseitig nachschickt (mit gültigem WP-Nonce/Cookie),
und ergänze im Dashboard je Buchung Dropdowns für Kategorie/Dienstleistung/
Mitarbeiter plus einen "Bestätigen & Freigeben"-Button.
