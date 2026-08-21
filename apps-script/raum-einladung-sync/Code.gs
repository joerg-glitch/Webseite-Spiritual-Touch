/**
 * RAUM-1-KOPIE + KALENDER-EINLADUNG FÜR ECHTE MITARBEITER-MAILADRESSEN
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (getrennt von den bestehenden
 * Verfügbarkeits-Skripten "team-app/App Script - Sync" und
 * "apps-script/anfragen-verfuegbarkeit-sync").
 *
 * Zweck: Team-Mitglieder haben keinen Zugriff auf ihren eigenen
 * Hilfskalender (den nutzt Amelia intern für Verfügbarkeit UND schreibt
 * bestätigte Termine dort hinein, sobald ein Termin einem echten
 * Mitarbeiter zugewiesen wird) und auch nicht auf die
 * anfragen+NAME@spiritual-touch.de-Mailadresse. Damit sie trotzdem
 * merken, wenn ein neuer Termin für sie bestätigt wurde, kopiert dieses
 * Skript jeden neuen (nicht von den Verfügbarkeits-Skripten selbst
 * erzeugten) Termin aus dem Hilfskalender in den Kalender "Raum 1" und
 * trägt die ECHTE persönliche Mailadresse der Person als Gast ein —
 * Google Calendar verschickt dadurch automatisch eine Einladungsmail an
 * eine Adresse, die die Person tatsächlich liest, ohne ihr Zugriff auf
 * die @spiritual-touch.de-Domain oder den Hilfskalender geben zu müssen.
 *
 * Die zweite Hälfte von Jörgs Anfrage (23.08.2026) — die Mitarbeiter-Mail,
 * die Amelia an anfragen+NAME@spiritual-touch.de schickt, weiterleiten an
 * NAME@spiritual-touch.de (landet dort automatisch im Google-Chat-Room
 * dieser Person) — braucht KEIN Skript: ein normaler Gmail-Filter im
 * anfragen@spiritual-touch.de-Postfach ("an: anfragen+NAME@spiritual-
 * touch.de" → "Weiterleiten an: NAME@spiritual-touch.de") reicht dafür
 * völlig. Siehe README in diesem Ordner für die genauen Schritte.
 *
 * EINRICHTUNG:
 * 1. Neues Apps-Script-Projekt unter script.google.com anlegen (als
 *    joerg@spiritual-touch.de — hat Zugriff auf alle unten genannten
 *    Kalender).
 * 2. Diesen Code als Code.gs einfügen.
 * 3. Einmal manuell "runSyncNow" ausführen (Run-Button) → Google fragt
 *    nach Kalender-Berechtigungen → erlauben.
 * 4. Zeitgesteuerten Trigger einrichten (Uhr-Symbol links): Funktion
 *    "syncRaumEinladungen", zeitgesteuert, "Minuten-Timer" → "Jede
 *    Minute" (schnellste verfügbare Option — damit die Kalender-
 *    Einladung praktisch zeitgleich mit Amelias eigener Mitarbeiter-Mail
 *    ankommt, siehe Jörgs Rückmeldung vom 23.08.2026: sein Team ist
 *    "nicht sehr technisch-affin" und soll bei "Mail da, Termin noch
 *    nicht im Kalender" nicht nachfragen müssen).
 * 5. Mila fehlt bewusst (keine Hilfskalender-ID bekannt, siehe README) —
 *    vor dem Ergänzen bei Jörg nachfragen.
 *
 * SICHERHEIT: Liest die Hilfskalender NUR — schreibt oder markiert dort
 * nichts mehr (siehe "Fingerabdruck-Abgleich" unten). Schreibt
 * ausschließlich in Raum 1. Braucht deshalb auch nur Lesezugriff auf die
 * Hilfskalender, nie Schreibzugriff.
 *
 * FINGERABDRUCK-ABGLEICH (26.08.2026, zweiter Fund): Wenn Jörg einer
 * Anfrage nachträglich einen anderen Mitarbeiter zuweist, löscht Amelia
 * den Termin im alten Hilfskalender und legt ihn im neuen komplett neu
 * an — neue Event-ID, kein alter Tag übernommen. Ein Tag AM Termin selbst
 * (wie ursprünglich gebaut) kann eine Umbesetzung deshalb nie erkennen.
 * Firmiert deshalb jetzt über einen Fingerabdruck aus Titel+Start+Ende
 * (`PropertiesService`, unabhängig vom jeweiligen Hilfskalender) —
 * erkennt denselben Termin auch nach einem Mitarbeiter-Wechsel wieder und
 * hängt die bestehende Raum-1-Einladung um (alten Gast raus, neuen Gast
 * rein), statt eine zweite Kopie anzulegen. Bekannte Grenze: Ändert sich
 * stattdessen Titel ODER Uhrzeit (z. B. Kunde verschiebt den Termin),
 * erkennt der Abgleich das NICHT als denselben Termin — dann bleibt eine
 * alte Raum-1-Kopie mit der alten Zeit stehen. Für den ersten Wurf bewusst
 * so belassen (Jörgs Wunsch nach der einfachsten Lösung).
 *
 * ⚠️ VORFALL 26.08.2026: Eva war anfangs mit ihrem privaten Gmail-Kalender
 * (statt einem reinen Amelia-Ressourcen-Konto) in MEMBERS enthalten. Das
 * Skript hat all ihre privaten Termine (Arzttermine, "Arbeit", Hotel-
 * Aufenthalt usw.) fälschlich als neue Amelia-Termine erkannt UND — weil
 * das ausführende Konto auf ihrem Kalender nur Lese- statt Schreibrechte
 * hatte — sie bei jedem Minuten-Lauf erneut kopiert (das Markieren als
 * "erledigt" schlug fehl). Ergebnis: hunderte doppelte
 * Kalendereinladungen. Eva wurde aus MEMBERS entfernt, `cleanupEvaMistaken
 * Copies()` ganz unten räumt die entstandenen Duplikate in einem Rutsch
 * auf. Der Umstieg auf den Fingerabdruck-Abgleich oben behebt zusätzlich
 * die eigentliche Ursache (Schreibversuch auf einen Kalender ohne
 * Schreibrechte) strukturell für jeden, nicht nur für Eva.
 */

// ---------- KONFIGURATION ----------

var RAUM1_CALENDAR_ID = 'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com';

// Name -> { Hilfskalender-ID (aus "team-app/App Script - Sync",
// MEMBERS-Liste dort), echte persönliche Mailadresse (für die
// Kalender-Einladung, von Jörg am 23.08.2026 mitgeteilt) }. Jörg
// absichtlich nicht enthalten ("analog zu allen anderen außer mir
// selbst").
var MEMBERS = [
  { name: 'Tara',       hilfsCalId: 'c_fe6664e01f568080774112156e255089ea2ea2877109d6ddb241d046ebff58fb@group.calendar.google.com', email: 'tara.spiritual@gmail.com' },
  // Eva ENTFERNT (26.08.2026, siehe README "Vorfall 26.08.2026") — ihr
  // Hilfskalender ist ihr privater Gmail-Kalender voller persönlicher
  // Termine, kein reines Amelia-Ressourcen-Konto. Nicht wieder ergänzen,
  // ohne vorher eine Filterung auf "wirklich von Amelia" zu bauen. Eva
  // kopiert ihre Termine seither selbst.
  { name: 'Asmita',     hilfsCalId: 'c_72c5bf2bb1c90f5424d77c3f1f6593cf2cf6fe05f27204ff1c73f3632350cabd@group.calendar.google.com', email: 'rositsa.bogdanova232@gmail.com' },
  { name: 'Amila',      hilfsCalId: 'c_727306d56fd4b1755718073543de922a25edc2509fcb14f2b4e53b7a9263b72a@group.calendar.google.com', email: 'uta.schuppert@gmail.com' },
  { name: 'Sarah',      hilfsCalId: 'c_d37ba1f2e4913be355bc25873d90dc9ee115b70537adfd5a6b2a5f1e98d26361@group.calendar.google.com', email: 'sarahfriedrich321@gmail.com' },
  { name: 'Dominik',    hilfsCalId: 'c_0d3ba2a1dde3033c512dfd51c12fd0bb0c23b3e41297c169c214e76ced530669@group.calendar.google.com', email: 'bimo83@t-online.de' },
  { name: 'Konstantin', hilfsCalId: 'c_459599398173cc57da9c45a996d1946f1ea0f3b057bdcb1732fd752d298ae15e@group.calendar.google.com', email: 'konstantion.dellbruegge@gmail.com' },
  { name: 'Alea',       hilfsCalId: 'c_bee7bf11c2bdae2e7d8bda28b87fd27c5f4bd3cf45124c65da06d799ae9edb7f@group.calendar.google.com', email: 'alea.tantramassage@gmail.com' },
  { name: 'Stephanie',  hilfsCalId: 'c_360bace4072d8f2356127d9b6dd12b2c45c63be5dd791f86fbc0018e00d06714@group.calendar.google.com', email: 'stephanie@primal-living.de' },
  { name: 'Karen',      hilfsCalId: 'c_1caea88007e19c7154765e9a9a3370c8f912f40a46c32145486b862d8770c0c7@group.calendar.google.com', email: 'karenzeiler24@gmail.com' },
  { name: 'Maxine',     hilfsCalId: 'c_b3600e5f62821b31ef76a82e9c9078070a0c8e9e29641463b7ae270e6871f33d@group.calendar.google.com', email: 'parampampas@yahoo.com' }
  // Mila fehlt bewusst: keine Hilfskalender-ID bekannt, taucht in keinem
  // bisherigen Sync-Skript auf. Vor dem Ergänzen bei Jörg die ID
  // erfragen (siehe README, "Offene Punkte").
];

var SYNC_DAYS_AHEAD = 90; // gleicher Vorlauf wie das Buchungs-Dashboard

// Präfix für die Fingerabdruck-Einträge in PropertiesService — siehe
// Datei-Header "FINGERABDRUCK-ABGLEICH".
var FINGERPRINT_PREFIX = 'raumSync_';

// Aus "team-app/App Script - Sync" — dieselben Marker, um dessen eigene
// Verfügbarkeits-Blocker sicher zu erkennen und zu überspringen.
var TEAM_APP_BLOCK_TAG_KEY = 'autoBlock';
var TEAM_APP_BLOCK_TAG_VALUE = 'true';
var TEAM_APP_BLOCK_TITLE = 'Blockiert (Verfügbarkeit-Sync)';

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// ---------- HAUPTFUNKTION (Trigger: jede Minute) ----------

function syncRaumEinladungen() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Ein anderer Lauf ist bereits aktiv – übersprungen.');
    return;
  }
  try {
    var raum1 = CalendarApp.getCalendarById(RAUM1_CALENDAR_ID);
    if (!raum1) {
      throw new Error('Raum-1-Kalender nicht gefunden/kein Zugriff: ' + RAUM1_CALENDAR_ID);
    }

    var props = PropertiesService.getScriptProperties();
    var now = new Date();
    var horizonEnd = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    var copied = 0;
    var reassigned = 0;
    var errors = [];

    MEMBERS.forEach(function (member) {
      var helperCal = CalendarApp.getCalendarById(member.hilfsCalId);
      if (!helperCal) {
        errors.push(member.name + ': Hilfskalender nicht gefunden/kein Zugriff (' + member.hilfsCalId + ')');
        return;
      }

      var events = helperCal.getEvents(now, horizonEnd);
      events.forEach(function (e) {
        try {
          if (isTeamAppBlock(e)) return; // Verfügbarkeits-Blocker, kein echter Termin

          var key = fingerprintKey_(e.getTitle(), e.getStartTime(), e.getEndTime());
          var stored = props.getProperty(key);

          if (!stored) {
            // Noch nie gesehen -> neu nach Raum 1 kopieren.
            var newCopy = raum1.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime(), {
              description: e.getDescription(),
              location: e.getLocation(),
              guests: member.email,
              sendInvites: true,
            });
            props.setProperty(key, JSON.stringify({
              raum1EventId: newCopy.getId(),
              member: member.name,
              email: member.email,
              start: e.getStartTime().toISOString(),
            }));
            copied++;
            Logger.log('Kopiert für ' + member.name + ': "' + e.getTitle() + '" am ' + e.getStartTime());
            return;
          }

          var data = JSON.parse(stored);
          if (data.member === member.name) return; // schon bekannt, gleicher Mitarbeiter -> nichts zu tun

          // Derselbe Termin (gleicher Titel+Zeit), aber ein anderer
          // Mitarbeiter als beim letzten Mal -> Umbesetzung. Bestehende
          // Raum-1-Einladung umhängen statt eine zweite anzulegen.
          var raum1Event = CalendarApp.getEventById(data.raum1EventId);
          if (!raum1Event) {
            // Kopie existiert nicht mehr (z. B. manuell gelöscht) -> neu anlegen.
            raum1Event = raum1.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime(), {
              description: e.getDescription(),
              location: e.getLocation(),
              guests: member.email,
              sendInvites: true,
            });
          } else {
            try {
              raum1Event.removeGuest(data.email);
            } catch (rmErr) {
              // Gast evtl. schon entfernt/nie erfolgreich hinzugefügt — kein Abbruch.
            }
            raum1Event.addGuest(member.email);
          }
          props.setProperty(key, JSON.stringify({
            raum1EventId: raum1Event.getId(),
            member: member.name,
            email: member.email,
            start: e.getStartTime().toISOString(),
          }));
          reassigned++;
          Logger.log('Umbesetzt: "' + e.getTitle() + '" am ' + e.getStartTime() + ' — ' + data.member + ' -> ' + member.name);
        } catch (evErr) {
          errors.push(member.name + ' / Termin "' + e.getTitle() + '": ' + evErr.message);
        }
      });
    });

    var prunedCount = pruneOldFingerprints_(props, now);

    Logger.log(copied + ' neu kopiert, ' + reassigned + ' umbesetzt, ' + prunedCount + ' alte Einträge aufgeräumt.');
    if (errors.length > 0) {
      sendAlert('Warnungen im Lauf', errors.join('\n'));
    }
  } catch (err) {
    sendAlert('Fehler im Lauf', err.message + '\n\n' + err.stack);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// Baut aus Titel+Start+Ende einen kompakten, stabilen Schlüssel für
// PropertiesService (MD5, weil Property-Keys kurz und aus unbedenklichen
// Zeichen bestehen müssen). Bewusst NICHT die Event-ID verwendet, weil
// Amelia bei einer Mitarbeiter-Umbesetzung ein komplett neues Event mit
// neuer ID anlegt — der Fingerabdruck aus Titel+Zeit bleibt dabei gleich.
function fingerprintKey_(title, start, end) {
  var raw = title + '|' + start.toISOString() + '|' + end.toISOString();
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  var hex = digestBytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return FINGERPRINT_PREFIX + hex;
}

// Entfernt Fingerabdruck-Einträge, deren Termin mehr als einen Tag in der
// Vergangenheit liegt — verhindert, dass PropertiesService (Limit: 500
// Einträge / 9 KB pro Wert / 500 KB insgesamt) über die Zeit unbegrenzt
// vollläuft.
function pruneOldFingerprints_(props, now) {
  var cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var all = props.getProperties();
  var pruned = 0;
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(FINGERPRINT_PREFIX) !== 0) return;
    try {
      var data = JSON.parse(all[key]);
      if (data.start && new Date(data.start) < cutoff) {
        props.deleteProperty(key);
        pruned++;
      }
    } catch (parseErr) {
      // Unlesbarer Alteintrag (z. B. vom alten Tag-basierten Format) -> löschen.
      props.deleteProperty(key);
      pruned++;
    }
  });
  return pruned;
}

// Manueller Testlauf (Run-Button im Editor) — identisch zu syncRaumEinladungen.
function runSyncNow() {
  syncRaumEinladungen();
}

function isTeamAppBlock(e) {
  if (e.getTag(TEAM_APP_BLOCK_TAG_KEY) === TEAM_APP_BLOCK_TAG_VALUE) return true;
  if (e.getTitle() === TEAM_APP_BLOCK_TITLE) return true;
  var desc = e.getDescription() || '';
  return desc.indexOf('autoBlock:true') > -1; // alte, vor der Tag-Umstellung erzeugte Blocker
}

// ---------- EINMALIGE AUFRÄUM-FUNKTION (Vorfall 26.08.2026) ----------
//
// Löscht alle Termine in Raum 1, bei denen die angegebene Mailadresse als
// Gast eingetragen ist — lässt alle anderen (echten) Raum-1-Termine
// unangetastet. Für den Vorfall vom 26.08.2026 gebaut (Evas privater
// Kalender wurde fälschlich als Quelle verwendet, siehe README), aber
// allgemein nutzbar für jede Adresse.
//
// VORAUSSETZUNG: Im Editor links unter "Dienste" (+) einmalig die
// "Calendar API" als erweiterten Dienst hinzufügen — nur damit lässt sich
// beim Löschen sendUpdates:'none' setzen. Ohne das würde Google Calendar
// für jeden gelöschten Termin eine Absage-Mail an alle Gäste verschicken
// — also noch mehr Mails an Eva und dich obendrauf auf die
// versehentlichen Einladungen.
//
// AUSFÜHREN: Im Editor die Funktion "cleanupEvaMistakenCopies" auswählen
// und ▶ klicken. Prüft/löscht in einem Rutsch, keine Einzelklicks nötig.
function cleanupRaum1EventsForGuest_(guestEmail) {
  var pageToken = null;
  var checked = 0;
  var deleted = 0;
  do {
    var response = Calendar.Events.list(RAUM1_CALENDAR_ID, {
      pageToken: pageToken,
      maxResults: 2500,
      singleEvents: true,
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
    });
    var items = response.items || [];
    items.forEach(function (ev) {
      checked++;
      var attendees = ev.attendees || [];
      var matches = attendees.some(function (a) {
        return a.email && a.email.toLowerCase() === guestEmail.toLowerCase();
      });
      if (matches) {
        Calendar.Events.remove(RAUM1_CALENDAR_ID, ev.id, { sendUpdates: 'none' });
        deleted++;
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  var summary = checked + ' Termine in Raum 1 geprüft, ' + deleted + ' mit Gast ' + guestEmail + ' gelöscht (ohne Benachrichtigung).';
  Logger.log(summary);
  sendAlert('Aufräumen abgeschlossen', summary);
}

function cleanupEvaMistakenCopies() {
  cleanupRaum1EventsForGuest_('eva.saur1993@gmail.com');
}

function sendAlert(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Raum-Einladung-Sync: ' + subject, body);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
