# Ein-Klick-Terminbestätigung

Ursprünglich mit Gemini gebaut (16./17.08.2026): Kunde bekommt vom Admin eine
Mail mit einem Bestätigungslink (`.../danke-bestaetigt/?confirm_booking={id}`).
Klickt der Kunde, passiert automatisch: Status in Amelia auf "Freigegeben",
Termin in den Raumkalender (Google) eintragen, ICS-Bestätigungsmail mit
Anhang an den Kunden (BCC an die Praxis), Redirect auf die Dankeseite.

**Deployment:** Ersetzt den Inhalt des bestehenden WPCode-Snippets für diese
Funktion 1:1 durch `wpcode-snippet.php` aus diesem Ordner.

## Was repariert wurde (17.08.2026)

**Der eigentliche Bug — Raumkalender-Sync tat nichts:**
`wp_remote_get($request_url, ['timeout' => 15, 'blocking' => false])` —
`blocking => false` lässt WordPress nicht auf die Antwort warten und bricht
die Verbindung intern fast sofort ab (der `timeout`-Wert wird dabei praktisch
ignoriert). Ein HTTPS-Request zu `script.google.com` braucht für den
TLS-Handshake fast immer länger als dieses interne Mini-Fenster — der
Request kam höchstwahrscheinlich nie vollständig bei Google an. Fix: kein
`blocking => false` mehr (Standard ist warten), Antwort/Fehler wird jetzt
mit `error_log()` sichtbar gemacht statt lautlos verworfen. Falls jetzt
noch etwas hakt, steht die genaue Ursache (WordPress-seitiger Fehler oder
Apps-Script-eigene "Fehler: ..."-Antwort) im WordPress-Error-Log.

**Zweiter Fund — keine Absicherung des Links:**
`?confirm_booking={id}` allein ist eine erratbare, fortlaufende Zahl ohne
jede Prüfung, ob der Klickende der richtige Kunde ist. Ergänzt (standardmäßig
**aus**, siehe Kommentar im Code, `ST_CONFIRM_REQUIRE_EMAIL_MATCH`): ein
optionaler `&email=...`-Parameter, der mit der hinterlegten Kunden-Mail
abgeglichen wird. Aktivieren in zwei Schritten:
1. In Amelia bei der Vorlage/Mail mit diesem Link: Text um
   `&email=%customer_email%` ergänzen (reine Textänderung, kein Code).
2. Im Snippet `ST_CONFIRM_REQUIRE_EMAIL_MATCH` von `false` auf `true` setzen.

Bis dahin läuft alles wie bisher; kommt ein falscher `email`-Parameter mit,
wird das nur geloggt, nichts wird blockiert.

## Bewusst nicht verändert

- **Rohes SQL-Status-Update statt Amelias eigenem internen Endpunkt.** Es
  gäbe den sichereren Weg (wie beim "Freigeben"-Button im
  Buchungs-Dashboard: Amelias eigenen `/appointments/status/{id}`-Endpunkt
  aufrufen, damit native Mail/Kalender-Sync/Webhooks korrekt mitlaufen).
  Der Unterschied: dort klickt ein eingeloggter Admin, hier ein Kunde ganz
  ohne Session — der echte Endpunkt bräuchte eine serverseitig erzeugte,
  kurzlebige Admin-Session für diesen einen Aufruf. Größerer, separater
  Umbau, hier bewusst nicht angefasst, um den bestehenden Ansatz erstmal
  lauffähig zu machen.
- Mail-Text, ICS-Aufbau, Ablauf: unverändert aus der Gemini-Version
  übernommen (fachlich korrekt, nur der Versand-Bug betraf ausschließlich
  den Kalender-Teil).
- Die Platzhalter `DEINE_NEUE_GOOGLE_URL_HIER` und `DEIN_LOGO.png` sind
  unverändert — die trägt Jörg selbst ein.

## Falls der Kalender-Sync nach dem Fix immer noch nicht klappt

Jetzt steht die Ursache im WordPress-Error-Log (Server-Log bzw. per
Debug-Log-Plugin einsehbar) — Suchbegriff `ST Raumkalender-Sync`. Zusätzlich
lohnt sich ein Blick in die **Ausführungen/Executions** des Google Apps
Script im Skript-Dashboard: taucht der Aufruf dort inzwischen auf, kam er an
und das Problem liegt im Skript selbst (z. B. Datums-Format, Kalender-
Berechtigung); taucht dort nichts auf, liegt es weiterhin an der Zustellung
(Firewall, SSL, falsche Web-App-URL).
