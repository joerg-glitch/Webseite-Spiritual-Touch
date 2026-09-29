# Google-Buchungsseite (Amelia) – Testphase

Eigenständige Elementor-Seite mit **fünf Kategorie-Karten**; ein Klick öffnet
das **Amelia-Buchungsformular der Kategorie als Popup**. Ziel ist der
**„Online buchen"-Button im Google Business Profil**. Testphase, bevor der
Amelia-Button auf der ganzen Website freigeschaltet wird – so bleibt die
restliche Seite unberührt.

Aufbau analog zur [WhatsApp-Vorschaltseite](../whatsapp-vorschaltseite/):
Elementor-Canvas-Seite (ohne Header/Footer), Auswahl per Karten, Amelia
öffnet per Trigger-Klasse als Popup.

| Reihenfolge | Amelia-Kategorie | Karte | Trigger-Klasse |
|---|---|---|---|
| 1 | 2 | Unsicher? Kostenloses Kennenlern-Gespräch | `st-kat-2` |
| 2 | 5 | Zu Zweit | `st-kat-5` |
| 3 | 3 | Angebote für Männer | `st-kat-3` |
| 4 | 4 | Angebote für Frauen | `st-kat-4` |
| 5 | 6 | Coaching & Begleitung | `st-kat-6` |

```
┌───────────────────────────────────┐
│ HTML-Widget: seiten-kopf.html      │  Marke, Überschrift, Adresse
│ HTML-Widget: seiten-kategorien.html│  die 5 Karten
│ Shortcode-Widget                   │  5× [ameliabooking category=N trigger=…]
│ HTML-Widget: seiten-fuss.html      │  WhatsApp/Anrufen, Preise, FAQ, Impressum
└───────────────────────────────────┘
```

## Variante A – Template importieren (schnell)

1. WordPress → **Elementor → Templates → Gespeicherte Templates → Template importieren**
   → `elementor-template.json` hochladen.
2. **Seiten → Erstellen**, Titel z. B. „Online buchen", Slug `online-buchen`.
3. Mit Elementor bearbeiten → Ordner-Symbol (Template hinzufügen) →
   **„Google Buchungsseite (Amelia)"** einfügen.
4. Zahnrad unten links (Seiteneinstellungen) → **Seitenlayout: Elementor Canvas**
   (falls nicht schon gesetzt).
5. Veröffentlichen.

## Variante B – von Hand bauen

1. Neue Seite „Online buchen", Seitenlayout **Elementor Canvas**.
2. Einen Container (Spalte) anlegen, darin nacheinander:
   - **HTML-Widget** → Inhalt von `seiten-kopf.html`
   - **HTML-Widget** → Inhalt von `seiten-kategorien.html`
   - **Shortcode-Widget** → diese fünf Zeilen:
     ```
     [ameliabooking category=2 trigger="st-kat-2" trigger_type="class" in_dialog=1]
     [ameliabooking category=5 trigger="st-kat-5" trigger_type="class" in_dialog=1]
     [ameliabooking category=3 trigger="st-kat-3" trigger_type="class" in_dialog=1]
     [ameliabooking category=4 trigger="st-kat-4" trigger_type="class" in_dialog=1]
     [ameliabooking category=6 trigger="st-kat-6" trigger_type="class" in_dialog=1]
     ```
   - **HTML-Widget** → Inhalt von `seiten-fuss.html`
3. Bei den HTML-/Shortcode-Widgets unter *Erweitert → CSS-Klassen*: `stg-w`.

## Vor dem Veröffentlichen prüfen

- **Jede der 5 Karten einzeln anklicken:** öffnet sich das richtige Popup, mit
  den richtigen Angeboten? Weil pro Kategorie ein eigener Amelia-Shortcode
  auf der Seite steht, sind „Anfrage" (ID 8) und „Bestätigt" (ID 7) gar nicht
  erreichbar. Falls beim Klick nichts passiert oder ein falsches Popup
  aufgeht: Trigger-Klasse der Karte und Shortcode vergleichen (`st-kat-N`).
- **Bis zum Ende testen** (Probebuchung), damit man sieht, was Kund:innen danach
  erhalten und wie die Buchung bei euch als Anfrage/Bestätigt landet.
- **Suchmaschinen:** die Seite ist ein reines Ziel für den Google-Link. Unter
  *Yoast SEO → Erweitert → „Suchmaschinen erlauben, diese Seite anzuzeigen"* auf
  **Nein** stellen (noindex), wie bei der WhatsApp-Seite – sonst gibt es eine
  zweite, konkurrierende Buchungs-URL in der Google-Suche.
- **Cache / Optimierung:** die Seite in WP Rocket/LiteSpeed o. Ä. vom
  JS-Verzögern bzw. -Kombinieren ausnehmen, falls das Formular nicht lädt
  (Amelia + „JavaScript verzögern" verträgt sich oft schlecht).
- **TranslatePress:** der schwebende Sprachumschalter erscheint auch auf
  Canvas-Seiten. Falls er stört, wie bei der WhatsApp-Seite ausblenden:
  `.trp-language-switcher, .trp-floating-switcher{display:none!important}`
  (in `seiten-kopf.html` in den `<style>`-Block einfügen).

## Im Google Business Profil eintragen

1. [business.google.com](https://business.google.com) → Profil bearbeiten →
   **Termine / Buchungslink**.
2. URL eintragen – am besten mit Tracking, damit du in Analytics/Ahrefs
   siehst, was über Google ankommt:
   `https://spiritual-touch.de/online-buchen/?utm_source=google&utm_medium=organic&utm_campaign=gbp-buchen`
3. Speichern. Es kann Stunden bis Tage dauern, bis der Button in Suche/Maps
   auf die neue URL zeigt.

## Anpassen

- **Texte/Farben:** in `seiten-kopf.html`, `seiten-kategorien.html` bzw. `seiten-fuss.html` ändern, dann
  `python3 build_template.py` ausführen → neue `elementor-template.json`.
  (Oder direkt im HTML-Widget auf der Seite editieren.)
- **Farben** entsprechen dem Elementor-Kit: Text `#2E2A28`/`#4A4442`, Gold
  `#C8B178` (wie `st-btn-primary`), Hintergrund `#F7F1EA`; Schrift Playfair Display.
- **Farben im Popup-Formular** (Buttons, Auswahl): nicht hier, sondern in
  Amelia → *Anpassen → Formulare* (Gold `#C8B178` passt zur Seite).
- **Kategorie ändern/ergänzen:** in `seiten-kategorien.html` eine Karte
  kopieren (neue Klasse `st-kat-N`), in `build_template.py` die ID in
  `KATEGORIEN` ergänzen – Reihenfolge der Liste = Reihenfolge der Shortcodes;
  die Reihenfolge der Karten steht in `seiten-kategorien.html`.
