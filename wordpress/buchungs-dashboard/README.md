# ST Buchungs-Dashboard

Mobile Lese-Übersicht über anstehende Amelia-Buchungen — für unterwegs, ohne
Amelia-Plan-Upgrade (Elite) und ohne Umweg über Gmail.

## Was es tut und was bewusst nicht

- Zeigt alle Buchungen der nächsten 30 Tage (Zeit, Service, Mitarbeiter,
  Kunde, Telefon, Status) als mobil-optimierte Kartenliste, sortiert nach
  Datum. "Ausstehend" ist farblich hervorgehoben.
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

- Freigabe-Aktion direkt im Dashboard (Status setzen), statt nur Deep-Link zu
  Amelia. Voraussetzung dafür: einmal in Chrome DevTools → Netzwerk-Tab
  beobachten, welchen internen Request Amelias eigene Oberfläche beim Klick
  auf "Freigeben" tatsächlich schickt, damit der Proxy exakt denselben Weg
  nachbildet (inkl. Benachrichtigungen/Kalender-Sync) statt nur den
  Datenbank-Status zu ändern.
- Push-Benachrichtigung bei neuer Buchung (derzeit: Dashboard muss aktiv
  geöffnet werden, kein automatischer Alert).
