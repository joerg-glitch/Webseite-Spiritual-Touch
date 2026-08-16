# Anfragen-Verfügbarkeits-Sync

Eigenständiges Google-Apps-Script-Projekt. Hält den Kalender
`anfragen@spiritual-touch.de` aktuell, den der Amelia-Mitarbeiter
"Nur auf Anfrage" nutzt.

## Was es tut

Ein Gast, der über "Nur auf Anfrage" bucht, soll sehen **wann die Praxis
überhaupt buchbar ist** — nicht, wer konkret verfügbar ist. Das Skript:

1. Liest für die nächsten `SYNC_DAYS_AHEAD` Tage (aktuell 60, live von
   Jörg getestet) die persönlichen Google-Kalender aller Teammitglieder
   außer Jörg (Liste in `Code.gs`, `TEAM_CALENDARS`) — inklusive Eva,
   deren privater Kalender ihre Verfügbarkeit direkt regelt: ist sie dort
   nicht blockiert, zählt das als zusätzliche Verfügbarkeit.
2. Prüft in 30-Minuten-Schritten (09:00–23:00 Uhr), ob **mindestens ein**
   Mitglied frei ist.
3. Trägt auf `anfragen@` eine Blockierung ("Blockiert (Anfragen-Sync)")
   für jeden Zeitraum ein, in dem **niemand** frei ist. Übrig bleiben nur
   die Zeitfenster, in denen die Praxis grundsätzlich buchbar ist.
4. Löscht bei jedem Lauf zuerst alle selbst erzeugten Blockierungen
   (erkennbar an der Beschreibung `kind:anfragen-sync`) und schreibt sie
   neu — idempotent, kein manuelles Aufräumen nötig. Von Jörg manuell auf
   `anfragen@` angelegte Termine werden nie angerührt.

## Warum getrennt vom bestehenden Verfügbarkeit-Sync

Der bisherige Ablauf (Team-App → Kalender "Verfügbarkeit" →
"Blockiert (Verfügbarkeit-Sync)" auf den persönlichen Kalendern der
Mitglieder) läuft unverändert weiter und wird von diesem Skript nur
**gelesen**, nie geschrieben. Dieses Skript ist ein eigenes Apps-Script-
Projekt, damit es jederzeit ersetzt, geändert oder abgeschaltet werden
kann, ohne den bestehenden Sync oder Amelia anzufassen — passend zur
bereits etablierten Konvention "ein Prozess = ein eigenes Apps-Script-
Projekt" (siehe Notion, "Buchungssystem — Übergabe & Dokumentation").

## Deployment

1. Neues Projekt unter [script.google.com](https://script.google.com)
   anlegen (mit dem Konto `joerg@spiritual-touch.de` — hat Owner-Zugriff
   auf alle unten aufgeführten Kalender).
2. `Code.gs` aus diesem Ordner einfügen.
3. Projekteinstellungen → `appsscript.json` Inhalt übernehmen (Zeitzone
   Europe/Berlin, V8-Runtime).
4. Einmal manuell die Funktion `syncAnfragenVerfuegbarkeit` ausführen und
   die angeforderten Kalender-Berechtigungen bestätigen.
5. Danach in den Projekteinstellungen → Trigger einen zeitgesteuerten
   Trigger für `syncAnfragenVerfuegbarkeit` einrichten. Empfehlung:
   stündlich — bei Bedarf anpassen (z. B. alle 15 Minuten für schnellere
   Reaktion auf neue Team-Einträge, oder täglich morgens, wenn stündlich
   zu häufig ist).

⚠️ Nach jeder Code-Änderung im Skript-Editor erneut **Bereitstellen** (bei
zeitgesteuerten Triggern reicht Speichern + Trigger bleibt bestehen, aber
bei Editor-Testläufen immer die neueste gespeicherte Version prüfen).

## Testen

- Im Apps-Script-Editor `syncAnfragenVerfuegbarkeit` manuell ausführen,
  dann `anfragen@spiritual-touch.de` in Google Calendar öffnen und die
  kommenden Tage prüfen: Blockierungen sollten nur dort auftauchen, wo
  laut den persönlichen Kalendern wirklich niemand der 10 Mitglieder frei
  ist.
- Beispiel-Check anhand realer Daten (Stand 16.08.2026): Mittwoch 19.08.
  war Maxine ganztägig frei → an dem Tag sollte `anfragen@` keine
  Blockierung zeigen. Donnerstag 20.08. waren Maxine, Stephanie und
  Dominik zumindest zeitweise frei → auch dort sollte `anfragen@`
  entsprechend offen erscheinen, ohne dass ersichtlich ist, wer konkret.
- Bei Zweifeln erst mit `SYNC_DAYS_AHEAD = 1` testen (in `Code.gs` unten
  anpassen), um die Auswirkung auf nur einen Tag zu begrenzen, bevor der
  reguläre 14-Tage-Lauf aktiv geschaltet wird.

## Kalender-IDs

| Kalender | ID |
|---|---|
| anfragen@spiritual-touch.de | `c_401278f6887d93ae312284ce6931ed0c3547aafd33d6bb142843bbb7e29e4aa4@group.calendar.google.com` |
| Tara | `c_fe6664e01f568080774112156e255089ea2ea2877109d6ddb241d046ebff58fb@group.calendar.google.com` |
| Asmita | `c_72c5bf2bb1c90f5424d77c3f1f6593cf2cf6fe05f27204ff1c73f3632350cabd@group.calendar.google.com` |
| Amila | `c_727306d56fd4b1755718073543de922a25edc2509fcb14f2b4e53b7a9263b72a@group.calendar.google.com` |
| Sarah | `c_d37ba1f2e4913be355bc25873d90dc9ee115b70537adfd5a6b2a5f1e98d26361@group.calendar.google.com` |
| Dominik | `c_0d3ba2a1dde3033c512dfd51c12fd0bb0c23b3e41297c169c214e76ced530669@group.calendar.google.com` |
| Konstantin | `c_459599398173cc57da9c45a996d1946f1ea0f3b057bdcb1732fd752d298ae15e@group.calendar.google.com` |
| Alea | `c_bee7bf11c2bdae2e7d8bda28b87fd27c5f4bd3cf45124c65da06d799ae9edb7f@group.calendar.google.com` |
| Stephanie | `c_360bace4072d8f2356127d9b6dd12b2c45c63be5dd791f86fbc0018e00d06714@group.calendar.google.com` |
| Karen | `c_1caea88007e19c7154765e9a9a3370c8f912f40a46c32145486b862d8770c0c7@group.calendar.google.com` |
| Maxine | `c_b3600e5f62821b31ef76a82e9c9078070a0c8e9e29641463b7ae270e6871f33d@group.calendar.google.com` |
| Eva | `eva.saur1993@gmail.com` |

Jörg ist bewusst nicht enthalten — er hat einen eigenen festen Buchungsweg
in Amelia und läuft nicht über den "Nur auf Anfrage"-Mitarbeiter. Evas
privater Kalender ist dagegen mit einbezogen (siehe oben): sie hat zwar
ebenfalls einen eigenen Buchungsweg, aber ihre freie Zeit dort zählt
zusätzlich als "Nur auf Anfrage"-Verfügbarkeit.

## Nicht Teil dieses Skripts (nächste, separate Schritte)

- Das benutzerdefinierte Feld "Wunschbegleitung" im Amelia-Buchungsformular
  für den "Nur auf Anfrage"-Mitarbeiter.
- Der manuelle Freigabe-Workflow (Jörg entscheidet bei mehreren
  verfügbaren Mitgliedern, bestätigt in Amelia, kopiert den Termin in
  Hilfskalender + Raumkalender).

Bewusst getrennt gehalten, damit jeder Baustein für sich getestet und bei
Bedarf ausgetauscht werden kann.
