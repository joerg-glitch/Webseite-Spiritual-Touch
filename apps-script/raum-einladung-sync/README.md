# Raum-1-Kopie + Kalender-Einladung an echte Mitarbeiter-Mails

Zusatz-Automatik zum bestehenden Buchungssystem (23.08.2026, Jörgs Idee).
Löst zwei Probleme, die entstehen, weil das Team **keinen** Zugriff auf die
@spiritual-touch.de-Mail-Domain oder die internen Hilfskalender hat/haben
soll:

1. Amelia benachrichtigt einen zugewiesenen Mitarbeiter per Mail an
   `anfragen+NAME@spiritual-touch.de` — landet aber nur im gemeinsamen
   `anfragen@`-Postfach, das das Team nicht sieht.
2. Der bestätigte Termin landet im persönlichen Hilfskalender der Person
   (`NAME@spiritual-touch.de`, siehe `team-app/App Script - Sync`) — auch
   darauf hat das Team keinen Zugriff.

Bisher hat Jörg deshalb manuell "du hast einen neuen Termin" in den
Google-Chat-Room der Person geschrieben. Diese Automatik ersetzt das.

## Zwei Teile — nur einer davon braucht Code

### Teil 1: Mitarbeiter-Mail weiterleiten (kein Skript nötig)

Jedes Teammitglied hat einen eigenen Google-Chat-Room mit eigener
Mailadresse (`NAME@spiritual-touch.de`) — eine Mail dorthin landet
automatisch im jeweiligen Chat-Room, ganz ohne dass die Person Zugriff auf
die Mail-Domain braucht.

**Einrichtung** (im `anfragen@spiritual-touch.de`-Postfach, einmal pro
Person, z. B. für Asmita):

1. Gmail → Einstellungen → Filter und blockierte Adressen → Neuen Filter
   erstellen.
2. "An" = `anfragen+asmita@spiritual-touch.de`.
3. Weiter → "Weiterleiten an" → `Asmita@spiritual-touch.de` auswählen
   (ggf. vorher als Weiterleitungsadresse bestätigen, falls Gmail das für
   Erstverknüpfung verlangt).
4. Filter erstellen. Für jede Person wiederholen (Liste unten).

### Teil 2: Termin-Kopie nach Raum 1 + Kalender-Einladung (Code.gs)

Kopiert jeden neuen, echten Termin aus dem Hilfskalender einer Person in
den Kalender "Raum 1" und trägt ihre **echte** persönliche Mailadresse als
Gast ein — Google Calendar verschickt daraufhin automatisch eine
Einladungsmail. So bekommt die Person eine Kalender-Einladung an eine
Adresse, die sie tatsächlich liest, ohne dass sie Zugriff auf den
internen Hilfskalender braucht.

**Einrichtung:**

1. Neues Projekt unter [script.google.com](https://script.google.com)
   anlegen, eingeloggt als `joerg@spiritual-touch.de` (hat Zugriff auf
   Raum 1 und alle Hilfskalender).
2. Inhalt von `Code.gs` einfügen.
3. Einmal manuell "runSyncNow" ausführen (▶-Button) → Google fragt nach
   Kalender-Berechtigungen → erlauben.
4. Zeitgesteuerten Trigger einrichten (Uhr-Symbol links): Funktion
   `syncRaumEinladungen`, zeitgesteuert, "Minuten-Timer" → **"Jede
   Minute"** (schnellste verfügbare Option) — damit die Kalender-
   Einladung praktisch zeitgleich mit Amelias Mitarbeiter-Mail ankommt
   und niemand im Team nachfragen muss, wo der Termin bleibt.

**Wie es erkennt, was ein "echter" Termin ist:** Der Hilfskalender enthält
zwei Arten von Einträgen — die eigenen Verfügbarkeits-Blocker von
`team-app/App Script - Sync` (Titel "Blockiert (Verfügbarkeit-Sync)",
intern per Tag markiert) und die echten, von Amelia geschriebenen
Termine. Das Skript überspringt die Blocker und kopiert nur den Rest.

**Wie es Duplikate verhindert (auch bei Mitarbeiter-Wechsel):** Statt den
Quell-Termin selbst zu markieren (das ist der 26.08.2026-Vorfall, siehe
unten), merkt sich das Skript einen Fingerabdruck aus Titel+Start+Ende
in `PropertiesService` — unabhängig davon, in welchem Hilfskalender der
Termin gerade steht. Weist Jörg einer Anfrage nachträglich einen anderen
Mitarbeiter zu, verschiebt Amelia den Termin dadurch faktisch vom alten
in den neuen Hilfskalender (neue Event-ID, aber gleicher Titel+gleiche
Zeit) — das Skript erkennt das am Fingerabdruck wieder und hängt die
bestehende Raum-1-Einladung um (alten Mitarbeiter als Gast raus, neuen
rein), statt eine zweite Kopie anzulegen.

## ⚠️ Vorfall 26.08.2026: hunderte Duplikate bei Eva

Eva war anfangs (mit ihrem privaten Gmail-Kalender statt einem reinen
Amelia-Ressourcen-Konto) in `MEMBERS` enthalten. Zwei Probleme kamen
zusammen:

1. Ihr Kalender enthält ihr **ganzes Leben** (Arzttermine, "Arbeit",
   Hotel-Aufenthalt usw.), nicht nur Amelia-Termine — das Skript hat all
   das fälschlich als neue Termine erkannt.
2. Das ausführende Konto (`joerg@spiritual-touch.de`) hat auf ihrem
   privaten Kalender nur Lese-, keine Schreibrechte — das Markieren
   "schon kopiert" (`setTag`) schlug deshalb jedes Mal mit "Action not
   allowed" fehl. Weil das Kopieren VOR dem Markieren passierte, hat sie
   dadurch jede Minute erneut dieselben Termine kopiert bekommen —
   hunderte doppelte Kalendereinladungen in Raum 1.

**Behoben:**
- Eva aus `MEMBERS` entfernt (sie kopiert ihre Termine seither selbst).
- Strukturell behoben (26.08.2026, zweiter Fund): Statt den Quell-Termin
  selbst zu markieren (brauchte Schreibrechte auf dem Hilfskalender — bei
  Eva nicht vorhanden, daher die Endlosschleife), merkt sich das Skript
  jetzt einen Fingerabdruck in `PropertiesService` und **liest** die
  Hilfskalender nur noch. Kann bei niemandem mehr passieren, selbst wenn
  irgendwann bei jemand anderem nur Lesezugriff besteht.
- Neue Funktion `cleanupEvaMistakenCopies()` in `Code.gs` — löscht alle
  Duplikate in Raum 1 in einem Rutsch, ohne Absage-Mails zu verschicken.
  Braucht einmalig die "Calendar API" als erweiterten Dienst (Editor →
  Dienste (+) → "Calendar API" hinzufügen), dann im Editor die Funktion
  auswählen und ▶ klicken.

## Offene Punkte

✅ **Mila** ist neu im Team und hat noch keinen Hilfskalender —
absichtlich außen vor gelassen, bis das analog zu den anderen (siehe
`team-app`-README) eingerichtet ist. Dann hier in `MEMBERS` ergänzen.

✅ **Mitarbeiter-Wechsel** (23./26.08.2026 von Jörg angefragt) wird
erkannt: Wird einer Anfrage nachträglich ein anderer Mitarbeiter
zugewiesen, hängt das Skript die bestehende Raum-1-Einladung um, statt
eine zweite anzulegen (siehe "Wie es Duplikate verhindert" oben).

⚠️ **Kein Re-Sync bei Terminänderung/-absage, wenn sich Titel ODER
Uhrzeit ändern** (z. B. Kunde verschiebt den Termin). Der
Fingerabdruck-Abgleich erkennt eine Umbesetzung (gleicher Titel+Zeit,
anderer Mitarbeiter), aber nicht mehr, wenn sich auch Titel oder Uhrzeit
ändern — dann bleibt eine alte Raum-1-Kopie mit der alten Zeit stehen.
Für den ersten Wurf bewusst so belassen (Jörgs Wunsch nach der
einfachsten Lösung); bei Bedarf später nachrüstbar (bräuchte eine
Amelia-eigene Termin-ID im Titel/Beschreibung als stabilen Anker statt
Titel+Zeit).

## Echte Mailadressen (Stand 23.08.2026, von Jörg)

| Name | Mailadresse (für Kalender-Einladung) |
|---|---|
| Tara | tara.spiritual@gmail.com |
| Eva | eva.saur1993@gmail.com (seit 26.08.2026 **nicht** in `MEMBERS`, siehe "Vorfall" oben — kopiert ihre Termine selbst) |
| Jörg | joerg@spiritual-touch.de (nicht Teil dieser Automatik) |
| Asmita | rositsa.bogdanova232@gmail.com |
| Amila | uta.schuppert@gmail.com |
| Sarah | sarahfriedrich321@gmail.com |
| Dominik | bimo83@t-online.de |
| Konstantin | konstantion.dellbruegge@gmail.com |
| Alea | alea.tantramassage@gmail.com |
| Stephanie | stephanie@primal-living.de |
| Karen | karenzeiler24@gmail.com |
| Maxine | parampampas@yahoo.com |
| Mila | annamilena369@gmail.com (noch nicht in `MEMBERS`, siehe "Offene Punkte") |

## Sicherheit

Das Skript **liest** die Hilfskalender nur — schreibt oder markiert dort
nichts (seit dem Umstieg auf den Fingerabdruck-Abgleich am 26.08.2026,
siehe oben). Echte Amelia-Termine werden nie inhaltlich verändert oder
gelöscht. Es schreibt ausschließlich in Raum 1 (neue Events, oder
Gästeliste bestehender Events bei einer erkannten Umbesetzung), nie in
einen der Hilfskalender oder nach Amelia zurück. Braucht deshalb für die
Hilfskalender nur Lesezugriff, keinen Schreibzugriff mehr.
