/**
 * TERMINBESTÄTIGUNG PER MAIL: RAUMKALENDER → KUNDE
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (getrennt von den anderen Skripten in
 * apps-script/). Ersetzt die frühere Amelia-Terminbestätigung.
 *
 * ABLAUF
 * 1. Kunde bucht über WPForms → Termin landet im Anfragenkalender, die
 *    Kundendaten stehen in der Beschreibung (Block "Gastdaten:").
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
 *  - die Beschreibung enthält den Block "Gastdaten:" mit "Mail:"
 *  - im Titel steht der Vorname eines Teammitglieds (Liste TEAM unten).
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
 * VORLAGE: Google Doc VORLAGE_DOC_ID. Text, Fett/Kursiv, Links und das
 * Logo werden übernommen. Platzhalter stehen in doppelten geschweiften
 * Klammern: {{Vorname}} {{Name}} {{Datum}} {{Uhrzeit}} {{Begleitung}}
 * {{Dauer}} {{Preis}}. Jeder Platzhalter muss in EINEM Zug getippt/
 * formatiert sein (nicht halb fett, halb normal). Unbekannte oder
 * zerrissene Platzhalter → es wird nichts gesendet, Jörg bekommt eine Mail.
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

var VORLAGE_DOC_ID = '1zS4Cg7elvCFLtPA8o_UOsn6R_sjroRlvfWnL-XRpJJo';
var BETREFF = 'Terminbestätigung';
var ABSENDER_NAME = 'Spiritual Touch';
var ABSENDER_ALIAS = '';  // optional: Gmail-"Senden als"-Adresse, leer = Standardadresse (nur bei MODUS 'SENDEN')
var ANTWORT_AN = '';      // optional: Reply-To, leer = Absenderadresse

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
            'Alea', 'Stephanie', 'Karen', 'Maxine', 'Mila'];

var SCAN_TAGE_VORAUS = 180;
var TIMEZONE = 'Europe/Berlin';
var TAG_KEY = 'bestaetigung';

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

  var termin = leseTermin_(ev);
  if (!termin) return; // kein Kundentermin oder Begleitung im Titel fehlt noch

  var werte = werteFuerVorlage_(termin);
  var inhalt = rendereVorlage_(werte); // wirft bei Vorlagenfehler, BEVOR markiert wird

  // Erst markieren, dann senden: scheitert das Markieren, geht keine Mail raus.
  ev.setTag(TAG_KEY, 'in-arbeit');
  if (ev.getTag(TAG_KEY) !== 'in-arbeit') {
    throw new Error('Markierung am Termin konnte nicht gespeichert werden – nichts gesendet.');
  }
  try {
    sende_(termin.email, inhalt);
  } catch (err) {
    ev.deleteTag(TAG_KEY);
    throw err;
  }
  ev.setTag(TAG_KEY, MODUS === 'SENDEN' ? 'gesendet' : 'entwurf');
  Logger.log((MODUS === 'SENDEN' ? 'Gesendet' : 'Entwurf') + ': ' + termin.email +
    ' (' + raumName + ', ' + formatDatum_(termin.start) + ' ' + formatUhrzeit_(termin.start) + ')');
}

// ---------- TERMIN LESEN ----------

// Gibt null zurück, wenn der Termin (noch) nicht bestätigungsreif ist.
// Wirft nur, wenn er eindeutig ein Kundentermin ist, aber Daten fehlen.
function leseTermin_(ev) {
  var text = beschreibungAlsText_(ev.getDescription());
  var gastPos = text.search(/Gastdaten:/i);
  if (gastPos < 0) return null;

  var kopf = text.substring(0, gastPos);
  var gast = text.substring(gastPos);
  // Freitext des Kunden ("Nachricht:") nie auswerten.
  var nachrichtPos = gast.search(/^[ \t]*Nachricht:/mi);
  if (nachrichtPos >= 0) gast = gast.substring(0, nachrichtPos);

  var mail = gast.match(/^[ \t]*Mail:[ \t]*([^\s<>]+)/mi);
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail[1])) return null;

  var begleitung = findeBegleitung_(ev.getTitle());
  if (!begleitung) return null;

  var name = gast.match(/^[ \t]*Name:[ \t]*(.+)$/mi);
  if (!name || !name[1].trim()) throw new Error('Kundenname ("Name:") in der Beschreibung nicht gefunden.');

  var dauerPreis = kopf.match(/^[ \t]*Dauer:[ \t]*(.+?)[ \t]+-[ \t]+([\d.,]+)[ \t]*€/mi);
  if (!dauerPreis) throw new Error('Zeile "Dauer: … - … €" in der Beschreibung nicht gefunden.');

  return {
    email: mail[1],
    name: name[1].trim(),
    vorname: name[1].trim().split(/\s+/)[0],
    begleitung: begleitung,
    dauer: dauerPreis[1].trim(),
    preis: dauerPreis[2] + ' €',
    start: ev.getStartTime(),
  };
}

// Erster Teammitglied-Vorname im Titel (ganzes Wort, Groß-/Kleinschreibung egal).
function findeBegleitung_(titel) {
  var besteStelle = -1;
  var treffer = null;
  TEAM.forEach(function (vorname) {
    var m = new RegExp('(^|[^A-Za-zÀ-ÿ])' + vorname + '(?![A-Za-zÀ-ÿ])', 'i').exec(titel || '');
    if (m && (besteStelle < 0 || m.index < besteStelle)) {
      besteStelle = m.index;
      treffer = vorname;
    }
  });
  return treffer;
}

// Beschreibung kann als HTML gespeichert sein (z. B. Mail-Links) → in Text wandeln.
function beschreibungAlsText_(roh) {
  return String(roh || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}

function werteFuerVorlage_(t) {
  return {
    '{{Vorname}}': t.vorname,
    '{{Name}}': t.name,
    '{{Datum}}': formatDatum_(t.start),
    '{{Uhrzeit}}': formatUhrzeit_(t.start),
    '{{Begleitung}}': t.begleitung,
    '{{Dauer}}': t.dauer,
    '{{Preis}}': t.preis,
  };
}

function formatDatum_(d) {
  var wochentag = WOCHENTAGE[Number(Utilities.formatDate(d, TIMEZONE, 'u')) - 1];
  var tag = Number(Utilities.formatDate(d, TIMEZONE, 'd'));
  var monat = MONATE[Number(Utilities.formatDate(d, TIMEZONE, 'M')) - 1];
  return wochentag + ', ' + tag + '. ' + monat + ' ' + Utilities.formatDate(d, TIMEZONE, 'yyyy');
}

function formatUhrzeit_(d) {
  return Utilities.formatDate(d, TIMEZONE, 'HH:mm');
}

// ---------- VORLAGE (Google Doc → HTML + Text) ----------

function rendereVorlage_(werte) {
  var body = DocumentApp.openById(VORLAGE_DOC_ID).getBody();
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
    throw new Error('Platzhalter in der Vorlage sind uneinheitlich formatiert (' + zaehler.n + ' von ' +
      erwartet.length + ' ersetzt). Jeden Platzhalter am Stück und in einer Formatierung schreiben.');
  }

  return {
    html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f1b2a">' +
      absaetze.join('') + '</div>',
    text: ersetze_(vorlagenText, werte, { n: 0 }).replace(/\u000b/g, '\n'),
    bilder: bilder,
  };
}

function textAlsHtml_(text, werte, zaehler) {
  var s = text.getText();
  var idx = text.getTextAttributeIndices();
  var out = '';
  for (var k = 0; k < idx.length; k++) {
    var von = idx[k];
    var bis = k + 1 < idx.length ? idx[k + 1] : s.length;
    var stueck = s.substring(von, bis);
    if (!stueck) continue;
    var h = escapeHtml_(ersetze_(stueck, werte, zaehler)).replace(/\u000b|\n/g, '<br>');
    if (text.isBold(von)) h = '<strong>' + h + '</strong>';
    if (text.isItalic(von)) h = '<em>' + h + '</em>';
    var link = text.getLinkUrl(von);
    if (link) h = '<a href="' + escapeHtml_(link) + '" style="color:#1155cc">' + h + '</a>';
    out += h;
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

function sende_(an, inhalt) {
  var optionen = { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder };
  if (ANTWORT_AN) optionen.replyTo = ANTWORT_AN;
  if (MODUS === 'SENDEN') {
    if (ABSENDER_ALIAS) optionen.from = ABSENDER_ALIAS;
    GmailApp.sendEmail(an, BETREFF, inhalt.text, optionen);
  } else {
    GmailApp.createDraft(an, BETREFF, inhalt.text, optionen);
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

// Legt einen Entwurf mit Beispieldaten an ALERT_EMAIL an – zum Prüfen der
// Vorlage, ohne Kalender. Sendet nie an einen Kunden.
function vorlageTesten() {
  var inhalt = rendereVorlage_(werteFuerVorlage_({
    vorname: 'Max', name: 'Max Mustermann', begleitung: 'Asmita',
    dauer: '2 Stunden', preis: '290,00 €', start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  }));
  GmailApp.createDraft(ALERT_EMAIL, '[TEST] ' + BETREFF, inhalt.text,
    { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder });
  Logger.log('Test-Entwurf an ' + ALERT_EMAIL + ' liegt in Gmail unter Entwürfe.');
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
