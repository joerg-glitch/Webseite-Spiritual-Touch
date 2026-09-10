# Buchungsseite für den Google-Business-Profil-Link

Ziel: ein "Termin buchen"-Button in der Google-Suche/Maps-Anzeige (Google
Business Profil), der auf eine eigenständige Seite mit dem kompletten
Amelia-Buchungsformular führt. Kein Custom-Code nötig — Amelia liefert den
Katalog-Shortcode selbst mit, es fehlt nur die Seite dafür.

## Warum eine neue Seite

Amelia ist bei euch bisher nur als **Popup-Trigger** auf einzelnen Seiten
eingebunden (`[ameliabooking category=2 trigger="st-vorgespraech-trigger"
trigger_type="class" in_dialog=1]` fürs Kennenlern-Gespräch, ähnlich für
Service 12) — das öffnet einen Dialog per Button-Klick, ist aber keine
eigene, direkt aufrufbare URL. Google Business Profil braucht für den
Buchungslink genau eine feste URL.

## Einrichtung

1. **Neue WordPress-Seite anlegen**, z. B. Titel "Online buchen", Slug
   `/online-buchen/` (oder `/termin-buchen/` — was zur bestehenden
   URL-Struktur passt).
2. Im Seiteninhalt den Shortcode einfügen:
   ```
   [ameliabooking]
   ```
   Ohne `category=`/`service=`-Parameter zeigt das den **kompletten**
   Katalog — Kund:innen wählen selbst Kategorie, Dienstleistung,
   Mitarbeiter:in und Zeit, genau wie im normalen Amelia-Buchungsablauf.
   Elementor: Shortcode-Widget. Gutenberg: Shortcode-Block.
3. Veröffentlichen, die fertige URL notieren (z. B.
   `https://spiritual-touch.de/online-buchen/`).

⚠️ **Vor dem Veröffentlichen unbedingt prüfen:** In Amelias eigenen
Kategorie-Einstellungen (wp-admin → Amelia → Kategorien) müssen die beiden
internen Kategorien **"Anfrage"** (ID 8) und **"Bestätigt"** (ID 7) als
versteckt/deaktiviert für die öffentliche Buchung markiert sein. Sonst
zeigt der volle Katalog auch die internen Duplikat-Dienstleistungen und die
Pseudo-Mitarbeiter ("männliche Begleitung", "weibliche Begleitung", "das
Geschlecht der Begleitung ist mir nicht wichtig", siehe Buchungs-Dashboard-
README) — für Kund:innen verwirrend und offenbart die interne
Zuweisungs-Mechanik. Laut vorheriger Dokumentation ("Bestätigt" ist eine
"versteckte Kategorie") ist das vermutlich schon so konfiguriert, aber
einmal mit einem frischen Inkognito-Fenster gegenprüfen, bevor der Link
öffentlich verlinkt wird.

## Mit Google Business Profil verknüpfen

1. [business.google.com](https://business.google.com) öffnen, eingeloggt
   als Inhaber des Profils.
2. Profil bearbeiten → Bereich "Termine" (bzw. "Buchungslink"/"Booking
   link" je nach Sprache/Ansicht).
3. Die Seiten-URL aus Schritt 3 oben eintragen, speichern.
4. Kann etwas dauern (Stunden bis wenige Tage), bis der Button in der
   Suche/Maps-Anzeige sichtbar wird.

## Hinweis zur Google-Richtlinie

Bei sensiblen/intimen Dienstleistungskategorien lohnt sich vorab ein
Blick in Googles Richtlinien für Unternehmensprofile (Kategorie/Inhalte).
Im schlimmsten Fall wird nur der Buchungslink oder die Kategorie abgelehnt
— dann bleibt die Website-Buchung über die bestehenden Popup-Trigger
trotzdem unberührt bestehen.

## Bewusst nicht Teil dieses Bausteins

- **Reserve with Google** (Live-Verfügbarkeit direkt in der
  Google-Anzeige, ohne Website-Wechsel) — erfordert eine offizielle
  Google-Partnerschaft der Buchungssoftware. Amelia ist kein
  Reserve-with-Google-Partner, deshalb bleibt es beim einfachen
  "Weiterleitung zur Website"-Link.
- Optische Gestaltung der neuen Seite (Intro-Text, Branding um das
  Amelia-Formular herum) — bewusst nicht mitgebaut, da unklar war, ob das
  gewünscht ist. Bei Bedarf einfach nachfragen.
