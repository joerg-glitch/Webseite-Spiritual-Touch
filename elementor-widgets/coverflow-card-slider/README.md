# Coverflow Card Slider

Nachbau des Slider-Widgets von `https://tantra-atilan.com/elementor-319/`
(dort über das Plugin "Multiple Card Transitions" umgesetzt, hier ohne
Plugin-Abhängigkeit mit der freien Bibliothek [Swiper.js](https://swiperjs.com)
nachgebaut).

## Optik

- 3D-Coverflow: aktive Karte groß und scharf, Nachbar-Karten kleiner und
  leicht nach hinten versetzt
- Nicht-aktive Karten werden **weichgezeichnet (Blur) und abgedunkelt** –
  das ist der Effekt, den du auf der Vorlage-Seite gesehen hast
- Karten mit abgerundeten Ecken und weichem Schlagschatten (`box-shadow`)
- Verlaufs-Overlay unten in jeder Karte für lesbaren Text (Titel,
  Untertitel, Sternebewertung)
- Pfeil-Buttons im "Glas"-Look (`backdrop-filter: blur`)
- Pagination-Punkte, Autoplay (alle 3 Sekunden), per Tastatur bedienbar,
  responsive (auf Mobilgeräten kleinere Karten, Pfeile ausgeblendet)

## Einbau in Elementor

1. In Elementor ein **HTML-Widget** an die gewünschte Stelle ziehen.
2. Den kompletten Inhalt von [`coverflow-card-slider.html`](./coverflow-card-slider.html)
   hineinkopieren.
3. Im Abschnitt `SLIDES ANPASSEN` die `background-image`-URLs durch eigene
   Bilder ersetzen (am besten Bilder aus der WordPress-Mediathek verlinken)
   und Titel/Untertitel/Bewertung anpassen.
4. Weitere Karten hinzufügen: einen kompletten
   `<div class="swiper-slide stw-slide">…</div>`-Block kopieren und
   einfügen.
5. Speichern/Aktualisieren – fertig.

**Hinweis:** Das Widget lädt Swiper.js über ein CDN (`jsdelivr.net`). Falls
das Theme oder ein anderes Plugin Swiper.js bereits global einbindet, können
die `<link>`- und `<script>`-Zeilen im Abschnitt `SWIPER LADEN` entfernt
werden, um doppeltes Laden zu vermeiden.

## Ursprung

Die HTML-Struktur der Vorlage (`multiple_card_transitions` Elementor-Widget,
Klassen `mct-*`, Swiper-Coverflow) wurde per Browser-DevTools vom Nutzer
kopiert und diente als Referenz für den Nachbau. Die exakten CSS-Werte des
Original-Plugins (Farben, genaue Blur-/Schatten-Stärke) lagen nicht vor und
wurden frei nachempfunden.
