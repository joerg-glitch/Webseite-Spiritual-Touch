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

// Nur für das Kurzformat (eigene Termine, Formular 2): dort steht kein Preis
// in der Beschreibung. Schlüssel = Dauer wie im Titel ("2 Stunden", "2,5 Stunden",
// "90 Minuten"), Wert = Preis wie in der Mail. Fehlt die Dauer hier, wird NICHT
// gesendet und Jörg bekommt eine Fehlermail. Steht ein Preis mit €-Zeichen in
// der Beschreibung, hat der Vorrang.
var PREISLISTE = {
  '2 Stunden': '290,00 €',
  '2,5 Stunden': '340,00 €',
  '3 Stunden': '390,00 €',
};

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
    ' (' + raumName + ', ' + termin.sprache + ', ' + formatDatum_(termin.start) + ' ' + formatUhrzeit_(termin.start) + ')');
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

// Kurzformat des zweiten WPForms-Formulars (eigene Termine), ohne
// Beschriftungen. Beispiel Beschreibung:
//   Thomas / Deutsch / 393315824625 / thomas@example.com / 1653 (Eintrags-ID)
// und Titel "Tantramassage 2,5 Stunden Maxine". Die Dauer steht im Titel, die
// Sprache als eigene Zeile, der Preis nicht (siehe PREISLISTE).
// Gibt null zurück, wenn keine eigenständige Mailzeile oder keine Begleitung
// im Titel vorhanden ist (dann ist es kein Kundentermin bzw. noch nicht fertig).
function leseKurzformat_(ev, text) {
  var zeilen = text.split(ZEILENUMBRUCH)
    .map(function (z) { return z.trim(); })
    .filter(function (z) { return z; });

  var mailIdx = -1;
  zeilen.forEach(function (z, i) {
    if (mailIdx < 0 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(z)) mailIdx = i;
  });
  if (mailIdx < 0) return null;

  var titel = ev.getTitle() || '';
  var begleitung = findeBegleitung_(titel);
  if (!begleitung) return null;

  // Name = erste Zeile, muss vor der Mailzeile stehen und echter Text sein.
  var name = mailIdx > 0 ? zeilen[0] : '';
  if (!name || /^[\d\s+().\/-]+$/.test(name) || /^(deutsch|german|english|englisch)$/i.test(name)) {
    throw new Error('Kundenname (erste Zeile der Beschreibung) nicht gefunden.');
  }

  var dauerMatch = titel.match(/(\d+(?:[.,]\d+)?)\s*(Stunden?|Std\.?|h|Minuten?|Min\.?)(?![A-Za-zÀ-ÿ])/i);
  if (!dauerMatch) {
    throw new Error('Dauer im Titel nicht gefunden (z. B. "Tantramassage 2,5 Stunden Maxine"). Titel: ' +
      JSON.stringify(titel));
  }
  var zahl = dauerMatch[1].replace('.', ',');
  var istMinuten = /^min/i.test(dauerMatch[2]);
  var dauer = zahl + ' ' + (istMinuten ? 'Minuten' : (zahl === '1' ? 'Stunde' : 'Stunden'));

  var preis = null;
  var preisMatch = text.match(/(\d[\d.,]*)\s*(?:€|&euro;|EUR)/i);
  if (preisMatch) preis = preisMatch[1] + ' €';
  else if (PREISLISTE[dauer]) preis = PREISLISTE[dauer];
  if (!preis) {
    throw new Error('Kein Preis für "' + dauer + '" bekannt. Bitte in der Beschreibung ergänzen (z. B. "290 €") ' +
      'oder in PREISLISTE im Skript eintragen.');
  }

  var sprache = 'de';
  zeilen.forEach(function (z) { if (/^(english|englisch)$/i.test(z)) sprache = 'en'; });

  return {
    email: zeilen[mailIdx],
    sprache: sprache,
    name: name,
    vorname: name.split(/\s+/)[0],
    begleitung: begleitung,
    dauer: dauer,
    preis: preis,
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
