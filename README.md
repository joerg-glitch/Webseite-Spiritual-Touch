# Spiritual Touch – Website-Backup

Dieses Repository enthält ein Backup der Inhalte von [spiritual-touch.de](https://spiritual-touch.de) (WordPress-Seite).

## Inhalt

`database/wordpress-content.sql` – gefilterter Auszug aus dem UpdraftPlus-Datenbank-Backup vom 01.08.2026, beschränkt auf die reinen Seiteninhalte:

- `txva_posts` – Seiten, Beiträge, Elementor-Templates
- `txva_postmeta` – Meta-Daten dazu, u.a. die Elementor-Layout-Daten (`_elementor_data`)
- `txva_terms`, `txva_term_taxonomy`, `txva_term_relationships`, `txva_termmeta` – Kategorien/Tags
- `txva_links` – Linkliste

## Bewusst ausgeschlossen

Aus dem Original-Backup wurden **keine** sensiblen bzw. personenbezogenen Daten übernommen, u.a.:

- `txva_users` / `txva_usermeta` (Benutzerkonten, Passwort-Hashes)
- Bestell- und Zahlungsdaten (WooCommerce)
- Buchungsdaten (Amelia, Bookly, Events)
- Newsletter-Abonnenten (MailPoet)
- Formular-Einsendungen (WPForms)
- Logs (Redirection, Action Scheduler, WooCommerce Sessions etc.)
- **`txva_options`** – GitHub hat beim Push automatisch **live API-Schlüssel/OAuth-Tokens** in dieser Tabelle erkannt (u.a. Google OAuth Client-Secret und ein Sendinblue/Brevo API-Key) und den Push blockiert. Die Tabelle wurde deshalb komplett ausgeschlossen. **Diese Zugangsdaten liegen unverschlüsselt in deiner WordPress-Datenbank – siehe Hinweis unten.**

Ebenfalls noch nicht enthalten: Theme-Dateien, Plugins und Medien (Uploads) aus dem Vollbackup – diese folgen ggf. in einem separaten Schritt.

## Herkunft

Quelle: UpdraftPlus-Backup `backup_2026-08-01-0950_Spiritual_Touch`, erstellt am 01.08.2026, WordPress 7.0.2, Tabellenpräfix `txva_`.

## ⚠️ Sicherheitshinweis

Beim Versuch, die Datenbank ins Repo zu pushen, hat GitHub folgende **aktive Zugangsdaten im Klartext** in der `txva_options`-Tabelle gefunden:

- Google OAuth Access Token, Client-ID und Client-Secret (vermutlich von einem SMTP-/Mail-Plugin)
- Ein Sendinblue/Brevo API-Key

Diese liegen unverschlüsselt in deiner WordPress-Datenbank. Empfehlung: In Google Cloud Console das OAuth-Client-Secret rotieren und in Brevo den API-Key neu erzeugen, dann die neuen Werte im jeweiligen WordPress-Plugin hinterlegen.
