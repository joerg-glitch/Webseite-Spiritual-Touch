# Terminbestätigung per Mail: eigene Termine (Verfügbarkeitskalender → Kunde)

Schwester von [`terminbestaetigung-mail`](../terminbestaetigung-mail/README.md).
Für Termine, die Jörg **von Hand** über ein zweites WPForms-Formular einträgt
(nicht über das Buchungsformular). Sie landen im Kalender **Verfügbarkeit**
statt im Anfragenkalender; von dort löst dieses Skript die
Bestätigungsmail aus. Logik, Vorlagen (Google Docs de/en) und Platzhalter sind
identisch.

Eigenständiges Apps-Script-Projekt (**nicht** ins Schwesterprojekt einfügen,
beide haben ihre eigene Startmarke `AKTIV_SEIT` und ihren eigenen Trigger).

## Ablauf

1. Jörg trägt den Termin über das zweite Formular ein → Termin im Kalender
   „Verfügbarkeit“, Kundendaten in der Beschreibung (Block `Gastdaten:`,
   Format wie im Schwesterskript, siehe dort).
2. Im Titel steht die Begleitung, z. B. `Tantramassage 2h (Asmita)`.
3. Alle 10 Minuten prüft das Skript neue Termine und sendet (oder legt als
   Entwurf an) die Bestätigung.

## Wichtig zu wissen

- **Nicht zusätzlich in einen Raumkalender kopieren.** Sonst bestätigt das
  Schwesterskript ein zweites Mal. Die Projekte teilen keine Markierungen.
- **Titel nicht mit Teammitglied-Namen beginnen** (`Asmita Tantramassage …`
  oder `Asmita(…`). Der Verfügbarkeit-Sync (`team-app/App Script - Sync`)
  liest Titel mit führendem Vornamen als Verfügbarkeit dieser Person.
  `Tantramassage 2h (Asmita)` ist unkritisch.
- Verfügbarkeiten aus der Team-App (ganztägig, ohne `Gastdaten:`) werden vom
  Skript nie angefasst.
- Der Sync liest zeitgebundene Einträge im Verfügbarkeitskalender ggf. als
  Verfügbarkeit mit. Bitte nach den ersten Testterminen kurz prüfen, ob sich in
  den Hilfskalendern etwas Unerwartetes ändert.
- Die Kalender-ID stammt aus `team-app/App Script - Sync`
  (`VERFUEGBARKEIT_CAL_ID`).

## Einrichtung

1. Neues Projekt auf script.google.com als `joerg@spiritual-touch.de`.
2. `Code.gs` und `appsscript.json` einfügen.
3. `vorlageTesten` ausführen → Berechtigungen erlauben → Entwürfe prüfen.
4. `einrichten` ausführen (einmalig).
5. Testtermin **neu** über das Formular anlegen.
6. Wenn alles passt: `MODUS` auf `'SENDEN'` stellen.
