# Dispatch – Amelia-Termine per Chat anlegen (für unterwegs)

Dieses Dokument ist bewusst eigenständig: Du kannst es kopieren und in
eine beliebige Claude-Code-Sitzung mit Internetzugriff einfügen (auch ohne
dieses Repo geöffnet zu haben) — die Amelia-Bridge läuft auf
spiritual-touch.de, nicht in diesem Repo. Praktisch z. B. als
Custom-Instructions in einem eigenen Claude-Project "Dispatch", oder
einfach als erste Nachricht in einer neuen Claude-Code-Sitzung auf dem
Handy.

## Voraussetzung

Braucht eine Claude-Sitzung mit echtem Werkzeug-/Internetzugriff, die
selbst HTTP-Anfragen schicken kann — **Claude Code** (auch im
Handy-Browser unter claude.ai/code), nicht ein normaler claude.ai-Chat
ohne Werkzeuge. Ohne das kann Claude dir nur sagen, was zu tun wäre, es
aber nicht selbst ausführen.

## So sagst du es

Eine Nachricht, alles was du weißt, in natürlicher Sprache:

> Dispatch: [Dienstleistung] (ggf. Dauer) bei [Mitarbeiter:in], [Datum]
> [Uhrzeit], Kunde [Vorname Nachname], Tel [Telefon], Mail [E-Mail].
> [Optional: "gib gleich frei" oder "gib frei und kopiere in Raum 1/2/3"]

Beispiel:
> Dispatch: Intuitive Tantramassage 2 Std. bei Stephanie, 22.09. 18 Uhr,
> Kunde Tim Metzger, Tel +49 151 234, Mail tim@example.com. Gib gleich
> frei.

Für die Freigabe reicht später auch eine kurze zweite Nachricht, z. B.
"passt, gib Termin 123 frei und kopiere in Raum 2" — dann läuft nur
Schritt 3 unten.

## Was für den Dispatch zwingend gebraucht wird

- Dienstleistung, ggf. mit Dauer (manche Leistungen haben mehrere
  Dauer/Preis-Varianten — z. B. ist "2 Stunden" oft eine Variante
  *derselben* Dienstleistung, keine eigene. Claude löst das über die
  Referenzliste auf, fragt bei Unklarheit lieber kurz nach statt zu
  raten.)
- Mitarbeiter:in (Name reicht)
- Datum + Uhrzeit
- Kundendaten: Vorname, Nachname, **E-Mail** (zwingend — siehe
  Einschränkung unten), Telefon (optional, aber sinnvoll)
- Soll sofort freigegeben werden, oder erstmal nur als Anfrage anlegen
  (ohne ausdrückliches "gib frei" wird nur angelegt — kein Risiko einer
  ungewollten Kundenmail)

Fehlt etwas davon, fragt Claude kurz nach, statt zu raten.

## ⚠️ Aktuelle Einschränkung: nur für bereits existierende Kunden

Der Kunde muss in Amelia schon existieren (wird über die E-Mail
gefunden). Ein wirklich neuer Kunde kann über Dispatch noch **nicht**
automatisch angelegt werden — Amelia wirft dabei einen eigenen,
noch ungelösten Fehler (Stand 18.09.2026). Bei einem neuen Kunden:
entweder kurz selbst in Amelia anlegen (Kunden → Neuer Kunde, gleiche
E-Mail) und Dispatch danach wiederholen, oder Claude Bescheid sagen —
dann wird nichts angelegt, sondern nur gemeldet, dass der Kunde fehlt.
(Eine automatische Lösung dafür ist offen, siehe
`wordpress/buchungs-dashboard/README.md`, Abschnitt "Dispatch".)

## Ablauf, den Claude automatisch ausführt

1. **IDs auflösen:**
   `GET https://spiritual-touch.de/wp-json/st/v1/amelia-reference`
   (Header `X-ST-Dispatch-Secret: <dein Secret>`) — liefert Kategorien,
   Dienstleistungen (inkl. `durationOptions` für Dauer/Preis-Varianten)
   und Mitarbeiter:innen mit echten Amelia-IDs.
2. **Anfrage anlegen:**
   `POST https://spiritual-touch.de/wp-json/st/v1/booking-dispatch`
   (gleicher Header) mit Body:
   ```json
   {
     "serviceId": 33,
     "providerId": 7,
     "date": "2026-09-25",
     "time": "14:00",
     "durationSeconds": 7200,
     "customer": {"firstName": "...", "lastName": "...", "email": "...", "phone": "..."},
     "status": "pending"
   }
   ```
   `status` weglassen oder `"pending"` = nur anlegen; `"approved"` nur bei
   ausdrücklichem "gib gleich frei". Antwort enthält `appointmentId`.
3. **Freigeben** (sofort mit Schritt 2 kombiniert, oder als spätere
   eigene Nachricht mit der gemeldeten `appointmentId`):
   `POST https://spiritual-touch.de/wp-json/st/v1/booking-dispatch-confirm`
   mit `{"appointmentId": 123, "room": 2}` — `room` optional (1/2/3),
   kopiert zusätzlich in einen Raumkalender (reiner Google-Calendar-
   Schritt, kein Amelia-Feld).
4. Claude bestätigt kurz mit Termin-Nummer und Status, oder meldet den
   genauen Fehler (die Antworten enthalten gezielte Diagnosedaten) statt
   zu raten oder es einfach anders nochmal zu versuchen.

## Dein Secret

`X-ST-Dispatch-Secret` steht absichtlich nicht in diesem Dokument, wie es
im Repo liegt (Sicherheit — Git-Historie ist praktisch unlöschbar). Wenn
du dir eine private Kopie dieses Dokuments anlegst (Notizen-App,
Passwort-Manager, eigenes Claude-Project), kannst DU dort deinen aktuellen
Wert eintragen, weil das nur dir gehört — trag ihn aber nie in eine Kopie
ein, die zurück in dieses Git-Repo committet wird.

X-ST-Dispatch-Secret: ______________________________

## Vollständige Doku / Stand der Live-Tests

`wordpress/buchungs-dashboard/README.md`, Abschnitt "Dispatch" — dort
stehen Details, Beispiel-Antworten und was beim ersten Live-Test
(Termin #116, 18.09.2026) gefunden und behoben wurde.
