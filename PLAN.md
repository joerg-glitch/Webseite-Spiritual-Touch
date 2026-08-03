# Plan: Team-Verfügbarkeits-App für Amelia

## 1. Problem

Teammitglieder tragen ihre Verfügbarkeit aktuell informell in einen gemeinsamen
Google-Kalender ein (ganztägiger Termin = ganzer Tag da, "ab 12:00" /
"bis 12:00" im Titel = Teilverfügbarkeit). Das WordPress-Buchungsplugin
**Amelia** braucht diese Information aber in Form von Google-Calendar-Events
mit Status **Busy** in einem eigenen **Hilfskalender pro Mitarbeiter:in** —
ein Busy-Event blockiert die Zeit in Amelia, buchbar ist nur, was frei bleibt
(bestätigt über offizielle Amelia-Doku: "Google Calendar Employees" +
"Remove Busy Slots").

Die Hilfskalender existieren bereits und sind pro Person mit Amelia
verknüpft. Es fehlt: eine einfache Oberfläche, über die jedes Teammitglied
seine Verfügbarkeit einträgt, die automatisch in die richtigen
Busy-Blocker-Events im jeweiligen Hilfskalender übersetzt wird.

## 2. Kernlogik (wichtig — bitte gegenchecken)

Weil ein Event = "blockiert" bedeutet, muss die App **das Gegenteil** dessen
schreiben, was eingetragen wird:

| Eingabe des Teammitglieds | Ergebnis im Hilfskalender |
|---|---|
| Ganzer Tag verfügbar | **kein** Blocker-Event an dem Tag (alles im Arbeitsfenster buchbar) |
| "ab 12:00" verfügbar | Blocker von Arbeitsfenster-Start bis 12:00 |
| "bis 12:00" verfügbar | Blocker von 12:00 bis Arbeitsfenster-Ende |
| Kein Eintrag für einen Tag | **Ganztages-Blocker** über das gesamte Arbeitsfenster (Standardannahme: ohne Eintrag = nicht da) |

**Arbeitsfenster** (z. B. 09:00–20:00) ist eine einzige, leicht änderbare
Einstellung in einer Config-Datei — kein Code-Eingriff nötig.

**Zu bestätigen / Annahmen, die ich getroffen habe:**
- Standard-Arbeitsfenster: **09:00–20:00** (Platzhalter, bitte anpassen)
- Planungshorizont: automatische Ganztages-Blocker werden **60 Tage im Voraus**
  rollierend erzeugt (per Cron), damit nie ein Tag "offen" vergessen wird
- Ohne Eintrag = nicht verfügbar (ganzer Tag blockiert) — falls das falsch
  ist (z. B. Standard sollte "verfügbar" sein), muss die Logik gedreht werden

## 3. Recherche: bestehende Repos

Geprüft: Cal.com, Easy!Appointments, Nextcloud Calendar, generische
Google-Calendar-Sync-Projekte. Keines bildet die spezifische Übersetzung
"einfache Verfügbarkeits-Eingabe → invertierte Busy-Blocker pro
Amelia-Hilfskalender" ab — sie sind eigenständige Buchungssysteme, kein
schlanker Zusatzbaustein für ein bestehendes Amelia-Setup.
**Entscheidung: kleiner Neubau**, kein Repo-Fork.

## 4. Architektur

- **Sprache/Stack:** PHP (kein Node/Python-Dauerprozess nötig, läuft auf
  jedem WordPress-Webhosting mit) + **SQLite** als Datenspeicher (eine
  Datei, kein DB-Server, kaum Wartung)
- **Google-Anbindung:** Google **Service Account** (kein OAuth-Login pro
  Teammitglied nötig). Jeder Hilfskalender wird einmalig mit der
  Service-Account-E-Mail geteilt ("Änderungen an Terminen vornehmen").
  Der Service-Account-Schlüssel liegt **außerhalb des Webroots**, wird
  **nicht** ins Repo committet (`.gitignore`), keine Keys im Code.
- **Zugang für Teammitglieder:** persönlicher, nicht erratbarer Link
  (`/verfuegbarkeit/<zufalls-token>`), kein Passwort, kein Login
- **Cron:** ein tägliches Skript erzeugt fehlende Ganztages-Blocker für
  neue Tage im rollierenden Horizont
- **Deployment:** eigener Unterordner/Subdomain auf demselben Server wie
  die WordPress-Seite

## 5. Datenmodell (SQLite)

- `team_members`: id, name, calendar_id (Hilfskalender), access_token (Slug), aktiv
- `availability_entries`: id, team_member_id, datum, typ
  (`ganztag` / `ab` / `bis`), uhrzeit, erstellt_am
- `calendar_blocks`: id, team_member_id, datum, google_event_id, start, ende
  (Mapping, damit die App gezielt updaten/löschen kann statt Duplikate zu
  erzeugen)

## 6. Sicherheit & Datenschutz

- Keine personenbezogenen Kundendaten betroffen, nur interne
  Team-Verfügbarkeit
- Service-Account-Key: Dateisystem-Rechte einschränken, nicht im Git-Repo
- Persönliche Links: lang genug (≥ 32 Zeichen Zufall), nicht in Server-Logs
  klarnamentlich verknüpfbar
- Kein Datentransfer an Dritte außer Google Calendar API (die ohnehin schon
  im Einsatz ist)

## 7. Personalisierung

- **Sprache:** Deutsch, Du-Ansprache, kurz und klar (Team-Tool, kein
  Marketing-Text)
- **Design:** einfaches, modernes responsives Interface, ruhige/warme
  Farbpalette passend zum "Spiritual Touch"-Charakter (Platzhalter-Palette,
  wird an bestehendes Website-Branding angeglichen sobald sichtbar) —
  keine generische Demo-Optik
- **Defaults:** Arbeitsfenster + Planungshorizont zentral in einer Config,
  sonst keine Einstellungen nötig
- **Ausgabe:** direkt nutzbar — die Google-Calendar-Events sind das
  Endprodukt (Amelia liest sie automatisch); zusätzlich eine schlanke
  Übersichtsseite für dich, die alle eingetragenen Verfügbarkeiten aller
  Teammitglieder auf einen Blick zeigt (statt 5 Kalender einzeln zu öffnen)

## 8. Nicht-Ziele

- Kein Ersatz für den informellen Team-Kalender oder für Amelia selbst
- Kein Kunden-Login, keine Buchungsfunktion (macht Amelia bereits)
- Keine Veröffentlichung ins Internet ohne dein ausdrückliches OK
