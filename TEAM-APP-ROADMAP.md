# Team-App – Ausbau-Roadmap (Ideensammlung)

Diese Datei sammelt zukünftige Ausbaustufen für die Team-App als Backlog, damit sie bei Bedarf wieder aufgegriffen werden können. Es handelt sich um Planungsideen, noch nicht um konkrete Umsetzungsaufträge.

Status: 💡 Idee / Backlog – noch nicht terminiert, noch nicht spezifiziert.

## 1. Eigene Kundentermine mit Amelia-Synchronisation

**Idee:** Team-Mitglieder können in der Team-App eigene Kundentermine eintragen. Diese Termine werden mit dem Amelia-Booking-Plugin (WordPress) synchronisiert, sodass Verfügbarkeiten und Buchungen konsistent zwischen App und Website-Kalender bleiben.

Offene Fragen für eine spätere Konkretisierung:
- Synchronisationsrichtung: nur App → Amelia, nur Amelia → App, oder bidirektional?
- Technischer Weg: Amelia REST API, direkte DB-Anbindung oder Webhook/Zapier-Automatisierung?
- Konfliktbehandlung bei zeitgleichen Terminen (App vs. Amelia)?
- Zuordnung Team-Mitglied ↔ Amelia-„Employee"/Ressource.

## 2. Kunden-Gutscheine & Terminauswahl direkt aus dem Kalender

**Idee:** Erfassung von Kunden-Gutscheinen in der Team-App, inklusive direkter Terminauswahl aus dem Kalender heraus (Gutschein einlösen → passenden Slot direkt buchen).

Offene Fragen für eine spätere Konkretisierung:
- Datenmodell für Gutscheine (Wert, Gültigkeit, verknüpfte Leistung, Einlöse-Status).
- Verknüpfung mit Amelia-Buchungen (siehe Punkt 1) oder eigenständige Kalenderansicht?
- Wer darf Gutscheine erfassen/einlösen (Rollen/Rechte)?

---

*Letzte Aktualisierung: 2026-08-11 – als Backlog-Einträge für spätere Umsetzung abgelegt.*
