/**
 * FEEDBACK-MAIL-ENTWÜRFE (täglich)
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt, läuft als joerg@spiritual-touch.de.
 *
 * ZWECK: 3 Tage nach einem Termin in Raum 1–3 bekommt der Gast eine
 * Feedback-Mail — als GMAIL-ENTWURF (Vorlage "Nachklang Deines Termins").
 * Zusätzlich entsteht EINE Todoist-Aufgabe "Feedback-Mails freigeben
 * (Datum)" mit Links zu allen neuen Entwürfen. Jörg prüft und sendet selbst.
 *
 * DAS SKRIPT SENDET NIE EINE MAIL AN GÄSTE und schreibt nirgends in einen
 * Kalender. Einziger Schreibzugriff: Gmail-Entwürfe + Todoist-Aufgabe +
 * (nur bei Fehlern) eine Alert-Mail an Jörg.
 *
 * REGELN
 * - Quelle ist der KALENDER (tatsächlicher Termin), nicht das Gmail-Label.
 * - Fenster: Termine von heute−5 bis heute−3 Tage (3 Tage = Regelfall, die
 *   2 davor fangen einen ausgefallenen Lauf auf; Doppelte verhindert die
 *   Gmail-Prüfung unten).
 * - NUR Termine mit Gast-Mailadresse (Zeile "Mail:" in der Beschreibung).
 *   Alle anderen werden still ignoriert.
 * - Paar: gleiche Adresse mit zwei zeitgleichen Terminen (zwei Räume) oder
 *   Titel mit "Paar/Pärchen/Couple/zu zweit/zu dritt" -> EINE Mail an die
 *   vorhandene Adresse, beide Vornamen, Euch/Ihr-Form.
 * - Eine Mail pro Adresse, auch bei mehreren Terminen im Fenster.
 * - Doppelschutz: gibt es schon einen Entwurf oder (14 Tage) eine gesendete
 *   Mail mit "Nachklang"/"Afterglow" an die Adresse -> überspringen. Schlägt
 *   die Prüfung fehl -> lieber KEIN Entwurf.
 * - Zustandslos: kein eigenes Gedächtnis, jeder Lauf prüft frisch.
 *
 * EINRICHTUNG: siehe README.md in diesem Ordner.
 */

// ---------- KONFIGURATION ----------

var ROOM_CALENDAR_IDS = [
  'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com', // Raum 1
  'c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com', // Raum 2
  'c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com', // Raum 3
];
var ROOM_NAMES = ['Raum 1', 'Raum 2', 'Raum 3'];

var DAYS_NEAR = 3; // Regelfall: Termin war vor 3 Tagen
var DAYS_FAR = 5;  // ältester noch berücksichtigter Termin (Auffangfenster)

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// Keine Gäste: eigene Domain und der WPForms-Platzhalter aus den Kalendereinträgen.
var IGNORED_DOMAINS = ['spiritual-touch.de'];
var IGNORED_ADDRESSES = ['wpforms-calender-dummy@tutamail.com'];

// Todoist: Token liegt NICHT im Code, sondern unter Projekteinstellungen →
// Skripteigenschaften → TODOIST_TOKEN (Todoist → Einstellungen → Integrationen
// → Entwickler → API-Token). Fehlt er, entstehen nur die Entwürfe und Jörg
// bekommt eine Fehlermail.
var TODOIST_API_URL = 'https://api.todoist.com/api/v1/tasks';

// Signatur: Quelle 1 ist ein Entwurf mit genau diesem Betreff, in den Jörg die
// gewünschte Gmail-Signatur ("Jörg ST.") eingefügt hat (siehe README). Quelle 2
// ist die Standard-Signatur aus den Gmail-Einstellungen (Gmail-API). Quelle 3
// der Text-Fallback unten.
var SIGNATURE_TEMPLATE_SUBJECT = 'Signatur-Vorlage';

// Fallback, falls keine Signatur geladen werden kann.
var SIGNATURE_FALLBACK_HTML =
  '<b>Institutsleitung</b><br><i>Spiritual Touch</i><br>' +
  '<a href="https://spiritual-touch.de">spiritual-touch.de</a>';

// ---------- TEXTVORLAGEN ----------
// Jede Vorlage: Betreff + Absätze (Zeilen eines Absatzes mit \n). {A} = Anrede.

var TEMPLATES = {
  'de-single': {
    subject: 'Nachklang Deines Termins',
    paragraphs: [
      '{A}',
      'danke für Dein Vertrauen und Deine Offenheit, dass wir mit Dir ein berührendes Erlebnis teilen konnten.',
      'Wir hoffen, der Termin klingt auf eine gute Weise in Dir nach.',
      'Wenn Du magst, teile gern mit uns, wie Du die Begegnung erlebt hast. Wir lesen wirklich gern Geschichten und Erlebnisse!\nAuch freuen wir uns über ehrliches Feedback, dadurch wachsen wir und schärfen unsere Wahrnehmung.',
      'Wir freuen uns auf ein Wiedersehen!',
      'Von Herzen\nEva & Jörg',
    ],
  },
  'de-couple': {
    subject: 'Nachklang Eures Termins',
    paragraphs: [
      '{A}',
      'danke für Euer Vertrauen und Eure Offenheit, dass wir mit Euch ein berührendes Erlebnis teilen konnten.',
      'Wir hoffen, der Termin klingt auf eine gute Weise in Euch nach.',
      'Wenn Ihr mögt, teilt gern mit uns, wie Ihr die Begegnung erlebt habt. Wir lesen wirklich gern Geschichten und Erlebnisse!\nAuch freuen wir uns über ehrliches Feedback, dadurch wachsen wir und schärfen unsere Wahrnehmung.',
      'Wir freuen uns auf ein Wiedersehen mit Euch!',
      'Von Herzen\nEva & Jörg',
    ],
  },
  'en-single': {
    subject: 'Afterglow of your appointment',
    paragraphs: [
      '{A}',
      'thank you for your trust and openness, and for letting us share a touching experience with you.',
      'We hope the appointment continues to resonate with you in a good way.',
      'If you like, feel free to share how you experienced the encounter. We truly enjoy reading stories and experiences!\nWe also welcome honest feedback – it helps us grow and sharpen our awareness.',
      'We look forward to seeing you again!',
      'With all our hearts\nEva & Jörg',
    ],
  },
  'en-couple': {
    subject: 'Afterglow of your appointment',
    paragraphs: [
      '{A}',
      'thank you for your trust and openness, and for letting us share a touching experience with you both.',
      'We hope the appointment continues to resonate with you both in a good way.',
      'If you like, feel free to share how you experienced the encounter. We truly enjoy reading stories and experiences!\nWe also welcome honest feedback – it helps us grow and sharpen our awareness.',
      'We look forward to seeing you both again!',
      'With all our hearts\nEva & Jörg',
    ],
  },
};

// ---------- REINE LOGIK (ohne Google-Dienste, einzeln testbar) ----------

function decodeEntities_(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}

function isIgnoredAddress_(email) {
  var e = String(email).toLowerCase();
  if (IGNORED_ADDRESSES.indexOf(e) !== -1) return true;
  var domain = e.split('@')[1] || '';
  return IGNORED_DOMAINS.indexOf(domain) !== -1;
}

var EMAIL_REGEX_ = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

function findEmails_(text) {
  var found = String(text || '').match(EMAIL_REGEX_) || [];
  var out = [];
  found.forEach(function (m) {
    var e = m.toLowerCase();
    if (!isIgnoredAddress_(e) && out.indexOf(e) === -1) out.push(e);
  });
  return out;
}

/**
 * Liest Gast-Daten aus einer Terminbeschreibung.
 * Gibt null zurück, wenn keine Gast-Mailadresse gefunden wird.
 */
function parseGuest_(description) {
  var text = decodeEntities_(description || '');
  var email = null;

  // 1. Zeile "Mail:" (ggf. mit <a href="mailto:...">)
  var mailLine = text.match(/^[ \t]*Mail:[ \t]*(.*)$/im);
  if (mailLine) {
    var inLine = findEmails_(mailLine[1]);
    if (inLine.length) email = inLine[0];
  }
  // 2. sonst: genau EINE brauchbare Adresse irgendwo in der Beschreibung
  if (!email) {
    var all = findEmails_(text);
    if (all.length === 1) email = all[0];
  }
  if (!email) return null;

  var nameLine = text.match(/^[ \t]*Name:[ \t]*(.+)$/im);
  var langLine = text.match(/^[ \t]*Sprache:[ \t]*(.+)$/im);
  return {
    email: email,
    name: nameLine ? nameLine[1].trim() : '',
    lang: langLine && /english|englisch/i.test(langLine[1]) ? 'en' : 'de',
  };
}

/** "Anna & Tom" -> ["Anna","Tom"]; je Teil nur das erste Wort (Vorname). */
function firstNames_(name) {
  return String(name || '')
    .split(/\s*(?:&|\+|\/|,|\bund\b|\band\b)\s*/i)
    .map(function (p) { return p.trim().split(/\s+/)[0]; })
    .filter(function (p) { return p; })
    .slice(0, 2);
}

function greeting_(names, lang) {
  var hello = lang === 'en' ? 'Dear' : 'Hallo';
  var and = lang === 'en' ? ' and ' : ' und ';
  if (!names.length) return (lang === 'en' ? 'Hello' : 'Hallo') + ',';
  return hello + ' ' + names.join(and) + ',';
}

function overlaps_(a, b) {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * events: [{email,name,lang,title,room,start,end}]
 * -> pro Adresse EIN Gast: {email,names,lang,couple,start,room}
 */
function groupGuests_(events) {
  var byEmail = {};
  var order = [];
  events.forEach(function (ev) {
    if (!byEmail[ev.email]) { byEmail[ev.email] = []; order.push(ev.email); }
    byEmail[ev.email].push(ev);
  });
  return order.map(function (email) {
    var evs = byEmail[email].slice().sort(function (a, b) { return a.start - b.start; });
    var couple = evs.some(function (e) { return /paar|pärchen|couple|zu zweit|zu dritt/i.test(e.title || ''); });
    for (var i = 0; i < evs.length && !couple; i++) {
      for (var j = i + 1; j < evs.length; j++) {
        if (overlaps_(evs[i], evs[j])) { couple = true; break; }
      }
    }
    // Namen: erster Termin mit Namen; bei Paar aus allen Terminen bis max. 2 sammeln
    var names = [];
    evs.forEach(function (e) {
      firstNames_(e.name).forEach(function (n) {
        if (names.length < 2 && names.indexOf(n) === -1) names.push(n);
      });
    });
    if (!couple) names = names.slice(0, 1);
    var first = evs[0];
    return { email: email, names: names, lang: first.lang, couple: couple, start: first.start, room: first.room };
  });
}

function buildMail_(guest) {
  var tpl = TEMPLATES[guest.lang + '-' + (guest.couple ? 'couple' : 'single')];
  var paragraphs = tpl.paragraphs.map(function (p) {
    return p.replace('{A}', greeting_(guest.names, guest.lang));
  });
  return { subject: tpl.subject, paragraphs: paragraphs };
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toPlain_(paragraphs) { return paragraphs.join('\n\n'); }

function toHtml_(paragraphs, signatureHtml) {
  var body = paragraphs.map(function (p) {
    return '<p>' + escapeHtml_(p).replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return body + '<div>-- <br>' + signatureHtml + '</div>';
}

// ---------- HAUPTFUNKTION (Trigger: einmal täglich) ----------

function createFeedbackDrafts() { runFeedback_(false); }

/** Probelauf: zeigt im Protokoll, was passieren würde — erstellt nichts. */
function dryRun() { runFeedback_(true); }

function runFeedback_(isDryRun) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log('Anderer Lauf aktiv – übersprungen.'); return; }
  var errors = [];
  try {
    // --- Zeitfenster (Skript-Zeitzone Europe/Berlin) ---
    var today = new Date();
    var from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - DAYS_FAR);
    var to = new Date(today.getFullYear(), today.getMonth(), today.getDate() - DAYS_NEAR + 1); // exklusiv

    // --- Termine lesen ---
    var events = [];
    ROOM_CALENDAR_IDS.forEach(function (calId, i) {
      var cal = CalendarApp.getCalendarById(calId);
      if (!cal) { errors.push(ROOM_NAMES[i] + ': Kalender nicht gefunden/kein Zugriff'); return; }
      cal.getEvents(from, to).forEach(function (ev) {
        if (ev.isAllDayEvent()) return;
        var guest = parseGuest_(ev.getDescription());
        if (!guest) return; // ohne Gast-Mail: ignorieren
        events.push({
          email: guest.email, name: guest.name, lang: guest.lang,
          title: ev.getTitle(), room: ROOM_NAMES[i],
          start: ev.getStartTime(), end: ev.getEndTime(),
        });
      });
    });
    var guests = groupGuests_(events);

    // --- Entwürfe anlegen ---
    var created = [];
    var skipped = [];
    var existingDraftTo = null;
    var signature = null;

    guests.forEach(function (g) {
      try {
        if (existingDraftTo === null) existingDraftTo = loadExistingDraftAddresses_();
        if (existingDraftTo.indexOf(g.email) !== -1 || hasSentFeedback_(g.email)) {
          skipped.push(g.email + ' (schon vorhanden)');
          return;
        }
        var mail = buildMail_(g);
        if (isDryRun) {
          Logger.log('[Probelauf] Entwurf an ' + g.email + ' | ' + mail.subject + ' | ' +
            (g.couple ? 'Paar' : 'Einzel') + ' | ' + g.lang + '\n' + toPlain_(mail.paragraphs));
          created.push({ guest: g, url: '(Probelauf)' });
          return;
        }
        if (signature === null) {
          signature = loadSignature_();
          Logger.log('Signatur-Quelle: ' + signature.source);
        }
        var options = { htmlBody: toHtml_(mail.paragraphs, signature.html) };
        if (signature.inlineImages) options.inlineImages = signature.inlineImages;
        var draft = GmailApp.createDraft(g.email, mail.subject, toPlain_(mail.paragraphs), options);
        existingDraftTo.push(g.email);
        created.push({
          guest: g,
          url: 'https://mail.google.com/mail/u/0/#drafts?compose=' + draft.getMessageId(),
        });
      } catch (e) {
        errors.push('Entwurf für ' + g.email + ': ' + e.message);
      }
    });

    // --- Todoist ---
    if (created.length && !isDryRun) {
      try { createTodoistTask_(created); } catch (e) { errors.push('Todoist: ' + e.message); }
    }

    Logger.log('Entwürfe: ' + created.length + ' | übersprungen: ' + skipped.length +
      ' | Fehler: ' + errors.length);
    if (skipped.length) Logger.log('Übersprungen: ' + skipped.join(', '));
  } catch (e) {
    errors.push('Unerwarteter Fehler: ' + e.message);
  } finally {
    lock.releaseLock();
  }
  if (errors.length) {
    Logger.log('FEHLER:\n' + errors.join('\n'));
    if (!isDryRun) sendAlert_('Fehler', errors.join('\n'));
  }
}

// ---------- GMAIL ----------

/** Alle Empfängeradressen bestehender Feedback-Entwürfe (Nachklang/Afterglow). */
function loadExistingDraftAddresses_() {
  var out = [];
  GmailApp.getDrafts().forEach(function (d) {
    var m = d.getMessage();
    if (!/nachklang|afterglow/i.test(m.getSubject())) return;
    findEmails_(m.getTo() + ' ' + m.getCc()).forEach(function (e) { out.push(e); });
  });
  return out;
}

function hasSentFeedback_(email) {
  var q = 'in:sent to:' + email + ' (subject:Nachklang OR subject:Afterglow) newer_than:14d';
  return GmailApp.search(q, 0, 1).length > 0;
}

/**
 * Liefert {html, inlineImages, source}.
 * 1. Entwurf "Signatur-Vorlage": exakt die dort eingefügte Gmail-Signatur
 *    (so kann gezielt "Jörg ST." gewählt werden – die Gmail-API kennt nur die
 *    Standard-Signatur).
 * 2. Standard-Signatur aus den Gmail-Einstellungen (Gmail-API, Dienst nötig).
 * 3. Text-Fallback.
 */
function loadSignature_() {
  try {
    var fromTemplate = loadSignatureFromTemplateDraft_();
    if (fromTemplate) return fromTemplate;
  } catch (e) {
    Logger.log('Signatur-Vorlage nicht lesbar: ' + e.message);
  }
  try {
    var list = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
    var def = list.filter(function (x) { return x.isDefault; })[0] || list[0];
    if (def && def.signature) return { html: def.signature, inlineImages: null, source: 'Gmail-Standard-Signatur' };
  } catch (e) {
    Logger.log('Gmail-API-Signatur nicht verfügbar: ' + e.message);
  }
  return { html: SIGNATURE_FALLBACK_HTML, inlineImages: null, source: 'Text-Fallback' };
}

function loadSignatureFromTemplateDraft_() {
  var drafts = GmailApp.getDrafts().filter(function (d) {
    return d.getMessage().getSubject() === SIGNATURE_TEMPLATE_SUBJECT;
  });
  if (!drafts.length) return null;
  var msg = drafts[0].getMessage();
  var html = msg.getBody();
  // Ab dem Signatur-Block; sonst ganzer Entwurfstext.
  var m = html.match(/<div[^>]*(?:class="gmail_signature"|data-smartmail="gmail_signature")[^>]*>/i);
  if (m) html = html.substring(html.indexOf(m[0]));

  // Eingebettete Bilder (z. B. Logo) übernehmen: der i-te nicht-externe <img>
  // bekommt das i-te eingebettete Bild des Entwurfs.
  var blobs = msg.getAttachments({ includeInlineImages: true, includeAttachments: false });
  var inline = {};
  var idx = 0;
  html = html.replace(/<img\b[^>]*>/gi, function (tag) {
    var src = (tag.match(/\bsrc="([^"]*)"/i) || [])[1] || '';
    if (/^https?:\/\//i.test(src) && !/mail\.google\.com/i.test(src)) return tag; // extern gehostet
    var blob = blobs[idx++];
    if (!blob) return tag;
    var key = 'sigimg' + idx;
    inline[key] = blob;
    return tag.replace(/\bsrc="[^"]*"/i, 'src="cid:' + key + '"');
  });
  return {
    html: html,
    inlineImages: idx ? inline : null,
    source: 'Entwurf "' + SIGNATURE_TEMPLATE_SUBJECT + '"' + (idx ? ' (' + idx + ' Bild/er)' : ''),
  };
}

// ---------- TODOIST ----------

function createTodoistTask_(created) {
  var token = PropertiesService.getScriptProperties().getProperty('TODOIST_TOKEN');
  if (!token) throw new Error('Skripteigenschaft TODOIST_TOKEN fehlt – Aufgabe nicht erstellt (siehe README, Einrichtung Schritt 3).');

  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy');
  var lines = created.map(function (c) {
    var g = c.guest;
    var who = g.names.length ? g.names.join(' & ') : g.email;
    return '- ' + who + ' · Termin ' + Utilities.formatDate(g.start, tz, 'dd.MM.') + ' · ' + g.room +
      ' · ' + (g.lang === 'en' ? 'English' : 'Deutsch') + ' · ' + (g.couple ? 'Paar' : 'Einzel') +
      ' · ' + c.url;
  });
  var res = UrlFetchApp.fetch(TODOIST_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      content: 'Feedback-Mails freigeben (' + todayStr + ')',
      description: lines.join('\n'),
      due_string: 'today',
      due_lang: 'de',
    }),
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  }
}

// ---------- ALERT / TRIGGER ----------

function sendAlert_(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Feedback-Mail-Entwürfe: ' + subject, body);
  } catch (e) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + e.message);
  }
}

/** Einmal manuell ausführen: legt den Tages-Trigger an (ersetzt einen vorhandenen). */
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'createFeedbackDrafts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('createFeedbackDrafts').timeBased().everyDays(1).atHour(8).create();
}
