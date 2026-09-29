# Google-Buchungsseite (Amelia) – Testphase

Eigenständige Elementor-Seite mit dem **Amelia-Buchungsformular direkt eingebettet**
(kein Popup), gedacht als Ziel für den **„Online buchen"-Button im Google
Business Profil**. Testphase, bevor der Amelia-Button auf der ganzen Website
freigeschaltet wird – so bleibt die restliche Seite unberührt.

Aufbau analog zur [WhatsApp-Vorschaltseite](../whatsapp-vorschaltseite/):
Elementor-Canvas-Seite (ohne Header/Footer), Kopf und Fuß als HTML-Widget,
dazwischen Amelia.

```
┌──────────────────────────────┐
│ HTML-Widget: seiten-kopf.html │  Marke, Überschrift, Adresse
├──────────────────────────────┤
│ Shortcode-Widget              │  [ameliabooking]  (weiße Karte)
├──────────────────────────────┤
│ HTML-Widget: seiten-fuss.html │  WhatsApp/Anrufen, Preise, FAQ, Impressum
└──────────────────────────────┘
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
   - **Shortcode-Widget** → `[ameliabooking]`; unter *Erweitert → CSS-Klassen*: `stg-w stg-form`
   - **HTML-Widget** → Inhalt von `seiten-fuss.html`
3. Bei den beiden HTML-Widgets unter *Erweitert → CSS-Klassen*: `stg-w`.

## Vor dem Veröffentlichen prüfen

- **Kategorien „Anfrage" (ID 8) und „Bestätigt" (ID 7)** dürfen im öffentlichen
  Formular nicht auftauchen (siehe [google-buchungslink/README.md](../wordpress/google-buchungslink/README.md)).
  `[ameliabooking]` ohne Parameter zeigt den kompletten Katalog – im
  **Inkognito-Fenster** einmal durchklicken: Kategorien, Mitarbeiter:innen,
  keine „männliche/weibliche Begleitung"-Pseudo-Mitarbeiter sichtbar?
  Falls doch: in Amelia die Kategorie/Mitarbeiter:innen für die Online-Buchung
  ausblenden – oder statt des vollen Katalogs auf eine Kategorie einschränken,
  z. B. `[ameliabooking category=3]` (Angebote für Männer).
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

- **Texte/Farben:** in `seiten-kopf.html` / `seiten-fuss.html` ändern, dann
  `python3 build_template.py` ausführen → neue `elementor-template.json`.
  (Oder direkt im HTML-Widget auf der Seite editieren.)
- **Farben** entsprechen dem Elementor-Kit: Text `#2E2A28`/`#4A4442`, Gold
  `#C8B178` (wie `st-btn-primary`), Hintergrund `#F7F1EA`; Schrift Playfair Display.
- **Farben im Formular selbst** (Buttons, Auswahl): nicht hier, sondern in
  Amelia → *Anpassen → Formulare* (Gold `#C8B178` passt zur Seite).
- **Später optional:** kostenloses Vorgespräch als zweiter Einstieg
  (`[ameliabooking service=12 trigger="st-vorgespraech-trigger" trigger_type="class" in_dialog=1]`
  + Button mit Klasse `st-vorgespraech-trigger`). Bewusst nicht enthalten, weil
  zwei Amelia-Instanzen auf einer Seite in der Testphase eine unnötige
  Fehlerquelle wären.
