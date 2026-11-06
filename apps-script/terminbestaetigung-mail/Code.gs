/**
 * TERMINBESTÄTIGUNG PER MAIL: RAUMKALENDER → KUNDE
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (getrennt von den anderen Skripten in
 * apps-script/). Ersetzt die frühere Amelia-Terminbestätigung.
 *
 * ABLAUF
 * 1. Kunde bucht über WPForms → Termin landet im Anfragenkalender, die
 *    Kundendaten stehen in der Beschreibung (Block "Gastdaten:").
 *    ODER: Jörg trägt einen eigenen Termin über das zweite WPForms-Formular
 *    ein → Termin landet im Kalender "Verfügbarkeit", Beschreibung im
 *    Kurzformat ohne Beschriftungen (Name / Sprache / Telefon / Mail /
 *    Eintrags-ID), Dauer im Titel ("Tantramassage 2,5 Stunden Maxine"), der
 *    Preis fehlt (→ PREISLISTE). Beide Wege werden danach gleich behandelt.
 * 2. Jörg verteilt den Termin und KOPIERT ihn in einen Raumkalender
 *    (Raum 1/2/3). Im Titel der Kopie nennt er die Begleitung, z. B.
 *    "Tantramassage 2h (Asmita)".
 * 3. Dieses Skript läuft alle 10 Minuten, findet neue Termine in den
 *    Raumkalendern, liest Kunde/Dauer/Preis aus der Beschreibung und die
 *    Begleitung aus dem Titel, füllt die Mailvorlage (Google Doc) und
 *    verschickt die Bestätigung an den Kunden.
 *
 * WANN GILT EIN TERMIN ALS "BESTÄTIGUNGSREIF"? (alles muss zutreffen)
 *  - liegt in einem Raumkalender, ist kein Ganztagstermin
 *  - wurde NACH dem Einrichten (AKTIV_SEIT) angelegt → Altbestand wird nie
 *    angefasst
 *  - die Beschreibung enthält den Block "Gastdaten:" mit "Mail:" – oder, im
 *    Kurzformat, eine Zeile, die nur aus einer Mailadresse besteht
 *  - im Titel steht der Vorname mindestens eines Teammitglieds (Liste TEAM
 *    unten); bei mehreren ("Erin & Dominik") werden alle genannt und alle im BCC.
 *    Solange er fehlt (z. B. direkt nach dem Kopieren, wenn noch der
 *    Anfragen-Titel "Tantramassage (Tantric massage)" drinsteht), wartet
 *    das Skript einfach — es rät nie.
 *  - noch nicht markiert (siehe unten)
 *  Interne Termine ohne Kundenmail (Blocker, Pausen …) werden ignoriert.
 *
 * KEIN DOPPELVERSAND: Vor dem Versand wird am Termin eine unsichtbare
 * Markierung gesetzt (CalendarEvent.setTag). Schlägt das Markieren fehl
 * (z. B. fehlende Schreibrechte), wird NICHT gesendet — das ist die Lehre
 * aus dem Vorfall vom 26.08.2026 (raum-einladung-sync/Code.gs). Schlägt der
 * Versand fehl, wird die Markierung wieder entfernt, der nächste Lauf
 * versucht es erneut; Jörg bekommt dazu eine Fehlermail (max. 1× alle 6 h
 * je Termin). Verschiebt oder ändert jemand den Termin später, wird NICHT
 * erneut bestätigt.
 *
 * VORLAGE: Google Doc je Sprache (VORLAGEN). Text, Fett/Kursiv, Links und das
 * Logo werden übernommen. Platzhalter stehen in doppelten geschweiften
 * Klammern: {{Vorname}} {{Name}} {{Datum}} {{Uhrzeit}} {{Begleitung}}
 * {{Dauer}} {{Preis}}. Die Formatierung eines Platzhalters (fett/kursiv)
 * ist egal, auch wenn sie mitten im Platzhalter wechselt – sie richtet sich
 * nach der ersten Klammer. Unbekannte Platzhalter → es wird nichts
 * gesendet, Jörg bekommt eine Mail.
 *
 * SETUP
 * 1. Neues Projekt auf script.google.com als joerg@spiritual-touch.de.
 * 2. Code.gs und appsscript.json einfügen.
 * 3. Platzhalter in der Vorlage setzen (siehe README).
 * 4. Funktion "vorlageTesten" ausführen → Berechtigungen erlauben → es
 *    liegt ein Entwurf mit Beispieldaten in Gmail. Aussehen prüfen.
 * 5. Funktion "einrichten" ausführen (setzt AKTIV_SEIT = jetzt und legt den
 *    10-Minuten-Trigger an). Nur einmal nötig.
 * 6. Testtermin NEU in einen Raumkalender kopieren (alte Testkopien sind
 *    vor AKTIV_SEIT entstanden und zählen nicht).
 * 7. Wenn alles passt: MODUS unten von 'ENTWURF' auf 'SENDEN' stellen.
 */

// ---------- KONFIGURATION ----------

// 'ENTWURF' = Mail wird nur als Gmail-Entwurf angelegt (zum Prüfen).
// 'SENDEN'  = Mail geht direkt an den Kunden.
var MODUS = 'ENTWURF';

// Vorlagen je Sprache (Google Docs). Welche gilt, entscheidet die Zeile
// "Sprache:" in der Terminbeschreibung (WPForms-Feld). Fehlt sie oder ist sie
// unklar, wird auf Deutsch bestätigt.
var VORLAGEN = {
  de: { docId: '1zS4Cg7elvCFLtPA8o_UOsn6R_sjroRlvfWnL-XRpJJo', betreff: 'Terminbestätigung' },
  en: { docId: '1lYI2Kf9ZdfW2jkgavlQBc4m7Vb5NBvQxL64nsGBoHq4', betreff: 'Appointment confirmation' },
};
var ABSENDER_NAME = 'Spiritual Touch';
var ABSENDER_ALIAS = '';  // optional: Gmail-"Senden als"-Adresse, leer = Standardadresse (nur bei MODUS 'SENDEN')
var ANTWORT_AN = '';      // optional: Reply-To, leer = Absenderadresse

// Begleitung als BCC: Die Mail geht zusätzlich an NAME@spiritual-touch.de und
// landet so im Google-Chat-Raum der Person. Der Kunde sieht die Adresse nicht.
// Adresse = Vorname aus dem Termintitel, klein geschrieben, Umlaute ausgeschrieben
// (Jörg → joerg@). Abweichende Adressen hier eintragen, '' = für diese Person
// kein BCC. Existiert eine Adresse nicht, kommt ein Unzustellbarkeits-Hinweis.
var BCC_AKTIV = true;
var BCC_DOMAIN = 'spiritual-touch.de';
var BCC_ADRESSEN = {};  // Beispiel: { 'Mila': 'mila.k@spiritual-touch.de', 'Eva': '' }

// Preise, wenn sie nicht im Termin stehen (Kurzformat der eigenen Termine,
// Workshops, "andere Dauer" …). Schlüssel 1 = Art des Termins (wird aus dem
// Titel erkannt, siehe ARTEN), Schlüssel 2 = Dauer ("2 Stunden", "2,5 Stunden",
// "3 Stunden"; 90 Minuten = "1,5 Stunden"), Wert = Preis wie in der Mail,
// z. B. '290,00 €'. LEER ('') = noch nicht eingetragen: dann wird NICHT
// gesendet und Jörg bekommt eine Fehlermail. Weitere Dauern einfach als neue
// Zeile ergänzen. Steht ein Preis mit €-Zeichen in der Dauer-Zeile des Termins
// (Buchungsformular), hat der Vorrang.
var PREISLISTE = {
  'Tantramassage':   { '2 Stunden': '290,00 €', '2,5 Stunden': '340,00 €', '3 Stunden': '390,00 €' },
  'Paarmassage':     { '2 Stunden': '580,00 €', '2,5 Stunden': '680,00 €', '3 Stunden': '780,00 €' },
  'Ritual zu Dritt': { '2 Stunden': '340,00 €', '2,5 Stunden': '390,00 €', '3 Stunden': '440,00 €' },
  'Körperarbeit':    { '3 Stunden': '275,00 €' }, // Sexological Bodywork / Intuitive Körperarbeit
  'Workshop':        { '3 Stunden': '450,00 €' }, // Workshop/Berührungscoaching
  'Beratung':        { '1,5 Stunden': '125,00 €' }, // Paar- oder Einzelberatung
  'De-Armouring':    { '2 Stunden': '340,00 €', '2,5 Stunden': '390,00 €', '3 Stunden': '440,00 €' },
};

// Art des Termins aus dem Titel. Reihenfolge zählt (die erste passende gilt).
var ARTEN = [
  { art: 'Beratung',        muster: /beratung|consult/i },
  { art: 'Workshop',        muster: /workshop|ber[üu]hrungscoaching|coaching/i },
  { art: 'De-Armouring',    muster: /armou?ring|sacred spot/i },
  { art: 'Ritual zu Dritt', muster: /zu dritt|for three/i },
  { art: 'Paarmassage',     muster: /paarmassage|couple/i },
  { art: 'Körperarbeit',    muster: /sexolog|k[öo]rperarbeit|bodywork/i },
  { art: 'Tantramassage',   muster: /tantra/i },
];

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// Raumkalender (IDs aus apps-script/raum-einladung-sync/Code.gs).
var RAUM_KALENDER = [
  { name: 'Raum 1', id: 'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com' },
  { name: 'Raum 2', id: 'c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com' },
  { name: 'Raum 3', id: 'c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com' },
];

// Vornamen, wie sie im Termintitel stehen dürfen. Neues Teammitglied =
// hier ergänzen.
var TEAM = ['Tara', 'Eva', 'Jörg', 'Asmita', 'Amila', 'Sarah', 'Dominik', 'Konstantin',
            'Alea', 'Stephanie', 'Karen', 'Maxine', 'Mila', 'Erin'];

// Notfall-Entwurf: Findet das Skript einen Kundentermin, kann ihn aber nicht
// automatisch bestätigen (Mail, Preis, Dauer, Begleitung … fehlt oder ist
// nicht lesbar), legt es nach dieser Wartezeit (Minuten seit der letzten
// Änderung des Termins) trotzdem einen Gmail-ENTWURF mit den vorhandenen Daten an; Fehlendes
// steht als [... FEHLT] in der Mail. Die Wartezeit gibt dir Zeit, Titel oder
// Beschreibung nach dem Kopieren zu korrigieren (dann geht die normale
// Bestätigung raus). 0 = sofort, -1 = ausgeschaltet. Notfall-Entwürfe sind
// immer nur Entwürfe, auch bei MODUS 'SENDEN'.
var NOTFALL_ENTWURF_NACH_MIN = 30;

var SCAN_TAGE_VORAUS = 180;
var TIMEZONE = 'Europe/Berlin';
var TAG_KEY = 'bestaetigung';

// Weiche Zeilenumbrüche (Shift+Enter) liefert Apps Script je nach Quelle als
// \r, \u000b oder \u2028 – alle gelten als Umbruch.
var ZEILENUMBRUCH = /\r\n|\r|\u000b|\u2028|\n/g;

var WOCHENTAGE_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var MONATE_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                 'September', 'October', 'November', 'December'];
var WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
              'September', 'Oktober', 'November', 'Dezember'];

// ---------- HAUPTFUNKTION (Trigger: alle 10 Minuten) ----------

function bestaetigungenVersenden() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Ein anderer Lauf ist bereits aktiv – übersprungen.');
    return;
  }
  try {
    var aktivSeit = aktivSeit_();
    if (!aktivSeit) {
      Logger.log('AKTIV_SEIT nicht gesetzt – bitte einmal "einrichten" ausführen.');
      return;
    }
    var jetzt = new Date();
    var bis = new Date(jetzt.getTime() + SCAN_TAGE_VORAUS * 24 * 60 * 60 * 1000);

    RAUM_KALENDER.forEach(function (raum) {
      var kalender = CalendarApp.getCalendarById(raum.id);
      if (!kalender) {
        meldeFehler_('kalender-' + raum.id, 'Kalender nicht gefunden',
          raum.name + ' (' + raum.id + '): nicht gefunden oder kein Zugriff.');
        return;
      }
      kalender.getEvents(jetzt, bis).forEach(function (ev) {
        try {
          verarbeiteTermin_(ev, raum.name, aktivSeit);
        } catch (err) {
          meldeFehler_('termin-' + ev.getId(), 'Bestätigung nicht gesendet',
            raum.name + ': "' + ev.getTitle() + '" am ' + formatDatum_(ev.getStartTime()) +
            '\n\n' + err.message + '\n\nNächster Lauf versucht es automatisch erneut.');
        }
      });
    });
  } catch (err) {
    meldeFehler_('lauf', 'Fehler im Lauf', err.message + '\n\n' + err.stack);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function verarbeiteTermin_(ev, raumName, aktivSeit) {
  if (ev.isAllDayEvent()) return;
  if (ev.getTag(TAG_KEY)) return;                       // schon bearbeitet
  if (ev.getDateCreated().getTime() < aktivSeit) return; // Altbestand

  var fehler = null;
  try {
    if (bestaetigeTermin_(ev, raumName)) return;
  } catch (err) {
    fehler = err;
  }
  // Nicht automatisch bestätigt: entweder Fehler (fehler gesetzt) oder der Termin
  // ist (noch) nicht bestätigungsreif. Ist er ein erkennbarer Kundentermin und
  // die Wartezeit um, kommt ein Notfall-Entwurf.
  if (notfallEntwurfFaellig_(ev)) {
    notfallEntwurf_(ev, raumName, fehler);
    return;
  }
  if (fehler) throw fehler;
}

// true = Bestätigung gesendet bzw. als Entwurf angelegt; false = Termin (noch)
// nicht bestätigungsreif. Wirft bei Datenfehlern.
function bestaetigeTermin_(ev, raumName) {
  var termin = leseTermin_(ev);
  if (!termin) return false; // kein Kundentermin oder Begleitung im Titel fehlt noch

  var vorlage = VORLAGEN[termin.sprache];
  var werte = werteFuerVorlage_(termin);
  var inhalt = rendereVorlage_(werte, vorlage.docId); // wirft bei Vorlagenfehler, BEVOR markiert wird

  // Erst markieren, dann senden: scheitert das Markieren, geht keine Mail raus.
  ev.setTag(TAG_KEY, 'in-arbeit');
  if (ev.getTag(TAG_KEY) !== 'in-arbeit') {
    throw new Error('Markierung am Termin konnte nicht gespeichert werden – nichts gesendet.');
  }
  try {
    sende_(termin.email, vorlage.betreff, inhalt, bccFuer_(termin.begleiter));
  } catch (err) {
    ev.deleteTag(TAG_KEY);
    throw err;
  }
  ev.setTag(TAG_KEY, MODUS === 'SENDEN' ? 'gesendet' : 'entwurf');
  Logger.log((MODUS === 'SENDEN' ? 'Gesendet' : 'Entwurf') + ': ' + termin.email +
    ' (' + raumName + ', ' + termin.sprache + ', ' + formatDatum_(termin.start) + ' ' + formatUhrzeit_(termin.start) + ')');
  return true;
}

// ---------- NOTFALL-ENTWURF (unvollständige Kundentermine) ----------

// Erkennbarer Kundentermin = Gastdaten-Block oder Mailadresse in der
// Beschreibung, ODER Begleitung + Art des Termins (Tantramassage, Workshop …)
// im Titel. Interne Termine (Blocker, Pausen, "Massageaustausch …") haben
// weder das eine noch das andere und bleiben unberührt.
function notfallEntwurfFaellig_(ev) {
  if (NOTFALL_ENTWURF_NACH_MIN < 0) return false;
  if (Date.now() - ev.getLastUpdated().getTime() < NOTFALL_ENTWURF_NACH_MIN * 60 * 1000) return false;
  var titel = ev.getTitle() || '';
  var text = ohneNachricht_(beschreibungAlsText_(ev.getDescription()));
  if (/Gastdaten:/i.test(text) || sucheMail_(text)) return true;
  return findeBegleiter_(titel).length > 0 && !!findeArt_(titel);
}

// Legt aus den vorhandenen Daten einen Gmail-Entwurf an (nie ein Versand).
// Fehlendes steht als [... FEHLT] in der Mail, oben ein roter Hinweis. Fehlt die
// Kundenmail, geht der Entwurf an ALERT_EMAIL (Empfänger dann eintragen).
function notfallEntwurf_(ev, raumName, fehler) {
  var t = leseTerminTeilweise_(ev);
  var vorlage = VORLAGEN[t.sprache];
  var grund = t.fehlt.length ? t.fehlt.join(', ') : 'unbekannt';
  var hinweis = 'ACHTUNG – UNVOLLSTÄNDIGER ENTWURF. Fehlt: ' + grund + '. Stellen in [ECKIGEN KLAMMERN] ' +
    'ergänzen' + (t.email ? '' : ', Empfänger eintragen') + ' und diesen Hinweis löschen, bevor die Mail gesendet wird.';

  var inhalt;
  try {
    inhalt = rendereVorlage_(werteFuerVorlage_(t), vorlage.docId);
  } catch (err) {
    inhalt = { // Vorlage nicht lesbar: nackter Entwurf mit den Rohdaten
      html: '<p>' + escapeHtml_(t.vorname + ', ' + formatDatum_(t.start, t.sprache) + ' ' + formatUhrzeit_(t.start) +
        ', Begleitung ' + t.begleitung + ', ' + t.dauer + ', ' + t.preis + ' (Vorlage nicht lesbar: ' + err.message + ')') + '</p>',
      text: t.vorname + ', ' + formatDatum_(t.start, t.sprache) + ' ' + formatUhrzeit_(t.start) +
        ', Begleitung ' + t.begleitung + ', ' + t.dauer + ', ' + t.preis + ' (Vorlage nicht lesbar: ' + err.message + ')',
      bilder: {},
    };
  }
  inhalt.html = '<p style="margin:0 0 16px 0;padding:8px;background:#fde8e8;color:#b00020;font-weight:bold">' +
    escapeHtml_(hinweis) + '</p>' + inhalt.html;
  inhalt.text = hinweis + '\n\n' + inhalt.text;

  var optionen = { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder };
  var bcc = t.begleiter.length ? bccFuer_(t.begleiter) : '';
  if (bcc) optionen.bcc = bcc;
  if (ANTWORT_AN) optionen.replyTo = ANTWORT_AN;

  // Wie beim Versand: erst markieren, dann Entwurf anlegen.
  ev.setTag(TAG_KEY, 'in-arbeit');
  if (ev.getTag(TAG_KEY) !== 'in-arbeit') {
    throw new Error('Markierung am Termin konnte nicht gespeichert werden – kein Notfall-Entwurf angelegt.');
  }
  try {
    GmailApp.createDraft(t.email || ALERT_EMAIL, '[UNVOLLSTÄNDIG] ' + vorlage.betreff, inhalt.text, optionen);
  } catch (err) {
    ev.deleteTag(TAG_KEY);
    throw err;
  }
  ev.setTag(TAG_KEY, 'notfall-entwurf');
  Logger.log('Notfall-Entwurf (' + grund + '): ' + (t.email || '(keine Mail)') + ' (' + raumName + ', ' +
    formatDatum_(t.start) + ' ' + formatUhrzeit_(t.start) + ')');
  meldeFehler_('notfall-' + ev.getId(), 'Unvollständiger Termin – Entwurf angelegt',
    raumName + ': "' + ev.getTitle() + '" am ' + formatDatum_(ev.getStartTime()) + ' ' + formatUhrzeit_(ev.getStartTime()) +
    '\n\nFehlt: ' + grund + (fehler ? '\nFehler: ' + fehler.message : '') +
    '\n\nIn Gmail unter Entwürfe liegt "[UNVOLLSTÄNDIG] ' + vorlage.betreff + '". Bitte ergänzen und selbst senden.');
}

// Liest, so viel sich findet, und füllt Lücken mit [... FEHLT]. t.fehlt listet die Lücken.
function leseTerminTeilweise_(ev) {
  var titel = ev.getTitle() || '';
  var text = beschreibungAlsText_(ev.getDescription());
  var gastPos = text.search(/Gastdaten:/i);
  var kopf = gastPos >= 0 ? text.substring(0, gastPos) : '';
  var gast = ohneNachricht_(gastPos >= 0 ? text.substring(gastPos) : text);
  var fehlt = [];

  var email = sucheMail_(gast) || '';
  if (!email) fehlt.push('E-Mail-Adresse');

  var begleiter = findeBegleiter_(titel);
  if (!begleiter.length) fehlt.push('Begleitung (Vorname im Titel)');

  var name = kundenName_(gast);
  if (!name && gastPos < 0) { // Freitext wie "Marcel, von Eva": erste Zeile
    var erste = gast.split(ZEILENUMBRUCH).map(function (z) { return z.trim(); }).filter(function (z) { return z; })[0] || '';
    if (erste && erste.indexOf(':') < 0 && erste.indexOf('@') < 0 && !/^[\d\s+().\/-]+$/.test(erste)) name = erste;
  }
  if (!name) fehlt.push('Name');

  var sprache = 'de';
  var sprachZeile = gast.match(/^[ \t]*(?:Sprache|Language)[^:\n]*:[ \t]*(.+)$/mi);
  if (sprachZeile ? (/engl/i.test(sprachZeile[1]) && !/^\s*(deutsch|german)/i.test(sprachZeile[1])) :
      /^[ \t]*(english|englisch)[ \t]*$/mi.test(gast)) sprache = 'en';

  var dz = kopf.match(/^[ \t]*Dauer:[ \t]*(.*)$/mi);
  var dauerZeile = dz ? dz[1].trim() : '';
  var dauerPreis = dauerZeile.match(/^(.+?)[ \t]+[-–—][ \t]+([\d.,]+)[ \t]*(?:€|&euro;|EUR)/i);
  var dauer = dauerPreis ? dauerPreis[1].trim() : (dauerAusText_(dauerZeile) || dauerAusText_(titel) || '');
  if (!dauer) fehlt.push('Dauer');
  var preis = dauerPreis ? dauerPreis[2] + ' €' : '';
  if (!preis) {
    try { preis = ermittlePreis_(gastPos >= 0 ? dauerZeile : gast, findeArt_(titel), dauer); } catch (err) { preis = ''; }
  }
  if (!preis) fehlt.push('Preis' + (dauer ? ' (' + (findeArt_(titel) || 'Art unbekannt') + ', ' + dauer + ')' : ''));

  var fehltText = function (was) { return '[' + was + ' FEHLT]'; };
  return {
    fehlt: fehlt,
    email: email,
    sprache: sprache,
    name: name || fehltText('NAME'),
    vorname: name ? name.split(/[\s,]+/)[0] : fehltText('VORNAME'),
    begleiter: begleiter,
    begleitung: begleiter.length ? begleiter.join(' & ') : fehltText('BEGLEITUNG'),
    dauer: dauer || fehltText('DAUER'),
    preis: preis || fehltText('PREIS'),
    start: ev.getStartTime(),
  };
}

// Mailadresse als eigene Zeile oder "Email:/E-Mail:/Mail: adresse"; sonst null.
function sucheMail_(text) {
  var m = String(text || '').match(/^[ \t]*(?:(?:e-?mail|mail)[^:\n]*:[ \t]*)?([^\s@<>:]+@[^\s@<>]+\.[^\s@<>]+)[ \t]*$/mi);
  return m ? m[1] : null;
}

// Freitext des Kunden ("Nachricht: …" und alles danach) nie auswerten.
function ohneNachricht_(text) {
  var pos = text.search(/^[ \t]*Nachricht:/mi);
  return pos >= 0 ? text.substring(0, pos) : text;
}

// ---------- TERMIN LESEN ----------

// Gibt null zurück, wenn der Termin (noch) nicht bestätigungsreif ist.
// Wirft nur, wenn er eindeutig ein Kundentermin ist, aber Daten fehlen.
function leseTermin_(ev) {
  var text = beschreibungAlsText_(ev.getDescription());
  var gastPos = text.search(/Gastdaten:/i);
  if (gastPos < 0) return leseKurzformat_(ev, text);

  var kopf = text.substring(0, gastPos);
  var gast = text.substring(gastPos);
  // Freitext des Kunden ("Nachricht:") nie auswerten.
  var nachrichtPos = gast.search(/^[ \t]*Nachricht:/mi);
  if (nachrichtPos >= 0) gast = gast.substring(0, nachrichtPos);

  var mail = gast.match(/^[ \t]*(?:e-?mail|mail)[^:\n]*:[ \t]*([^\s<>]+)/mi);
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail[1])) return null;

  var titel = ev.getTitle() || '';
  var begleiter = findeBegleiter_(titel);
  if (!begleiter.length) return null;

  var kundenname = kundenName_(gast);
  if (!kundenname) throw new Error('Kundenname ("Vorname:" bzw. "Name:") in der Beschreibung nicht gefunden.');

  // "Dauer: 2 Stunden - 290,00 €" – Strich darf auch ein Gedankenstrich sein,
  // Währung €, "&euro;" (falls nicht entschlüsselt) oder EUR. Bei Workshops,
  // "andere Dauer" u. Ä. ist die Zeile leer oder ohne Preis: dann kommt die
  // Dauer aus Titel bzw. Termin und der Preis aus der PREISLISTE.
  var dz = kopf.match(/^[ \t]*Dauer:[ \t]*(.*)$/mi);
  var dauerZeile = dz ? dz[1].trim() : '';
  var dauerPreis = dauerZeile.match(/^(.+?)[ \t]+[-–—][ \t]+([\d.,]+)[ \t]*(?:€|&euro;|EUR)/i);
  var dauer, preis;
  if (dauerPreis) {
    dauer = dauerPreis[1].trim();
    preis = dauerPreis[2] + ' €';
  } else {
    dauer = ermittleDauer_(titel, dauerZeile);
    preis = ermittlePreis_(dauerZeile, findeArt_(titel), dauer);
  }

  // Zeile "Sprache: English" / "Sprache: Deutsch" (auch "Language:"). Nur der
  // Gastdaten-Block zählt; alles außer eindeutig Englisch → Deutsch.
  var sprachZeile = gast.match(/^[ \t]*(?:Sprache|Language)[^:\n]*:[ \t]*(.+)$/mi);
  var sprache = (sprachZeile && /engl/i.test(sprachZeile[1]) && !/^\s*(deutsch|german)/i.test(sprachZeile[1])) ? 'en' : 'de';

  return {
    email: mail[1],
    sprache: sprache,
    name: kundenname,
    vorname: kundenname.split(/\s+/)[0],
    begleiter: begleiter,
    begleitung: begleiter.join(' & '),
    dauer: dauer,
    preis: preis,
    start: ev.getStartTime(),
  };
}

// "Vorname: X" und/oder "Name: Y" (auch "Nachname:") → "X Y"; '' wenn keins da ist.
function kundenName_(text) {
  var vor = text.match(/^[ \t]*Vorname[ \t]*:[ \t]*(.+)$/mi);
  var nach = text.match(/^[ \t]*(?:Nachname|Name)[ \t]*:[ \t]*(.+)$/mi);
  return [vor && vor[1].trim(), nach && nach[1].trim()]
    .filter(function (x) { return x; }).join(' ');
}

// Kurzformat des zweiten WPForms-Formulars (eigene Termine), ohne Block
// "Gastdaten:". Zwei Varianten, beide werden gelesen:
//   a) unbeschriftet:  Thomas / Deutsch / 393315824625 / thomas@example.com / 1653
//   b) beschriftet:    Vorname: Andrea / Sprache: Deutsch / Mobilnummer: 0160…
//                      / Email: andrea@example.com / Nachricht: / 1810
// (die Schlusszahl ist die Eintrags-ID). Dauer aus dem Titel, Preis aus der
// PREISLISTE. Ab "Nachricht:" wird nichts mehr
// ausgewertet (Freitext des Kunden).
// Gibt null zurück, wenn keine Mailadresse oder keine Begleitung im Titel
// vorhanden ist (dann ist es kein Kundentermin bzw. noch nicht fertig).
function leseKurzformat_(ev, text) {
  var nachrichtPos = text.search(/^[ \t]*Nachricht:/mi);
  if (nachrichtPos >= 0) text = text.substring(0, nachrichtPos);

  var zeilen = text.split(ZEILENUMBRUCH)
    .map(function (z) { return z.trim(); })
    .filter(function (z) { return z; });

  // Mail: eigene Zeile oder "Email:/E-Mail:/Mail: adresse".
  var mailIdx = -1;
  var email = null;
  zeilen.forEach(function (z, i) {
    if (mailIdx >= 0) return;
    var m = z.match(/^(?:(?:e-?mail|mail)[^:\n]*:[ \t]*)?([^\s@<>:]+@[^\s@<>]+\.[^\s@<>]+)$/i);
    if (m) { mailIdx = i; email = m[1]; }
  });
  if (mailIdx < 0) return null;

  var titel = ev.getTitle() || '';
  var begleiter = findeBegleiter_(titel);
  if (!begleiter.length) return null;

  // Name: "Vorname:" (+ ggf. "Name:"), sonst die erste Zeile vor der Mailzeile.
  var name = kundenName_(text);
  if (!name && mailIdx > 0) name = zeilen[0];
  if (!name || /^[\d\s+().\/-]+$/.test(name) || /^(deutsch|german|english|englisch)$/i.test(name) ||
      /^[A-Za-zÀ-ÿ ]+:/.test(name)) {
    throw new Error('Kundenname ("Vorname:" bzw. erste Zeile der Beschreibung) nicht gefunden.');
  }

  var dauer = ermittleDauer_(titel, '');
  var preis = ermittlePreis_(text, findeArt_(titel), dauer);

  // Sprache: "Sprache: English" oder eigene Zeile "English".
  var sprache = 'de';
  var sprachZeile = text.match(/^[ \t]*(?:Sprache|Language)[^:\n]*:[ \t]*(.+)$/mi);
  if (sprachZeile) {
    if (/engl/i.test(sprachZeile[1]) && !/^\s*(deutsch|german)/i.test(sprachZeile[1])) sprache = 'en';
  } else {
    zeilen.forEach(function (z) { if (/^(english|englisch)$/i.test(z)) sprache = 'en'; });
  }

  return {
    email: email,
    sprache: sprache,
    name: name,
    vorname: name.split(/\s+/)[0],
    begleiter: begleiter,
    begleitung: begleiter.join(' & '),
    dauer: dauer,
    preis: preis,
    start: ev.getStartTime(),
  };
}

// Dauer in der Reihenfolge: Text der Dauer-Zeile, dann Titel. Immer in der Form
// "2 Stunden", "2,5 Stunden", "1 Stunde" oder "45 Minuten". Die Länge des
// Kalendertermins zählt bewusst NICHT: Sie enthält Puffer für Vor- und
// Nachbereitung und sagt nichts über die gebuchte Dauer.
function ermittleDauer_(titel, dauerZeile) {
  var dauer = dauerAusText_(dauerZeile) || dauerAusText_(titel);
  if (!dauer) {
    throw new Error('Dauer nicht erkennbar. Bitte im Titel angeben, z. B. "Workshop/Berührungscoaching 3h (Erin & Dominik)". ' +
      'Titel: ' + JSON.stringify(titel));
  }
  return dauer;
}

function dauerAusText_(s) {
  var m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*(Stunden?|Std\.?|hours?|hrs?|h|Minuten?|Min\.?|minutes?|mins?)(?![A-Za-zÀ-ÿ])/i);
  if (!m) return null;
  var zahl = parseFloat(m[1].replace(',', '.'));
  return dauerFormat_(Math.round(/^min/i.test(m[2]) ? zahl : zahl * 60));
}

function dauerFormat_(minuten) {
  if (minuten % 60 === 0) {
    var h = minuten / 60;
    return h + ' ' + (h === 1 ? 'Stunde' : 'Stunden');
  }
  if (minuten >= 60 && minuten % 30 === 0) return Math.floor(minuten / 60) + ',5 Stunden';
  return minuten + ' Minuten';
}

// Art des Termins aus dem Titel (siehe ARTEN) oder null.
function findeArt_(titel) {
  for (var i = 0; i < ARTEN.length; i++) {
    if (ARTEN[i].muster.test(titel || '')) return ARTEN[i].art;
  }
  return null;
}

// Preis in der Reihenfolge: "123 €" im übergebenen Text, sonst PREISLISTE
// nach Art und Dauer. Wirft, wenn beides fehlt (dann wird nichts gesendet).
function ermittlePreis_(text, art, dauer) {
  var m = String(text || '').match(/(\d[\d.,]*)\s*(?:€|&euro;|EUR)/i);
  if (m) return m[1] + ' €';
  if (!art) {
    throw new Error('Art des Termins im Titel nicht erkannt (Tantramassage, Paarmassage, Ritual zu Dritt, ' +
      'Körperarbeit/Sexological Bodywork, Workshop/Berührungscoaching, Beratung, De-Armouring) und kein Preis ' +
      'im Termin. Bitte Titel ergänzen oder den Preis (z. B. "290 €") in die Beschreibung schreiben.');
  }
  var preis = (PREISLISTE[art] || {})[dauer];
  if (!preis) {
    throw new Error('Kein Preis für "' + art + '", ' + dauer + '. Bitte in PREISLISTE im Skript eintragen ' +
      'oder den Preis (z. B. "290 €") in die Beschreibung schreiben.');
  }
  return preis;
}

// ALLE Teammitglieder im Titel (ganzes Wort, Groß-/Kleinschreibung egal), in
// der Reihenfolge ihres Auftretens, z. B. "(Erin & Dominik)" → ['Erin', 'Dominik'].
function findeBegleiter_(titel) {
  var treffer = [];
  TEAM.forEach(function (vorname) {
    var m = new RegExp('(^|[^A-Za-zÀ-ÿ])' + vorname + '(?![A-Za-zÀ-ÿ])', 'i').exec(titel || '');
    if (m) treffer.push({ name: vorname, pos: m.index });
  });
  treffer.sort(function (x, y) { return x.pos - y.pos; });
  return treffer.map(function (t) { return t.name; });
}

// Beschreibung kann als HTML gespeichert sein (z. B. Mail-Links) → in Text wandeln.
function beschreibungAlsText_(roh) {
  var text = String(roh || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  // Zweimal entschlüsseln: WPForms/Kalender speichern Sonderzeichen teils
  // doppelt kodiert ("&amp;euro;" statt "&euro;" – im Kalender sichtbar als
  // ein wörtliches "&euro;").
  for (var i = 0; i < 2; i++) {
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&euro;/g, '€')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return text.replace(/ /g, ' ');
}

function werteFuerVorlage_(t) {
  var en = t.sprache === 'en';
  return {
    '{{Vorname}}': t.vorname,
    '{{Name}}': t.name,
    '{{Datum}}': formatDatum_(t.start, t.sprache),
    '{{Uhrzeit}}': formatUhrzeit_(t.start),
    '{{Begleitung}}': t.begleitung,
    '{{Dauer}}': en ? dauerEnglisch_(t.dauer) : t.dauer,
    '{{Preis}}': en ? preisEnglisch_(t.preis) : t.preis,
  };
}

function formatDatum_(d, sprache) {
  var en = sprache === 'en';
  var wochentag = (en ? WOCHENTAGE_EN : WOCHENTAGE)[Number(Utilities.formatDate(d, TIMEZONE, 'u')) - 1];
  var tag = Number(Utilities.formatDate(d, TIMEZONE, 'd'));
  var monat = (en ? MONATE_EN : MONATE)[Number(Utilities.formatDate(d, TIMEZONE, 'M')) - 1];
  var jahr = Utilities.formatDate(d, TIMEZONE, 'yyyy');
  return en ? wochentag + ', ' + tag + ' ' + monat + ' ' + jahr
            : wochentag + ', ' + tag + '. ' + monat + ' ' + jahr;
}

// "2 Stunden" -> "2 hours", "1,5 Stunden" -> "1.5 hours", "90 Minuten" -> "90 minutes"
function dauerEnglisch_(dauer) {
  return dauer
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\bStunden\b/gi, 'hours')
    .replace(/\bStunde\b/gi, 'hour')
    .replace(/\bMinuten\b/gi, 'minutes')
    .replace(/\bMinute\b/gi, 'minute');
}

// "290,00 €" -> "€290.00", "1.290,00 €" -> "€1,290.00"
function preisEnglisch_(preis) {
  var zahl = parseFloat(String(preis).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
  if (isNaN(zahl)) return preis;
  return '€' + zahl.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatUhrzeit_(d) {
  return Utilities.formatDate(d, TIMEZONE, 'HH:mm');
}

// ---------- VORLAGE (Google Doc → HTML + Text) ----------

function rendereVorlage_(werte, docId) {
  var body = DocumentApp.openById(docId).getBody();
  var vorlagenText = body.getText();

  var erwartet = (vorlagenText.match(/\{\{[^}]*\}\}/g) || []);
  erwartet.forEach(function (p) {
    if (!(p in werte)) throw new Error('Unbekannter Platzhalter in der Vorlage: ' + p);
  });

  var zaehler = { n: 0 };
  var bilder = {};
  var absaetze = [];

  for (var i = 0; i < body.getNumChildren(); i++) {
    var el = body.getChild(i);
    var typ = el.getType();
    var container;
    if (typ === DocumentApp.ElementType.PARAGRAPH) container = el.asParagraph();
    else if (typ === DocumentApp.ElementType.LIST_ITEM) container = el.asListItem();
    else continue;

    var inner = '';
    for (var j = 0; j < container.getNumChildren(); j++) {
      var kind = container.getChild(j);
      var kindTyp = kind.getType();
      if (kindTyp === DocumentApp.ElementType.TEXT) {
        inner += textAlsHtml_(kind.asText(), werte, zaehler);
      } else if (kindTyp === DocumentApp.ElementType.INLINE_IMAGE) {
        var bild = kind.asInlineImage();
        var cid = 'bild' + (Object.keys(bilder).length + 1);
        bilder[cid] = bild.getBlob().setName(cid);
        inner += '<img src="cid:' + cid + '" width="' + bild.getWidth() + '" height="' + bild.getHeight() +
          '" alt="Spiritual Touch" style="display:block;border:0">';
      }
    }
    if (inner.replace(/<br>|&nbsp;|\s/g, '') === '') continue; // leere Absätze weglassen
    absaetze.push('<p style="margin:0 0 16px 0">' + inner + '</p>');
  }

  if (zaehler.n !== erwartet.length) {
    throw new Error('Interner Fehler: nur ' + zaehler.n + ' von ' + erwartet.length +
      ' Platzhaltern der Vorlage wurden ersetzt – nichts gesendet.');
  }

  return {
    html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f1b2a">' +
      absaetze.join('') + '</div>',
    text: ersetze_(vorlagenText, werte, { n: 0 }).replace(ZEILENUMBRUCH, '\n'),
    bilder: bilder,
  };
}

// Google Docs teilt einen Absatz überall dort in "Formatierungsabschnitte",
// wo sich irgendein Merkmal ändert (auch unsichtbare wie Schriftgröße,
// Farbton oder Rechtschreib-Reste). Ein Platzhalter kann dadurch mitten
// durchgeschnitten werden. Darum werden Platzhalter hier immer am Stück aus
// dem GANZEN Absatztext gesucht und als Einheit ersetzt; die Formatierung
// (fett/kursiv/Link) übernimmt der Platzhalter von seiner ersten Klammer.
function textAlsHtml_(text, werte, zaehler) {
  var s = text.getText();
  var idx = text.getTextAttributeIndices();
  var stile = idx.map(function (von) {
    return { b: text.isBold(von), i: text.isItalic(von), l: text.getLinkUrl(von) };
  });
  var treffer = [];
  s.replace(/\{\{[^}]*\}\}/g, function (p, off) { treffer.push({ von: off, bis: off + p.length, p: p }); });

  var out = '';
  var pos = 0;
  while (pos < s.length) {
    var t = null;
    treffer.forEach(function (x) { if (x.von === pos) t = x; });
    var ende, inhalt;
    if (t) {
      ende = t.bis;
      if (t.p in werte) { zaehler.n++; inhalt = werte[t.p]; } else { inhalt = t.p; }
    } else {
      ende = s.length;
      idx.forEach(function (v) { if (v > pos && v < ende) ende = v; });
      treffer.forEach(function (x) { if (x.von > pos && x.von < ende) ende = x.von; });
      inhalt = s.substring(pos, ende);
    }
    var k = 0;
    idx.forEach(function (v, m) { if (v <= pos) k = m; });
    var h = escapeHtml_(inhalt).replace(ZEILENUMBRUCH, '<br>');
    if (stile[k].b) h = '<strong>' + h + '</strong>';
    if (stile[k].i) h = '<em>' + h + '</em>';
    if (stile[k].l) h = '<a href="' + escapeHtml_(stile[k].l) + '" style="color:#1155cc">' + h + '</a>';
    out += h;
    pos = ende;
  }
  return out;
}

function ersetze_(s, werte, zaehler) {
  return s.replace(/\{\{[^}]*\}\}/g, function (p) {
    if (p in werte) {
      zaehler.n++;
      return werte[p];
    }
    return p;
  });
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- VERSAND ----------

// BCC-Adressen aller Begleiter (siehe BCC_AKTIV), kommagetrennt, oder ''.
function bccFuer_(begleiter) {
  if (!BCC_AKTIV) return '';
  var adressen = [];
  begleiter.forEach(function (b) {
    var adresse = BCC_ADRESSEN.hasOwnProperty(b) ? BCC_ADRESSEN[b] :
      b.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss') + '@' + BCC_DOMAIN;
    if (adresse && adressen.indexOf(adresse) < 0) adressen.push(adresse);
  });
  return adressen.join(',');
}

function sende_(an, betreff, inhalt, bcc) {
  var optionen = { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder };
  if (bcc) optionen.bcc = bcc;
  if (ANTWORT_AN) optionen.replyTo = ANTWORT_AN;
  if (MODUS === 'SENDEN') {
    if (ABSENDER_ALIAS) optionen.from = ABSENDER_ALIAS;
    GmailApp.sendEmail(an, betreff, inhalt.text, optionen);
  } else {
    GmailApp.createDraft(an, betreff, inhalt.text, optionen);
  }
}

// ---------- EINRICHTUNG & TESTS (manuell im Editor ausführen) ----------

// Einmalig: setzt den Startzeitpunkt (nur Termine, die DANACH angelegt
// werden, werden bestätigt) und legt den 10-Minuten-Trigger an.
function einrichten() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AKTIV_SEIT')) props.setProperty('AKTIV_SEIT', String(Date.now()));
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'bestaetigungenVersenden') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('bestaetigungenVersenden').timeBased().everyMinutes(10).create();
  Logger.log('Eingerichtet. Aktiv seit ' + new Date(Number(props.getProperty('AKTIV_SEIT'))) +
    ' – Modus: ' + MODUS);
}

// Legt je Sprache (Deutsch, English) einen Entwurf mit Beispieldaten an
// ALERT_EMAIL an – zum Prüfen der Vorlagen, ohne Kalender. Sendet nie an
// einen Kunden.
function vorlageTesten() {
  ['de', 'en'].forEach(function (sprache) {
    var inhalt = rendereVorlage_(werteFuerVorlage_({
      sprache: sprache, vorname: 'Max', name: 'Max Mustermann', begleitung: 'Asmita',
      dauer: '2 Stunden', preis: '290,00 €', start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    }), VORLAGEN[sprache].docId);
    GmailApp.createDraft(ALERT_EMAIL, '[TEST ' + sprache.toUpperCase() + '] ' + VORLAGEN[sprache].betreff, inhalt.text,
      { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder });
  });
  Logger.log('2 Test-Entwürfe (de/en) an ' + ALERT_EMAIL + ' liegen in Gmail unter Entwürfe.');
}

// Falls ein Termin versehentlich nicht bestätigt werden soll bzw. noch
// einmal bestätigt werden muss: im Kalender lässt sich die Markierung nicht
// sehen – einfachster Weg ist, den Termin neu zu kopieren (neue Kopie =
// neuer Termin, wird wieder bestätigt) und die alte Kopie zu löschen.

// ---------- HILFSFUNKTIONEN ----------

function aktivSeit_() {
  var v = PropertiesService.getScriptProperties().getProperty('AKTIV_SEIT');
  return v ? Number(v) : 0;
}

// Fehlermail, je Schlüssel höchstens alle 6 Stunden (CacheService, kein Aufräumen nötig).
function meldeFehler_(schluessel, betreff, text) {
  Logger.log(betreff + ': ' + text);
  var cache = CacheService.getScriptCache();
  var key = 'alert-' + schluessel;
  if (cache.get(key)) return;
  cache.put(key, '1', 21600);
  try {
    GmailApp.sendEmail(ALERT_EMAIL, 'Terminbestätigung: ' + betreff, text);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
