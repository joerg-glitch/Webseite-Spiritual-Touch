/**
 * ERWEITERUNGEN ZUR TERMINBESTÄTIGUNG
 * ======================================================================
 * Zweite Datei im selben Apps-Script-Projekt wie Code.gs (teilt dessen
 * Konfiguration und Hilfsfunktionen). Vier Bausteine, jeder einzeln
 * ein-/ausschaltbar über FUNKTIONEN unten. AUSGELIEFERT ALLES AUS: solange
 * alle Schalter auf false stehen, tut diese Datei nichts.
 *
 *  1. team        Info-Mail an die Begleitung (NAME@spiritual-touch.de),
 *                 gleichzeitig zur Kundenbestätigung. Ausnahme: TEAM_OHNE_MAIL
 *                 (Jörg selbst).
 *  2. erinnerung  Erinnerung an den Kunden ca. 24 h vor dem Termin.
 *  3. feedback    Feedback-Anfrage an den Kunden 3 Tage nach dem Termin.
 *  4. kontaktlog  Jeder Kontakt (Bestätigung, Team-Info, Erinnerung,
 *                 Feedback) wird als Zeile in einer Google-Tabelle
 *                 protokolliert ("Kundendatenbank").
 *
 * GEMEINSAMES PRINZIP (wie in Code.gs): Alles hängt am Termin im
 * Raumkalender und an unsichtbaren Markierungen (CalendarEvent.setTag).
 * Jeder Schritt wird erst markiert, dann ausgeführt; scheitert die
 * Markierung, passiert nichts; scheitert die Ausführung, wird die
 * Markierung entfernt und der nächste Lauf versucht es erneut (Fehlermail
 * höchstens alle 6 h je Termin).
 *
 *  - Nur Termine, die Code.gs bestätigt hat (Markierung "bestaetigung").
 *    Altbestand und Termine ohne Bestätigung bleiben unberührt.
 *  - Löschst Du den Termin im Raumkalender (Absage), entfallen Erinnerung
 *    und Feedback automatisch.
 *  - Verschiebst Du den Termin: Erinnerung und Feedback richten sich nach
 *    der neuen Zeit, solange sie noch nicht gesendet wurden. Eine bereits
 *    gesendete Erinnerung wird nicht wiederholt.
 *  - Kunden-Mails (Erinnerung/Feedback) gehen nur zwischen RUHEZEIT_BIS und
 *    RUHEZEIT_VON Uhr raus (Standard 8–21 Uhr).
 *  - Beim ersten Einschalten merkt sich das Skript den Zeitpunkt (Script
 *    Properties AKTIV_<funktion>): Team-Info und Kontaktverlauf gelten nur
 *    für Termine, die DANACH bestätigt wurden; Feedback nur für Termine,
 *    die DANACH enden. Nichts wird rückwirkend verschickt.
 *  - MODUS aus Code.gs gilt auch hier: 'ENTWURF' legt alles nur als
 *    Gmail-Entwurf an.
 *
 * VORAB PRÜFEN (ohne etwas zu senden): "trockenlauf" ausführen und im
 * Ausführungsprotokoll nachlesen, was passieren WÜRDE. "erweiterungenTesten"
 * legt Beispiel-Entwürfe für alle Mails an.
 */

// ---------- KONFIGURATION ----------

// Schalter. Ein Baustein nach dem anderen einschalten, jeweils mit
// MODUS 'ENTWURF' (Code.gs) beginnen.
var FUNKTIONEN = {
  team: false,
  erinnerung: false,
  feedback: false,
  kontaktlog: false,
};

// Team-Adressen: Vorname kleingeschrieben @ TEAM_DOMAIN (Google-Chat-Räume,
// siehe apps-script/raum-einladung-sync/README.md, Teil 1).
var TEAM_DOMAIN = 'spiritual-touch.de';
var TEAM_OHNE_MAIL = ['Jörg'];            // bekommen keine Team-Info
var TEAM_MAIL_AUSNAHMEN = {};             // z. B. { 'Mila': 'annamilena@…' }, falls abweichend

var VORLAGEN_ERINNERUNG = {
  de: { docId: '10yp5r67Mffy7UD6BJYP1C8FlRUvbZSsVmZHpvdB-9w4', betreff: 'Erinnerung an Deinen Termin' },
  en: { docId: '1A_IivOj9RRp0Z0GwFysH6udeay9F-nSR4EMPdsONcU4', betreff: 'Reminder: your appointment' },
};
var VORLAGEN_FEEDBACK = {
  de: { docId: '1eBWS5r0MvlD8SNrD1XS9KEYgwTEh0R9xeimYKo0CoZk', betreff: 'Wie war Dein Termin?' },
  en: { docId: '1UFzeWprIcdIjVniEP74XL3mlCKaqnZX3DCH14WuMlHc', betreff: 'How was your appointment?' },
};

// Optional: Link für Bewertungen/Feedback. Gilt für den Platzhalter
// {{FeedbackLink}} in den Docs (leer = nichts einsetzen).
var FEEDBACK_LINK = '';

var ERINNERUNG_VORLAUF_H = 24;     // Erinnerung ab 24 h vor Beginn …
var ERINNERUNG_MIN_VORLAUF_H = 4;  // … aber nicht mehr, wenn der Termin in weniger als 4 h beginnt
var FEEDBACK_NACH_H = 72;          // Feedback-Anfrage 3 Tage nach dem ENDE des Termins …
var FEEDBACK_MAX_ALTER_TAGE = 7;   // … später als 7 Tage danach nicht mehr
var RUHEZEIT_VON = 21;             // ab 21:00 keine Erinnerung/Feedback …
var RUHEZEIT_BIS = 8;              // … bis 08:00
var ZUSATZ_RUECKSCHAU_TAGE = 8;    // so weit zurück werden Termine für Feedback gesucht

var KONTAKT_TABELLE_NAME = 'Spiritual Touch – Kundenkontakte';
var KONTAKT_SPALTEN = ['Zeit', 'Ereignis', 'Kunde', 'E-Mail', 'Telefon', 'Sprache', 'Termin', 'Uhrzeit',
                       'Begleitung', 'Raum', 'Dauer', 'Preis', 'Modus', 'Termin-ID', 'Notiz'];

var TAG_TEAM = 'team';
var TAG_ERINNERUNG = 'erinnerung';
var TAG_FEEDBACK = 'feedback';
var TAG_KONTAKTLOG = 'log_bestaetigung';

// ---------- HAUPTSCHRITT (wird am Ende von bestaetigungenVersenden aufgerufen) ----------

function zusatzschritte_(trocken) {
  var aktiv = funktionenAktiv_(trocken);
  if (!aktiv.team && !aktiv.erinnerung && !aktiv.feedback && !aktiv.kontaktlog) return;

  var jetzt = Date.now();
  var von = new Date(jetzt - ZUSATZ_RUECKSCHAU_TAGE * 24 * 60 * 60 * 1000);
  var bis = new Date(jetzt + SCAN_TAGE_VORAUS * 24 * 60 * 60 * 1000);

  RAUM_KALENDER.forEach(function (raum) {
    var kalender = CalendarApp.getCalendarById(raum.id);
    if (!kalender) return; // meldet bestaetigungenVersenden bereits
    kalender.getEvents(von, bis).forEach(function (ev) {
      try {
        zusatzFuerTermin_(ev, raum.name, jetzt, aktiv, trocken);
      } catch (err) {
        meldeFehler_('zusatz-' + ev.getId(), 'Zusatzschritt fehlgeschlagen',
          raum.name + ': "' + ev.getTitle() + '" am ' + formatDatum_(ev.getStartTime(), 'de') +
          '\n\n' + err.message + '\n\nNächster Lauf versucht es automatisch erneut.');
      }
    });
  });
}

function zusatzFuerTermin_(ev, raumName, jetzt, aktiv, trocken) {
  if (ev.isAllDayEvent()) return;
  var bestTag = ev.getTag(TAG_KEY);
  if (bestTag !== 'gesendet' && bestTag !== 'entwurf') return; // nur bestätigte Termine

  var termin = leseTermin_(ev);
  if (!termin) return;
  var gast = leseGast_(ev);
  var bestaetigtAm = Number(ev.getTag('bestaetigt_am') || 0);
  var start = termin.start.getTime();
  var ende = ev.getEndTime().getTime();

  function protokoll(ereignis) {
    if (aktiv.kontaktlog && !trocken) protokolliere_(ereignis, termin, gast, raumName, ev);
  }

  // Jeder Schritt läuft für sich: Ein Fehler (z. B. Tabelle nicht erreichbar)
  // darf die anderen Schritte desselben Termins nicht blockieren.
  function isoliert(name, fn) {
    try {
      fn();
    } catch (err) {
      meldeFehler_('zusatz-' + name + '-' + ev.getId(), name + ' fehlgeschlagen',
        raumName + ': "' + ev.getTitle() + '" am ' + formatDatum_(termin.start, 'de') + '\n\n' + err.message +
        '\n\nNächster Lauf versucht es automatisch erneut.');
    }
  }

  // 4a. Bestätigung im Kontaktverlauf festhalten (nur nach dem Einschalten bestätigte Termine)
  if (aktiv.kontaktlog && bestaetigtAm && bestaetigtAm >= aktiv.kontaktlog) {
    isoliert('Kontaktverlauf', function () {
      schritt_(ev, TAG_KONTAKTLOG, trocken, 'Kontaktverlauf: Bestätigung', function () {
        kontaktZeile_('Bestätigung', termin, gast, raumName, ev);
      });
    });
  }

  // 1. Team-Info an die Begleitung
  if (aktiv.team && bestaetigtAm && bestaetigtAm >= aktiv.team &&
      TEAM_OHNE_MAIL.indexOf(termin.begleitung) < 0) {
    var adresse = teamAdresse_(termin.begleitung);
    isoliert('Team-Info', function () {
      var gesendet = schritt_(ev, TAG_TEAM, trocken, 'Team-Info an ' + adresse, function () {
        sendeIntern_(adresse, teamBetreff_(termin), teamText_(termin, gast, raumName));
      });
      if (gesendet) protokoll('Team-Info');
    });
  }

  // 2. Erinnerung ca. 24 h vorher
  var vorlaufH = (start - jetzt) / 36e5;
  if (aktiv.erinnerung && vorlaufH <= ERINNERUNG_VORLAUF_H && vorlaufH >= ERINNERUNG_MIN_VORLAUF_H &&
      !inRuhezeit_(jetzt) &&
      !(bestaetigtAm && bestaetigtAm > start - ERINNERUNG_VORLAUF_H * 36e5)) { // erst kurz vorher bestätigt → keine zweite Mail
    isoliert('Erinnerung', function () {
      var gesendetE = schritt_(ev, TAG_ERINNERUNG, trocken, 'Erinnerung an ' + termin.email, function () {
        sendeKundenmail_(termin, VORLAGEN_ERINNERUNG[termin.sprache]);
      });
      if (gesendetE) protokoll('Erinnerung');
    });
  }

  // 3. Feedback 3 Tage nach dem Ende
  var seitEnde = jetzt - ende;
  if (aktiv.feedback && seitEnde >= FEEDBACK_NACH_H * 36e5 && seitEnde <= FEEDBACK_MAX_ALTER_TAGE * 24 * 36e5 &&
      ende >= aktiv.feedback && !inRuhezeit_(jetzt)) {
    isoliert('Feedback-Anfrage', function () {
      var gesendetF = schritt_(ev, TAG_FEEDBACK, trocken, 'Feedback-Anfrage an ' + termin.email, function () {
        sendeKundenmail_(termin, VORLAGEN_FEEDBACK[termin.sprache]);
      });
      if (gesendetF) protokoll('Feedback-Anfrage');
    });
  }
}

// Führt aktion() genau einmal je Termin und Markierung aus. Gibt true zurück,
// wenn sie ausgeführt wurde.
function schritt_(ev, tagKey, trocken, beschreibung, aktion) {
  if (ev.getTag(tagKey)) return false;
  if (trocken) {
    Logger.log('[Trockenlauf] würde ausführen: ' + beschreibung + ' – "' + ev.getTitle() + '" am ' +
      formatDatum_(ev.getStartTime(), 'de') + ' ' + formatUhrzeit_(ev.getStartTime()));
    return false;
  }
  ev.setTag(tagKey, 'in-arbeit');
  if (ev.getTag(tagKey) !== 'in-arbeit') {
    throw new Error('Markierung am Termin konnte nicht gespeichert werden – nichts ausgeführt (' + beschreibung + ').');
  }
  try {
    aktion();
  } catch (err) {
    ev.deleteTag(tagKey);
    throw err;
  }
  ev.setTag(tagKey, MODUS === 'SENDEN' ? 'gesendet' : 'entwurf');
  Logger.log((MODUS === 'SENDEN' ? 'Ausgeführt: ' : 'Entwurf: ') + beschreibung);
  return true;
}

// Welche Bausteine laufen, und seit wann? Beim ersten Einschalten wird der
// Zeitpunkt gespeichert (im Trockenlauf nicht, dort gelten alle als an).
function funktionenAktiv_(trocken) {
  var props = PropertiesService.getScriptProperties();
  var aktiv = {};
  Object.keys(FUNKTIONEN).forEach(function (name) {
    if (!FUNKTIONEN[name] && !trocken) return;
    var key = 'AKTIV_' + name;
    var wert = props.getProperty(key);
    if (!wert) {
      wert = String(Date.now());
      if (!trocken) props.setProperty(key, wert);
    }
    aktiv[name] = Number(wert);
  });
  return aktiv;
}

function inRuhezeit_(jetztMs) {
  var stunde = Number(Utilities.formatDate(new Date(jetztMs), TIMEZONE, 'H'));
  return stunde >= RUHEZEIT_VON || stunde < RUHEZEIT_BIS;
}

// ---------- KUNDEN-MAILS (Erinnerung, Feedback) ----------

function werteErweitert_(termin) {
  var werte = werteFuerVorlage_(termin);
  werte['{{FeedbackLink}}'] = FEEDBACK_LINK;
  return werte;
}

function sendeKundenmail_(termin, vorlage) {
  var inhalt = rendereVorlage_(werteErweitert_(termin), vorlage.docId);
  sende_(termin.email, vorlage.betreff, inhalt);
}

// ---------- TEAM-INFO ----------

function teamAdresse_(begleitung) {
  return TEAM_MAIL_AUSNAHMEN[begleitung] || (begleitung.toLowerCase() + '@' + TEAM_DOMAIN);
}

function teamBetreff_(termin) {
  return 'Neuer Termin: ' + formatDatum_(termin.start, 'de') + ', ' + formatUhrzeit_(termin.start) + ' Uhr – ' + termin.name;
}

function teamText_(termin, gast, raumName) {
  var zeilen = [
    'Hallo ' + termin.begleitung + ',',
    '',
    'Dir wurde ein Termin zugewiesen. Der Gast hat die Bestätigung bereits bekommen.',
    '',
    'Datum: ' + formatDatum_(termin.start, 'de') + ' um ' + formatUhrzeit_(termin.start) + ' Uhr',
    'Raum: ' + raumName,
    'Dauer: ' + termin.dauer,
    'Honorar: ' + termin.preis,
    '',
    'Gast: ' + termin.name,
  ];
  if (gast.telefon) zeilen.push('Mobilnummer: ' + gast.telefon);
  zeilen.push('E-Mail: ' + termin.email);
  zeilen.push('Sprache: ' + (termin.sprache === 'en' ? 'English' : 'Deutsch'));
  if (gast.begleitungArt) zeilen.push('Gewünscht: ' + gast.begleitungArt);
  if (gast.wunschperson) zeilen.push('Wunschbegleitung: ' + gast.wunschperson);
  if (gast.alternativen) zeilen.push('Alternativen: ' + gast.alternativen);
  if (gast.nachricht) zeilen.push('Nachricht des Gastes: ' + gast.nachricht);
  zeilen.push('', 'Bitte melde Dich in Kürze beim Gast und stimme die letzten Details ab.');
  return zeilen.join('\n');
}

// Interne Mail: Entwurf oder Versand, je nach MODUS (Code.gs).
function sendeIntern_(an, betreff, text) {
  if (MODUS === 'SENDEN') {
    GmailApp.sendEmail(an, betreff, text, { name: ABSENDER_NAME });
  } else {
    GmailApp.createDraft(an, betreff, text, { name: ABSENDER_NAME });
  }
}

// Zusätzliche Gastdaten aus der Beschreibung (Telefon, Wünsche, Nachricht).
function leseGast_(ev) {
  var text = beschreibungAlsText_(ev.getDescription());
  var gastPos = text.search(/Gastdaten:/i);
  var kopf = gastPos < 0 ? text : text.substring(0, gastPos);
  var gastBlock = gastPos < 0 ? '' : text.substring(gastPos);
  var nachricht = '';
  var nachrichtPos = gastBlock.search(/^[ \t]*Nachricht:/mi);
  if (nachrichtPos >= 0) {
    nachricht = gastBlock.substring(nachrichtPos).replace(/^[ \t]*Nachricht:[ \t]*/i, '').trim().substring(0, 1000);
    gastBlock = gastBlock.substring(0, nachrichtPos);
  }
  function zeile(block, label) {
    var m = block.match(new RegExp('^[ \\t]*' + label + ':[ \\t]*(.+)$', 'mi'));
    return m ? m[1].trim() : '';
  }
  return {
    telefon: zeile(gastBlock, 'Mobilnummer'),
    begleitungArt: zeile(kopf, 'Begleitung'),   // z. B. "einem Masseur (a male masseur)"
    wunschperson: zeile(kopf, 'Wunsch'),        // z. B. "Alea"
    alternativen: zeile(kopf, 'Alternativen'),
    nachricht: nachricht,
  };
}

// ---------- KONTAKTVERLAUF (Google-Tabelle) ----------

// Legt die Tabelle an (falls noch nicht vorhanden) und gibt sie zurück. Die ID
// steht danach in den Script Properties (KONTAKT_TABELLE_ID); es entsteht nie
// eine zweite Tabelle – ist die gespeicherte nicht erreichbar, gibt es einen Fehler.
function kontaktTabelle_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('KONTAKT_TABELLE_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      throw new Error('Kontakt-Tabelle (' + id + ') nicht erreichbar: ' + err.message +
        ' – bitte prüfen oder Script Property KONTAKT_TABELLE_ID anpassen.');
    }
  }
  var ss = SpreadsheetApp.create(KONTAKT_TABELLE_NAME);
  var blatt = ss.getSheets()[0];
  blatt.setName('Kontaktverlauf');
  blatt.getRange(1, 1, 1, KONTAKT_SPALTEN.length).setValues([KONTAKT_SPALTEN]).setFontWeight('bold');
  blatt.setFrozenRows(1);
  blatt.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm');
  blatt.getRange('G:G').setNumberFormat('dd.MM.yyyy');

  // Auswertung je Kunde: alles per Formel, nichts zu pflegen.
  var kunden = ss.insertSheet('Kunden');
  kunden.getRange('A1').setFormula(
    '=IFERROR(QUERY(Kontaktverlauf!A2:O,"select D, max(C), count(A), max(A) where B = \'Bestätigung\' ' +
    'group by D label D \'E-Mail\', max(C) \'Name\', count(A) \'Termine\', max(A) \'Letzte Bestätigung\'",0),"")');

  props.setProperty('KONTAKT_TABELLE_ID', ss.getId());
  Logger.log('Kontakt-Tabelle angelegt: ' + ss.getUrl());
  try {
    GmailApp.sendEmail(ALERT_EMAIL, 'Terminbestätigung: Kontakt-Tabelle angelegt',
      'Die Tabelle für den Kontaktverlauf liegt in Deinem Google Drive:\n' + ss.getUrl() +
      '\n\nBitte nur für Dich freigeben (enthält Kundendaten).');
  } catch (ignore) { /* Link steht auch im Protokoll */ }
  return ss;
}

// Zellen, die mit = + - @ beginnen, würden als Formel/Zahl gelesen (auch Kundeneingaben!).
// Mit führendem Apostroph werden sie als reiner Text gespeichert.
function zelle_(wert) {
  var s = String(wert === undefined || wert === null ? '' : wert);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function kontaktZeile_(ereignis, termin, gast, raumName, ev) {
  var blatt = kontaktTabelle_().getSheetByName('Kontaktverlauf');
  blatt.appendRow([
    new Date(), ereignis, zelle_(termin.name), zelle_(termin.email), zelle_(gast.telefon),
    termin.sprache === 'en' ? 'English' : 'Deutsch',
    termin.start, formatUhrzeit_(termin.start), zelle_(termin.begleitung), raumName,
    zelle_(termin.dauer), zelle_(termin.preis), MODUS === 'SENDEN' ? 'gesendet' : 'Entwurf',
    ev.getId(), '',
  ]);
}

// Protokoll NACH einem erfolgreichen Versand. Scheitert das Schreiben, ist die
// Mail trotzdem raus – dann nur Fehlermeldung, kein erneuter Versand.
function protokolliere_(ereignis, termin, gast, raumName, ev) {
  try {
    kontaktZeile_(ereignis, termin, gast, raumName, ev);
  } catch (err) {
    meldeFehler_('log-' + ev.getId(), 'Kontaktverlauf nicht geschrieben',
      ereignis + ' für "' + ev.getTitle() + '" wurde gesendet, konnte aber nicht protokolliert werden:\n\n' + err.message);
  }
}

// ---------- MANUELL AUSFÜHREN (im Editor) ----------

// Zeigt im Ausführungsprotokoll, was jetzt passieren WÜRDE – sendet,
// markiert und schreibt nichts. Berücksichtigt alle Bausteine, auch
// ausgeschaltete.
function trockenlauf() {
  Logger.log('Trockenlauf – es wird nichts gesendet oder markiert.');
  zusatzschritte_(true);
  Logger.log('Trockenlauf beendet.');
}

// Legt Beispiel-Entwürfe (Gmail) für alle Mails dieser Datei an ALERT_EMAIL an.
// Sendet nie an einen Kunden oder ins Team.
function erweiterungenTesten() {
  var beispiel = {
    vorname: 'Max', name: 'Max Mustermann', email: 'max@example.com', begleitung: 'Asmita',
    dauer: '2 Stunden', preis: '290,00 €', start: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
  ['de', 'en'].forEach(function (sprache) {
    var t = Object.assign({ sprache: sprache }, beispiel);
    [['ERINNERUNG', VORLAGEN_ERINNERUNG], ['FEEDBACK', VORLAGEN_FEEDBACK]].forEach(function (paar) {
      var vorlage = paar[1][sprache];
      var inhalt = rendereVorlage_(werteErweitert_(t), vorlage.docId);
      GmailApp.createDraft(ALERT_EMAIL, '[TEST ' + paar[0] + ' ' + sprache.toUpperCase() + '] ' + vorlage.betreff, inhalt.text,
        { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder });
    });
  });
  var gast = { telefon: '+49 123 4567890', begleitungArt: 'einem Masseur', wunschperson: 'Asmita',
               alternativen: 'auch Sonntag', nachricht: 'Beispielnachricht des Gastes.' };
  GmailApp.createDraft(ALERT_EMAIL, '[TEST TEAM] ' + teamBetreff_(Object.assign({ sprache: 'de' }, beispiel)),
    teamText_(Object.assign({ sprache: 'de' }, beispiel), gast, 'Raum 1'), { name: ABSENDER_NAME });
  Logger.log('5 Test-Entwürfe (Erinnerung de/en, Feedback de/en, Team-Info) liegen in Gmail unter Entwürfe.');
}

// Legt die Kontakt-Tabelle jetzt an (statt erst beim ersten Eintrag) und
// schreibt den Link ins Protokoll.
function kontaktTabelleAnlegen() {
  Logger.log('Kontakt-Tabelle: ' + kontaktTabelle_().getUrl());
}
