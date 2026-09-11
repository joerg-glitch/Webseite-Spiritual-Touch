# Off-Canvas-Menü (Ersatz für Glass-Pill-Menü)

Fixer Tab am rechten Bildschirmrand ("Menü"), der eine Menü-Schublade
(Drawer) mit Akkordeon-Navigation öffnet. Erkennt automatisch, ob gerade
der Bereich `/praxis/...` oder `/institut/...` besucht wird, und zeigt das
passende Menü. Kein Plugin nötig, ein einziger HTML/CSS/JS-Block.

Ersetzt zwei bisherige Elemente auf einmal:

1. das bisherige "Glass-Pill"-Hauptmenü (unübersichtlich, v.a. mobil)
2. das floatende Kontakt-Widget im Footer (Telefonnummer) – Telefon und
   ein neuer, prominenter **"Dein Feedback"**-Button stecken jetzt fest
   angepinnt unten in der Menü-Schublade.

## Struktur

```
Tab "Menü" (immer sichtbar, rechter Rand)
└─ Drawer (Vollbild mobil / 400px Panel Desktop, von rechts)
   ├─ Kopfzeile mit Schließen-Button
   ├─ Navigation (scrollbar, Akkordeon – nur ein Punkt gleichzeitig offen)
   └─ Fest angepinnter Fußbereich (bleibt beim Scrollen sichtbar)
       ├─ Telefon-Link
       ├─ "Dein Feedback"-Button (auffällig, eigene Akzentfarbe)
       └─ Adresse
```

Die Navigation wird per JavaScript aus zwei Menü-Bäumen gerendert
(`STW_MENUS.institut` und `STW_MENUS.praxis`), abhängig vom aktuellen
Seitenpfad. Der Fußbereich mit Telefon/Feedback/Adresse ist **bereichsunabhängig
identisch** – wird nur einmal gepflegt.

## Menü-Punkte anpassen

Im `<script>`-Block ganz oben steht `STW_MENUS`. Jeder Eintrag:

```js
{ label: 'Anzeigetext', url: 'https://...', children: [ ... ] }
```

- **Ohne `children`**: normaler Link.
- **Mit `children` und `url`**: Klick auf den Text navigiert zur
  Übersichtsseite, der Pfeil daneben klappt die Unterpunkte auf/zu
  (Beispiel: "Seminare & Ausbildung" im Institut-Menü).
- **Mit `children` und `url: null`**: Der Text hat keine eigene
  Übersichtsseite und dient nur zum Auf-/Zuklappen (Beispiel: "Praxis &
  Team" im Praxis-Menü – dafür existierte bislang keine eigene Landingpage).

`STW_DEFAULT_MENU` legt fest, welches Menü auf Seiten außerhalb von
`/praxis` und `/institut` erscheint (z.B. Startseite) – aktuell `praxis`.

Aktuell hinterlegte Inhalte stammen aus den bestehenden Elementor-Menüs
(siehe `database/wordpress-content.sql`) – Adressen, Ausbildungs- und
Praxis-Unterseiten sowie die Telefonnummer wurden von dort übernommen.
Bitte einmal gegenprüfen, ob alle Ziel-URLs noch aktuell sind.

## Fußbereich anpassen

Telefonnummer, Feedback-Link und Adresse stehen direkt im HTML-Teil, im
Block `#stw-footer` – dort einfach Text/`href` ändern.

## Design anpassen

Alle Farben und Schriften liegen als CSS-Variablen ganz oben im
`<style>`-Block unter `#stw-menu-root`, z.B.:

| Variable | Bedeutung |
|---|---|
| `--stw-tab-bg` | Hintergrundfarbe des fixen Tabs |
| `--stw-bg` | Hintergrund der Menü-Schublade |
| `--stw-accent` | Akzentfarbe (Feedback-Button, Hover-Farbe der Links) |
| `--stw-text` / `--stw-text-soft` | Haupt-/Nebentextfarbe |
| `--stw-font-body` / `--stw-font-display` | Schriftarten (Fließtext/Überschriften) |

Aktuell auf gedeckte Erdtöne (dunkles Bordeaux/Clay auf Creme) gestellt,
angelehnt an den bisherigen Look – bei Bedarf einfach die Variablen
ersetzen, der Rest des Codes muss dafür nicht angefasst werden.

## Einbau in Elementor / WordPress

Da der Tab und die Schublade `position: fixed` nutzen, ist der genaue
Einbauort im Layout egal – er muss nur **auf jeder Seite geladen werden**.
Empfohlen:

**Option A – WPCode (empfohlen):**
WordPress → Plugins → WPCode → Code Snippets → Neu → HTML-Snippet →
Inhalt von `off-canvas-menu.html` einfügen → Einfügen: **Body Ende** →
Bedingung: **Gesamte Website** → Aktivieren.

**Option B – Elementor Theme Builder (Footer):**
Theme Builder → Footer-Template → HTML-Widget → Code einfügen. Funktioniert
nur, solange der Footer-Container selbst keinen `transform` (z.B. Sticky-/
Animations-Effekt) gesetzt hat – sonst bricht `position: fixed` innerhalb
des Containers aus dem Viewport-Bezug.

## Wichtig: altes Menü & altes Kontakt-Widget deaktivieren

Damit nicht zwei floatende Elemente gleichzeitig sichtbar sind:

1. Das bisherige Glass-Pill-Hauptmenü im Header ausblenden bzw. das
   Header-Template ohne die alte Navigation speichern.
2. Das bisherige floatende Telefon-/Kontakt-Widget im Footer entfernen
   oder deaktivieren – seine Funktion (Anruf-Button) übernimmt jetzt der
   Fußbereich in der neuen Menü-Schublade.

Am besten erst auf einer Testseite/Staging parallel einbauen, prüfen, und
danach das alte Menü final abschalten.
