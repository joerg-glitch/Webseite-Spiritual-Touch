/**
 * TERMINBESTÄTIGUNG PER MAIL (EIGENE TERMINE): VERFÜGBARKEITSKALENDER → KUNDE
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt, Schwester von
 * apps-script/terminbestaetigung-mail/ (dort: Buchungen über das
 * Buchungsformular, die Jörg in einen Raumkalender kopiert). Gleiche Logik,
 * gleiche Mailvorlagen – nur der Weg des Termins ist ein anderer.
 *
 * ABLAUF
 * 1. Jörg trägt einen eigenen Termin über das zweite WPForms-Formular ein
 *    (ohne Buchungsformular). Der Termin landet im Kalender "Verfügbarkeit"
 *    (nicht im Anfragenkalender); die Kundendaten stehen in der
 *    Beschreibung (Block "Gastdaten:", gleiches Format wie beim
 *    Buchungsformular).
 * 2. Im Titel steht die Begleitung, z. B. "Tantramassage 2h (Asmita)".
 *    ACHTUNG: Der Titel darf NICHT mit "Vorname " oder "Vorname(" eines
 *    Teammitglieds beginnen – sonst wertet der Verfügbarkeit-Sync
 *    (team-app/App Script - Sync) den Termin als Verfügbarkeit dieser Person.
 * 3. Dieses Skript läuft alle 10 Minuten, findet neue Termine im
 *    Verfügbarkeitskalender, liest Kunde/Dauer/Preis aus der Beschreibung
 *    und die Begleitung aus dem Titel, füllt die Mailvorlage (Google Doc)
 *    und verschickt die Bestätigung an den Kunden.
 *
 * DOPPELVERSAND VERMEIDEN: Diese Termine NICHT zusätzlich in einen
 * Raumkalender kopieren – dort würde das Schwesterskript
 * (terminbestaetigung-mail) ein zweites Mal bestätigen. Die beiden Projekte
 * teilen keine Markierungen.
 *
 * WANN GILT EIN TERMIN ALS "BESTÄTIGUNGSREIF"? (alles muss zutreffen)
 *  - liegt im Verfügbarkeitskalender, ist kein Ganztagstermin
 *    (Verfügbarkeiten aus der Team-App sind ganztägig und werden so nie
 *    angefasst)
 *  - wurde NACH dem Einrichten (AKTIV_SEIT) angelegt → Altbestand wird nie
 *    angefasst
 *  - die Beschreibung enthält den Block "Gastdaten:" mit "Mail:"
 *    (Verfügbarkeiten ohne Kundenmail werden ignoriert)
 *  - im Titel steht der Vorname eines Teammitglieds (Liste TEAM unten).
 *    Solange er fehlt, wartet das Skript einfach – es rät nie.
 *  - noch nicht markiert (siehe unten)
 *
 * KEIN DOPPELVERSAND: Vor dem Versand wird am Termin eine unsichtbare
 * Markierung gesetzt (CalendarEvent.setTag). Schlägt das Markieren fehl
 * (z. B. fehlende Schreibrechte), wird NICHT gesendet — das ist die Lehre
 * aus dem Vorfall vom 26.08.2026 (raum-einladung-sync/Code.gs). Schlägt der
 * Versand fehl, wird die Markierung wieder entfernt, der nächste Lauf
 * versucht es erneut; Jörg bekommt dazu eine Fehlermail (max. 1× alle 6 h
 * je Termin). Verschiebt oder ändert jemand den Termin später, wird NICHT
 * erneut bestätigt. Die Markierung ("bestaetigung") kollidiert nicht mit den
 * Tags des Verfügbarkeit-Syncs ("member", "from", "to").
 *
 * VORLAGE: wie im Schwesterskript – Google Doc je Sprache (VORLAGEN).
 * Platzhalter: {{Vorname}} {{Name}} {{Datum}} {{Uhrzeit}} {{Begleitung}}
 * {{Dauer}} {{Preis}}. Unbekannte Platzhalter → es wird nichts gesendet,
 * Jörg bekommt eine Mail.
 *
 * SETUP
 * 1. NEUES Projekt auf script.google.com als joerg@spiritual-touch.de
 *    (nicht in das Schwesterprojekt einfügen).
 * 2. Code.gs und appsscript.json einfügen.
 * 3. Funktion "vorlageTesten" ausführen → Berechtigungen erlauben → es
 *    liegen zwei Entwürfe (de/en) mit Beispieldaten in Gmail. Prüfen.
 * 4. Funktion "einrichten" ausführen (setzt AKTIV_SEIT = jetzt und legt den
 *    10-Minuten-Trigger an). Nur einmal nötig.
 * 5. Testtermin NEU über das Formular anlegen (ältere zählen nicht).
 * 6. Wenn alles passt: MODUS unten von 'ENTWURF' auf 'SENDEN' stellen.
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

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// Kalender "Verfügbarkeit" (ID aus team-app/App Script - Sync). Dorthin schreibt
// das zweite WPForms-Formular die eigenen Termine.
var QUELL_KALENDER = [
  { name: 'Verfügbarkeit', id: 'c_ee44c7789562024b0ecb48ebe4d7b68bf09bceb26b28821a49ea7b05cd85c915@group.calendar.google.com' },
];

// Vornamen, wie sie im Termintitel stehen dürfen. Neues Teammitglied =
// hier ergänzen.
var TEAM = ['Tara', 'Eva', 'Jörg', 'Asmita', 'Amila', 'Sarah', 'Dominik', 'Konstantin',
            'Alea', 'Stephanie', 'Karen', 'Maxine', 'Mila'];

var SCAN_TAGE_VORAUS = 180;
var TIMEZONE = 'Europe/Berlin';
var TAG_KEY = 'bestaetigung';

// Weiche Zeilenumbrüche (Shift+Enter) liefert Apps Script je nach Quelle als
// \r, \u000b oder   – alle gelten als Umbruch.
var ZEILENUMBRUCH = /\r\n|\r|\u000b| |\n/g;

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

    QUELL_KALENDER.forEach(function (quelle) {
      var kalender = CalendarApp.getCalendarById(quelle.id);
      if (!kalender) {
        meldeFehler_('kalender-' + quelle.id, 'Kalender nicht gefunden',
          quelle.name + ' (' + quelle.id + '): nicht gefunden oder kein Zugriff.');
        return;
      }
      kalender.getEvents(jetzt, bis).forEach(function (ev) {
        try {
          verarbeiteTermin_(ev, quelle.name, aktivSeit);
        } catch (err) {
          meldeFehler_('termin-' + ev.getId(), 'Bestätigung nicht gesendet',
            quelle.name + ': "' + ev.getTitle() + '" am ' + formatDatum_(ev.getStartTime()) +
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

function verarbeiteTermin_(ev, quellName, aktivSeit) {
  if (ev.isAllDayEvent()) return;
  if (ev.getTag(TAG_KEY)) return;                       // schon bearbeitet
  if (ev.getDateCreated().getTime() < aktivSeit) return; // Altbestand

  var termin = leseTermin_(ev);
  if (!termin) return; // kein Kundentermin oder Begleitung im Titel fehlt noch

  var vorlage = VORLAGEN[termin.sprache];
  var werte = werteFuerVorlage_(termin);
  var inhalt = rendereVorlage_(werte, vorlage.docId); // wirft bei Vorlagenfehler, BEVOR markiert wird

  // Erst markieren, dann senden: scheitert das Markieren, geht keine Mail raus.
  ev.setTag(TAG_KEY, 'in-arbeit');
  if (ev.getTag(TAG_KEY) !== 'in-arbeit') {
    throw new Error('Markierung am Termin konnte nicht gespeichert werden – nichts gesendet.');
  }
  try {
    sende_(termin.email, vorlage.betreff, inhalt);
  } catch (err) {
    ev.deleteTag(TAG_KEY);
    throw err;
  }
  ev.setTag(TAG_KEY, MODUS === 'SENDEN' ? 'gesendet' : 'entwurf');
  Logger.log((MODUS === 'SENDEN' ? 'Gesendet' : 'Entwurf') + ': ' + termin.email +
    ' (' + quellName + ', ' + termin.sprache + ', ' + formatDatum_(termin.start) + ' ' + formatUhrzeit_(termin.start) + ')');
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

  // "Dauer: 2 Stunden - 290,00 €" – Strich darf auch ein Gedankenstrich sein,
  // Währung €, "&euro;" (falls nicht entschlüsselt) oder EUR.
  var dauerPreis = kopf.match(/^[ \t]*Dauer:[ \t]*(.+?)[ \t]+[-–—][ \t]+([\d.,]+)[ \t]*(?:€|&euro;|EUR)/mi);
  if (!dauerPreis) {
    var zeile = kopf.match(/^.*Dauer.*$/mi);
    throw new Error('Zeile "Dauer: … - … €" in der Beschreibung nicht gefunden. Gefunden wurde: ' +
      (zeile ? JSON.stringify(zeile[0]) : '(keine Zeile mit "Dauer")'));
  }

  // Zeile "Sprache: English" / "Sprache: Deutsch" (auch "Language:"). Nur der
  // Gastdaten-Block zählt; alles außer eindeutig Englisch → Deutsch.
  var sprachZeile = gast.match(/^[ \t]*(?:Sprache|Language)[^:\n]*:[ \t]*(.+)$/mi);
  var sprache = (sprachZeile && /engl/i.test(sprachZeile[1]) && !/^\s*(deutsch|german)/i.test(sprachZeile[1])) ? 'en' : 'de';

  return {
    email: mail[1],
    sprache: sprache,
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

function sende_(an, betreff, inhalt) {
  var optionen = { htmlBody: inhalt.html, name: ABSENDER_NAME, inlineImages: inhalt.bilder };
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

// Falls ein Termin noch einmal bestätigt werden muss: im Kalender lässt sich
// die Markierung nicht sehen – einfachster Weg ist, den Termin neu über das
// Formular anzulegen und den alten zu löschen.

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
    GmailApp.sendEmail(ALERT_EMAIL, 'Terminbestätigung (eigene Termine): ' + betreff, text);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
