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
 * 5. Siehe README, "Offene Punkte" — Mila (keine Hilfskalender-ID
 *    bekannt) und Eva (privater Gmail-Kalender statt Ressourcen-Konto,
 *    Lesezugriff für dieses Skript noch nicht bestätigt) vor dem
 *    produktiven Einsatz klären.
 *
 * SICHERHEIT: Fasst in den Hilfskalendern NUR Termine an, die es selbst
 * per Tag "raumEinladungSync"="true" markiert (nach dem Kopieren, nie
 * vorher) — echte Amelia-Termine werden nie inhaltlich verändert oder
 * gelöscht, nur gelesen und markiert.
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
  { name: 'Eva',        hilfsCalId: 'eva.saur1993@gmail.com', email: 'eva.saur1993@gmail.com' }, // ihr privater Kalender, kein Ressourcen-Konto — von Jörg bestätigt: Amelia schreibt dort trotzdem hin
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

var OWN_TAG_KEY = 'raumEinladungSync';
var OWN_TAG_VALUE = 'true';

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

    var now = new Date();
    var horizonEnd = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    var copied = 0;
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
          if (e.getTag(OWN_TAG_KEY) === OWN_TAG_VALUE) return; // schon kopiert

          raum1.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime(), {
            description: e.getDescription(),
            location: e.getLocation(),
            guests: member.email,
            sendInvites: true,
          });
          e.setTag(OWN_TAG_KEY, OWN_TAG_VALUE);
          copied++;
          Logger.log('Kopiert für ' + member.name + ': "' + e.getTitle() + '" am ' + e.getStartTime());
        } catch (evErr) {
          errors.push(member.name + ' / Termin "' + e.getTitle() + '": ' + evErr.message);
        }
      });
    });

    Logger.log(copied + ' Termin(e) nach Raum 1 kopiert.');
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

function sendAlert(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Raum-Einladung-Sync: ' + subject, body);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
