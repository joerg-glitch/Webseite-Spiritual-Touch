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
   `syncRaumEinladungen`, zeitgesteuert, alle 15 Minuten.

**Wie es erkennt, was ein "echter" Termin ist:** Der Hilfskalender enthält
zwei Arten von Einträgen — die eigenen Verfügbarkeits-Blocker von
`team-app/App Script - Sync` (Titel "Blockiert (Verfügbarkeit-Sync)",
intern per Tag markiert) und die echten, von Amelia geschriebenen
Termine. Das Skript überspringt die Blocker und kopiert nur den Rest.
Bereits kopierte Termine markiert es selbst (eigener Tag
`raumEinladungSync`), damit nichts doppelt landet.

## Offene Punkte

⚠️ **Mila fehlt.** In Jörgs Liste der echten Mailadressen taucht "Mila"
(`annamilena369@gmail.com`) auf, aber in keinem bisherigen Sync-Skript
(weder `team-app/App Script - Sync` noch hier) — es gibt also keine
bekannte Hilfskalender-ID für sie. Vor dem Ergänzen bei Jörg nachfragen:
Ist sie neu im Team und braucht noch einen Hilfskalender (analog zu den
anderen, siehe `team-app`-README), oder wird sie aus einem anderen Grund
bewusst anders behandelt?

⚠️ **Evas Hilfskalender ist ihr privater Gmail-Kalender**
(`eva.saur1993@gmail.com`), kein Ressourcen-Konto wie bei den anderen —
laut `team-app/App Script - Sync` ist er dort absichtlich als `inactive`
markiert ("Eva regelt ihre Verfügbarkeit direkt selbst"). Für dieses
Skript wieder aktiv aufgenommen, weil Jörgs neue Mailadressen-Liste sie
explizit enthält — aber ungeprüft, ob 1) `joerg@spiritual-touch.de`
überhaupt Lesezugriff auf ihren privaten Kalender hat (das Skript läuft
als er) und 2) Amelia dort überhaupt bestätigte Termine hineinschreibt
wie bei den anderen. Falls der erste Testlauf für sie nichts kopiert oder
einen Zugriffsfehler in den "Warnungen im Lauf"-Mails zeigt, liegt es
vermutlich daran.

⚠️ **Kein Re-Sync bei Terminänderung/-absage.** Sobald ein Termin einmal
kopiert wurde (eigener Tag gesetzt), fasst das Skript ihn nicht mehr an —
eine spätere Verschiebung oder Stornierung in Amelia aktualisiert die
Raum-1-Kopie/Einladung **nicht** automatisch. Für den ersten Wurf bewusst
so belassen (Jörgs Wunsch nach der einfachsten Lösung); bei Bedarf
später nachrüstbar (z. B. Tag durch einen Zeitstempel ersetzen und bei
`getLastUpdated()`-Änderung erneut synchronisieren).

## Echte Mailadressen (Stand 23.08.2026, von Jörg)

| Name | Mailadresse (für Kalender-Einladung) |
|---|---|
| Tara | tara.spiritual@gmail.com |
| Eva | eva.saur1993@gmail.com |
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
| Mila | annamilena369@gmail.com (siehe "Offene Punkte") |

## Sicherheit

Das Skript liest die Hilfskalender nur und markiert eigene, bereits
kopierte Termine per Tag (unsichtbares Metadatum, ändert nichts an Titel/
Beschreibung/Zeit) — echte Amelia-Termine werden nie inhaltlich verändert
oder gelöscht. Es schreibt ausschließlich neue Events in Raum 1, nie in
einen der Hilfskalender oder nach Amelia zurück.
