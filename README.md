# Spiritual Touch – Projekt-Repository

Dieses Repository bündelt alle Code-Projekte rund um [spiritual-touch.de](https://spiritual-touch.de) (WordPress-Seite), die mit Claude entwickelt bzw. dokumentiert wurden. `main` ist der aktuelle, zusammengeführte Stand aller Teilprojekte.

## Projektübersicht

| Ordner | Was ist das | Details |
|---|---|---|
| `database/` | Backup der WordPress-Datenbank (Seiteninhalte, Elementor-Layouts) | siehe Abschnitt „Datenbank-Backup" unten |
| `team-app/` | PIN-geschützte Web-App fürs Team (Verfügbarkeiten, Amelia-Termine ändern/absagen) | [team-app/README.md](team-app/README.md) |
| `apps-script/anfragen-verfuegbarkeit-sync/` | Google Apps Script: Anfragen/Verfügbarkeit-Sync fürs Buchungssystem | [README](apps-script/anfragen-verfuegbarkeit-sync/README.md) |
| `apps-script/raum-einladung-sync/` | Google Apps Script: Raum-Einladungs-Sync (Kalender ↔ Amelia) | [README](apps-script/raum-einladung-sync/README.md) |
| `wordpress/buchungs-dashboard/` | WPCode-Snippet: Buchungs-Dashboard (Smart-Freigeben) | [README](wordpress/buchungs-dashboard/README.md) |
| `wordpress/booking-confirmation-link/` | WPCode-Snippet: Buchungsbestätigungs-Link | [README](wordpress/booking-confirmation-link/README.md) |
| `wordpress/google-buchungslink/` | WPCode-Snippet: Google-Buchungslink | [README](wordpress/google-buchungslink/README.md) |
| `elementor-widgets/coverflow-card-slider/` | Nachgebautes Elementor-HTML-Widget (Coverflow-Card-Slider) | [README](elementor-widgets/coverflow-card-slider/README.md) |
| `whatsapp-vorschaltseite/` | WhatsApp-Look Vorschaltseite zur Lead-Filterung (DE/EN) | — |
| `PLAN.md`, `TASKS.md`, `TEAM-APP-ROADMAP.md` | Planungs-/Aufgaben-Dokus zur Team-App | — |
| `.agents/skills/`, `.claude/skills/`, `skills-lock.json` | Design-Taste-Skills für Claude-Code-Sessions (kein Website-Code) | — |

## Hinweis zu Branches

Frühere Chat-Sessions haben teils eigene Branches pro Thema angelegt (`claude/…`). Diese wurden in `main` zusammengeführt und sind zur Sicherheit unter `archive/…` weiterhin einsehbar, aber nicht mehr aktiv in Benutzung. Für neue Themen: einfach in `main` weiterarbeiten, kein neuer Branch nötig.

---

## Datenbank-Backup (`database/`)

`database/wordpress-content.sql` – gefilterter Auszug aus dem UpdraftPlus-Datenbank-Backup vom 01.08.2026, beschränkt auf die reinen Seiteninhalte:

- `txva_posts` – Seiten, Beiträge, Elementor-Templates
- `txva_postmeta` – Meta-Daten dazu, u.a. die Elementor-Layout-Daten (`_elementor_data`)
- `txva_terms`, `txva_term_taxonomy`, `txva_term_relationships`, `txva_termmeta` – Kategorien/Tags
- `txva_links` – Linkliste

### Bewusst ausgeschlossen

Aus dem Original-Backup wurden **keine** sensiblen bzw. personenbezogenen Daten übernommen, u.a.:

- `txva_users` / `txva_usermeta` (Benutzerkonten, Passwort-Hashes)
- Bestell- und Zahlungsdaten (WooCommerce)
- Buchungsdaten (Amelia, Bookly, Events)
- Newsletter-Abonnenten (MailPoet)
- Formular-Einsendungen (WPForms)
- Logs (Redirection, Action Scheduler, WooCommerce Sessions etc.)
- **`txva_options`** – GitHub hat beim Push automatisch **live API-Schlüssel/OAuth-Tokens** in dieser Tabelle erkannt (u.a. Google OAuth Client-Secret und ein Sendinblue/Brevo API-Key) und den Push blockiert. Die Tabelle wurde deshalb komplett ausgeschlossen. **Diese Zugangsdaten liegen unverschlüsselt in deiner WordPress-Datenbank – siehe Hinweis unten.**

Ebenfalls noch nicht enthalten: Theme-Dateien, Plugins und Medien (Uploads) aus dem Vollbackup – diese folgen ggf. in einem separaten Schritt.

### Herkunft

Quelle: UpdraftPlus-Backup `backup_2026-08-01-0950_Spiritual_Touch`, erstellt am 01.08.2026, WordPress 7.0.2, Tabellenpräfix `txva_`.

### ⚠️ Sicherheitshinweis

Beim Versuch, die Datenbank ins Repo zu pushen, hat GitHub folgende **aktive Zugangsdaten im Klartext** in der `txva_options`-Tabelle gefunden:

- Google OAuth Access Token, Client-ID und Client-Secret (vermutlich von einem SMTP-/Mail-Plugin)
- Ein Sendinblue/Brevo API-Key

Diese liegen unverschlüsselt in deiner WordPress-Datenbank. Empfehlung: In Google Cloud Console das OAuth-Client-Secret rotieren und in Brevo den API-Key neu erzeugen, dann die neuen Werte im jeweiligen WordPress-Plugin hinterlegen.
