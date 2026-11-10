/**
 * Monatsabrechnungsliste → Gmail-Entwurf (für die Übergabe an sevdesk)
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (wie alle anderen Bausteine: ein
 * Prozess = ein Projekt). Liest nur Kalender, schreibt ausschließlich einen
 * Entwurf in Jörgs Gmail — verändert keinen Termin, keinen anderen Sync.
 *
 * WAS ES TUT
 *   Am 1. eines Monats (genauer: beim ersten Lauf ab dem 1.) werden die
 *   Raumkalender "Raum 1", "Raum 2", "Raum 3" und "Raum extern (z.B. GdT)"
 *   für den komplett abgelaufenen Vormonat ausgelesen. Jeder stattgefundene
 *   Termin wird eine Zeile mit:
 *       Art des Termins | Dauer | Datum (+ Uhrzeit) | Teammitglied
 *   Die Liste landet als HTML-Tabelle im Gmail-ENTWURF (nicht versendet!)
 *   plus als CSV-Anhang (Semikolon, UTF-8, Excel/sevdesk-tauglich).
 *
 * WIE DAS TEAMMITGLIED ERMITTELT WIRD (in dieser Reihenfolge)
 *   1. Name eines Teammitglieds im TITEL des Termins.
 *   2. Anleger des Termins ("Erstellt von: …"): Mailadresse bzw. Anzeigename
 *      wird dem Teammitglied zugeordnet (TEAM_MEMBERS: Vorname im
 *      Mail-Vorderteil / Anzeigename, oder explizit in `emails`).
 *   3. Sonst: UNBEKANNT / Raumvermietung — der Termin kommt trotzdem in die
 *      Liste, mit dem Namen des Anlegers ("Extern: Stefanie Graul"), damit
 *      auch Fremd-/Mietermine abgerechnet werden können.
 *   Die BESCHREIBUNG wird dafür bewusst NICHT ausgewertet: Dort stehen nur
 *   Gastnamen, nie das Teammitglied.
 *
 * ART DES TERMINS
 *   Wird aus dem Titel bestimmt (ART_RULES). Abkürzungen werden aufgelöst,
 *   z. B. "TM" → "Tantramassage". Passt keine Regel, steht der Titel ohne
 *   Teammitglied-Name in der Spalte. Der Original-Titel steht zusätzlich in
 *   einer eigenen Spalte.
 *
 * ROBUSTHEIT
 *   - Täglicher Trigger mit "Nachholen": Die Funktion merkt sich, für welchen
 *     Monat schon ein Entwurf erstellt wurde. Fällt der Lauf am 1. aus
 *     (Google-Störung, Berechtigung abgelaufen …), wird er am nächsten Tag
 *     automatisch wiederholt — nie doppelt, nie vergessen.
 *   - Calendar-API-Aufrufe mit Wiederholung + Wartezeit (Rate-Limits,
 *     kurze Ausfälle). Seiten werden komplett durchgeblättert.
 *   - Sperre gegen parallele Läufe (LockService).
 *   - Ein nicht lesbarer Raumkalender bricht den Lauf ab (kein stiller
 *     Teil-Bericht) und löst eine Warnmail aus; ab dem 5. des Monats wird
 *     stattdessen ein Entwurf MIT deutlichem Warnhinweis erstellt, damit die
 *     Abrechnung nicht ewig blockiert.
 *   - Bereits vorhandener Entwurf mit demselben Betreff → kein zweiter.
 *   - Recurring-Termine werden als Einzeltermine ausgewertet
 *     (singleEvents), abgesagte und von Jörg abgelehnte Termine entfallen,
 *     Sync-Blocker ("Blockiert (…)"/autoBlock) und Doubletten
 *     (gleiche Termin-ID oder gleicher Raum+Titel+Zeit) ebenfalls.
 *   - Ganztägige Termine haben keine echte Dauer → eigener Abschnitt
 *     "Bitte prüfen", nicht in der Summe.
 *
 * DEPLOYMENT: siehe README.md in diesem Ordner.
 */

// ---------- KONFIGURATION ----------

var TIMEZONE = 'Europe/Berlin';
var DRAFT_TO = 'joerg@spiritual-touch.de';
var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// Raumkalender. id = Kalender-ID; nameMatch = Ersatz, falls id null/ungültig
// ist (sucht in allen Kalendern, die Jörgs Konto sieht, nach dem Namen).
var ROOM_CALENDARS = [
  { label: 'Raum 1', id: 'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com', nameMatch: /^raum\s*1\b/i },
  { label: 'Raum 2', id: 'c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com', nameMatch: /^raum\s*2\b/i },
  { label: 'Raum 3', id: 'c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com', nameMatch: /^raum\s*3\b/i },
  { label: 'Raum extern', id: 'c_611a7a193e4556c4ea970563ad4febea97e040fbd357211c24111b8fdbfb6966@group.calendar.google.com', nameMatch: /^raum\s*extern/i },
];

// Teammitglieder.
//   names  = Schreibweisen, nach denen in Titel/Beschreibung gesucht wird
//            (ganzes Wort, Groß-/Kleinschreibung egal).
//   emails = optional: genaue Mailadressen für die Anleger-Zuordnung. Ohne
//            Eintrag wird der Vorname im Mail-Vorderteil bzw. Anzeigenamen
//            des Anlegers verglichen ("stephanie@…" oder "Stephanie Müller").
// Jörg ist bewusst nicht in der Liste (wird nicht abgerechnet). Ein Termin
// ohne Teammitglied-Namen, den Jörg angelegt hat, erscheint deshalb als
// "unbekannt" und muss kurz geprüft werden.
// ⚠️ Bewusst KEIN Alias "Stefanie": Das ist laut Beispiel-Termin
// "Coaching S.graul ST" eine externe Person (Raumvermietung), nicht Stephanie.
var TEAM_MEMBERS = [
  { name: 'Tara',       names: ['Tara'],            emails: [] },
  { name: 'Eva',        names: ['Eva'],             emails: ['eva.saur1993@gmail.com'] },
  { name: 'Asmita',     names: ['Asmita'],          emails: [] },
  { name: 'Amila',      names: ['Amila'],           emails: [] },
  { name: 'Sarah',      names: ['Sarah'],           emails: [] },
  { name: 'Dominik',    names: ['Dominik'],         emails: [] },
  { name: 'Konstantin', names: ['Konstantin'],      emails: [] },
  { name: 'Alea',       names: ['Alea'],            emails: [] },
  { name: 'Stephanie',  names: ['Stephanie'],       emails: [] },
  { name: 'Karen',      names: ['Karen'],           emails: [] },
  { name: 'Maxine',     names: ['Maxine'],          emails: [] },
];

// Art des Termins aus dem Titel. Der ERSTE passende Eintrag gewinnt — daher
// spezielle Regeln vor allgemeinen. Basis: Dienstleistungsliste in Amelia
// (wordpress/buchungs-dashboard/README.md) plus gängige Abkürzungen im Team.
// Passt keine Regel, wird der Titel ohne Teammitglied-Name verwendet.
// "TM" wird nur als eigenes Wort erkannt (nicht in "Termin" o. Ä.).
var ART_RULES = [
  { match: /massage\s+lernen/i,                                 art: 'Tantramassage lernen (Paare)' },
  { match: /intim\s*-?\s*massage/i,                            art: 'Intimmassage Workshop' },
  { match: /tantra\s*-?\s*massage|\bTM\b/i,                    art: 'Tantramassage' },
  { match: /bodyflow/i,                                         art: 'Bodyflow-Massage' },
  { match: /heilmassage/i,                                      art: 'Frauen-Heilmassage' },
  { match: /sexological|körperarbeit|koerperarbeit|bodywork/i,  art: 'Körperarbeit (Sexological Bodywork)' },
  { match: /somatic|\bSE\b/i,                                   art: 'Somatic Experiencing' },
  { match: /ritual/i,                                           art: 'Ritual' },
  { match: /kennenlern/i,                                       art: 'Kennenlern-Gespräch' },
  { match: /coaching/i,                                         art: 'Coaching' },
];

// Alles, was wie ein automatischer Blocker aussieht, wird ignoriert.
var IGNORE_TITLE_REGEX = /^blockiert\b/i;
var IGNORE_DESCRIPTION_MARKERS = ['autoBlock:true', 'kind:anfragen-sync'];

// Fehlt ein Raumkalender: bis zu welchem Tag des Monats wird gewartet
// (täglicher Neuversuch), bevor trotzdem ein Entwurf mit Warnung entsteht.
var GIVE_UP_AFTER_DAY = 5;

var API_RETRIES = 4;
var PROP_LAST_DONE = 'lastDraftMonth'; // z. B. "2026-10"

// ---------- EINSTIEGSPUNKTE ----------

/**
 * TRIGGER-FUNKTION (täglich, siehe installTrigger). Erstellt den Entwurf für
 * den Vormonat, falls das noch nicht geschehen ist.
 */
function monatsabrechnungTaeglich() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Anderer Lauf aktiv – übersprungen.');
    return;
  }
  try {
    var now = new Date();
    var prev = previousMonth_(now);
    var key = monthKey_(prev.year, prev.month);
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(PROP_LAST_DONE) === key) {
      Logger.log('Entwurf für ' + key + ' bereits erstellt – nichts zu tun.');
      return;
    }
    var dayOfMonth = Number(Utilities.formatDate(now, TIMEZONE, 'd'));
    var result = buildDraftForMonth_(prev.year, prev.month, dayOfMonth >= GIVE_UP_AFTER_DAY);
    if (result.created || result.alreadyExists) {
      props.setProperty(PROP_LAST_DONE, key);
    }
  } catch (err) {
    sendAlert_('Fehler beim Erstellen der Monatsabrechnungsliste', err.message + '\n\n' + (err.stack || ''));
    throw err; // damit der Fehler auch in der Ausführungsliste rot erscheint
  } finally {
    lock.releaseLock();
  }
}

/** Manueller Test: Entwurf für den letzten abgelaufenen Monat (ignoriert den Merker). */
function testLetzterMonat() {
  var prev = previousMonth_(new Date());
  buildDraftForMonth_(prev.year, prev.month, true);
}

/**
 * Manuell für einen beliebigen Monat, z. B. zum Nachholen:
 * Zeile unten anpassen (Monat 1–12) und ▶ drücken.
 */
function entwurfFuerMonatManuell() {
  buildDraftForMonth_(2026, 10, true);
}

/** Einmalig ausführen: richtet den täglichen Trigger (ca. 06:00 Uhr) ein. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monatsabrechnungTaeglich') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('monatsabrechnungTaeglich').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Täglicher Trigger für monatsabrechnungTaeglich eingerichtet.');
}

/** Setzt den Merker zurück (nur falls ein Entwurf bewusst neu erstellt werden soll). */
function merkerZuruecksetzen() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_LAST_DONE);
}

// ---------- HAUPTLOGIK ----------

function buildDraftForMonth_(year, month, allowPartial) {
  var range = monthRange_(year, month);
  var subject = subjectFor_(year, month);

  if (draftExists_(subject)) {
    Logger.log('Entwurf "' + subject + '" existiert bereits – kein zweiter.');
    return { created: false, alreadyExists: true };
  }

  var warnings = [];
  var rows = [];
  var failedCalendars = [];

  ROOM_CALENDARS.forEach(function (room) {
    try {
      var calId = resolveCalendarId_(room);
      if (!calId) throw new Error('Kalender nicht gefunden/kein Zugriff');
      listEvents_(calId, range.start, range.end).forEach(function (ev) {
        var row = eventToRow_(ev, room.label);
        if (row) rows.push(row);
      });
    } catch (err) {
      failedCalendars.push(room.label);
      warnings.push(room.label + ': ' + err.message);
    }
  });

  if (failedCalendars.length && !allowPartial) {
    sendAlert_(
      'Monatsabrechnungsliste ' + monthKey_(year, month) + ' verschoben',
      'Diese Kalender waren nicht lesbar: ' + failedCalendars.join(', ') + '.\n\n' +
      warnings.join('\n') + '\n\n' +
      'Es wurde KEIN unvollständiger Entwurf erstellt. Der Lauf wird morgen automatisch wiederholt ' +
      '(ab dem ' + GIVE_UP_AFTER_DAY + '. des Monats dann mit Warnhinweis im Entwurf).'
    );
    return { created: false, alreadyExists: false };
  }

  rows = dedupe_(rows);
  rows.sort(function (a, b) { return a.start - b.start; });

  var regular = rows.filter(function (r) { return !r.allDay; });
  var allDay = rows.filter(function (r) { return r.allDay; });

  var html = renderHtml_(year, month, regular, allDay, warnings);
  var plain = renderPlain_(year, month, regular, allDay, warnings);
  var csv = Utilities.newBlob('﻿' + renderCsv_(regular, allDay), 'text/csv', 'Monatsabrechnung_' + monthKey_(year, month) + '.csv');

  GmailApp.createDraft(DRAFT_TO, subject, plain, { htmlBody: html, attachments: [csv] });
  Logger.log('Entwurf erstellt: ' + subject + ' (' + regular.length + ' Termine, ' + allDay.length + ' ganztägig zu prüfen).');
  return { created: true, alreadyExists: false };
}

// ---------- KALENDER LESEN ----------

function resolveCalendarId_(room) {
  if (room.id) {
    try {
      retry_(function () { return Calendar.Calendars.get(room.id); });
      return room.id;
    } catch (e) {
      Logger.log(room.label + ': ID ' + room.id + ' nicht nutzbar (' + e.message + '), versuche Namenssuche.');
    }
  }
  if (room.nameMatch) {
    var cals = CalendarApp.getAllCalendars().filter(function (c) { return room.nameMatch.test(c.getName()); });
    if (cals.length === 1) return cals[0].getId();
    if (cals.length > 1) {
      throw new Error('Namenssuche mehrdeutig (' + cals.map(function (c) { return c.getName(); }).join(' | ') +
        ') – bitte die Kalender-ID in ROOM_CALENDARS eintragen.');
    }
  }
  return null;
}

function listEvents_(calendarId, start, end) {
  var items = [];
  var pageToken = null;
  do {
    var resp = retry_(function () {
      return Calendar.Events.list(calendarId, {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500,
        pageToken: pageToken,
      });
    });
    (resp.items || []).forEach(function (e) { items.push(e); });
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return items;
}

/** Wiederholt einen API-Aufruf mit steigender Wartezeit (1s, 2s, 4s …). */
function retry_(fn) {
  var lastErr;
  for (var i = 0; i < API_RETRIES; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
      Utilities.sleep(1000 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

// ---------- TERMIN → ZEILE ----------

function eventToRow_(ev, roomLabel) {
  if (ev.status === 'cancelled') return null;
  var title = (ev.summary || '').trim();
  var desc = ev.description || '';
  if (IGNORE_TITLE_REGEX.test(title)) return null;
  for (var i = 0; i < IGNORE_DESCRIPTION_MARKERS.length; i++) {
    if (desc.indexOf(IGNORE_DESCRIPTION_MARKERS[i]) !== -1) return null;
  }
  // Von Jörg (dem Kalenderkonto) abgelehnte Einladungen zählen nicht.
  var declinedBySelf = (ev.attendees || []).some(function (a) { return a.self && a.responseStatus === 'declined'; });
  if (declinedBySelf) return null;

  var allDay = !!(ev.start && ev.start.date && !ev.start.dateTime);
  var start = parseEventTime_(ev.start);
  var end = parseEventTime_(ev.end);
  if (!start || !end) return null;
  var minutes = allDay ? 0 : Math.round((end - start) / 60000);

  var who = identifyMember_(title, ev.creator);
  var art = artFor_(title, who.matchedNames);
  var idMatch = desc.match(/Termin-ID:\s*(\d+)/i);

  return {
    start: start,
    end: end,
    allDay: allDay,
    minutes: minutes,
    art: art,
    member: who.label,
    isTeam: who.isTeam,
    source: who.source,
    room: roomLabel,
    title: title,
    appointmentId: idMatch ? idMatch[1] : null,
  };
}

function parseEventTime_(t) {
  if (!t) return null;
  if (t.dateTime) return new Date(t.dateTime);
  if (t.date) return Utilities.parseDate(t.date + ' 00:00:00', TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  return null;
}

/**
 * Ermittelt das Teammitglied: Titel → Anleger → unbekannt (Beschreibung bewusst nicht).
 * @return {{label:string, isTeam:boolean, source:string, matchedNames:string[]}}
 */
function identifyMember_(title, creator) {
  var inTitle = membersIn_(title);
  if (inTitle.members.length) {
    return { label: joinNames_(inTitle.members), isTeam: true, source: 'Titel', matchedNames: inTitle.matched };
  }
  var byCreator = memberByCreator_(creator);
  if (byCreator) {
    return { label: byCreator.name, isTeam: true, source: 'Anleger', matchedNames: [] };
  }
  var who = creator ? (creator.displayName || creator.email || '') : '';
  if (creator && creator.displayName && creator.email) who = creator.displayName + ' <' + creator.email + '>';
  return {
    label: 'Extern/Raumvermietung: ' + (who || 'Anleger unbekannt'),
    isTeam: false,
    source: 'unbekannt',
    matchedNames: [],
  };
}

function membersIn_(text) {
  var members = [];
  var matched = [];
  if (!text) return { members: members, matched: matched };
  TEAM_MEMBERS.forEach(function (m) {
    var hit = false;
    m.names.forEach(function (n) {
      if (wordRegex_(n).test(text)) { hit = true; matched.push(n); }
    });
    if (hit) members.push(m.name);
  });
  return { members: members, matched: matched };
}

function memberByCreator_(creator) {
  if (!creator) return null;
  var email = (creator.email || '').toLowerCase();
  var display = (creator.displayName || '').trim();

  // 1. exakte Mailadresse
  for (var i = 0; i < TEAM_MEMBERS.length; i++) {
    var emails = (TEAM_MEMBERS[i].emails || []).map(function (e) { return e.toLowerCase(); });
    if (email && emails.indexOf(email) !== -1) return TEAM_MEMBERS[i];
  }
  // 2. Vorname im Mail-Vorderteil ("stephanie@…", "stephanie.mueller@…", "stephanie+x@…")
  var local = email.split('@')[0].split('+')[0];
  var localTokens = local.split(/[._-]+/);
  // 3. Anzeigename: erstes Wort ("Stephanie Müller")
  var displayFirst = display.split(/\s+/)[0].toLowerCase();
  for (var j = 0; j < TEAM_MEMBERS.length; j++) {
    var names = TEAM_MEMBERS[j].names.map(function (n) { return n.toLowerCase(); });
    if (localTokens.length && names.indexOf(localTokens[0]) !== -1) return TEAM_MEMBERS[j];
    if (displayFirst && names.indexOf(displayFirst) !== -1) return TEAM_MEMBERS[j];
  }
  return null;
}

function artFor_(title, matchedNames) {
  for (var i = 0; i < ART_RULES.length; i++) {
    if (ART_RULES[i].match.test(title)) return ART_RULES[i].art;
  }
  var cleaned = title;
  matchedNames.forEach(function (n) {
    cleaned = cleaned.replace(wordRegex_(n), ' ');
  });
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/^[\s,;:|\-–—/]+|[\s,;:|\-–—/]+$/g, '').trim();
  return cleaned || title || '(ohne Titel)';
}

function wordRegex_(word) {
  var esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-zÀ-ÿ])' + esc + '(?![A-Za-zÀ-ÿ])', 'i');
}

function joinNames_(list) { return list.join(' / '); }

/** Entfernt Doppelungen (gleiche Termin-ID, oder gleicher Raum+Titel+Zeit). */
function dedupe_(rows) {
  var seen = {};
  return rows.filter(function (r) {
    var key = r.appointmentId
      ? 'id:' + r.appointmentId + '|' + r.start.getTime()
      : 'k:' + r.room + '|' + r.title + '|' + r.start.getTime() + '|' + r.end.getTime();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

// ---------- AUSGABE ----------

function subjectFor_(year, month) {
  return 'Monatsabrechnungsliste ' + MONTH_NAMES[month - 1] + ' ' + year + ' (sevdesk)';
}

var MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function fmtDate_(d) { return Utilities.formatDate(d, TIMEZONE, 'dd.MM.yyyy'); }
function fmtTime_(d) { return Utilities.formatDate(d, TIMEZONE, 'HH:mm'); }

function fmtDuration_(min) {
  var h = Math.floor(min / 60);
  var m = min % 60;
  return h + ':' + (m < 10 ? '0' : '') + m + ' h';
}

function fmtDecimalHours_(min) {
  return (Math.round(min / 60 * 100) / 100).toString().replace('.', ',');
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function totalsByMember_(rows) {
  var map = {};
  rows.forEach(function (r) {
    var k = r.isTeam ? r.member : 'Extern/Raumvermietung';
    if (!map[k]) map[k] = { name: k, count: 0, minutes: 0, isTeam: r.isTeam };
    map[k].count++;
    map[k].minutes += r.minutes;
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
    if (a.isTeam !== b.isTeam) return a.isTeam ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

function hintFor_(r) {
  return r.source === 'unbekannt' ? 'Unbekannt – Raumvermietung? Bitte prüfen' : '';
}

function renderHtml_(year, month, rows, allDay, warnings) {
  var th = 'style="text-align:left;padding:6px 10px;border-bottom:2px solid #888;background:#f3f3f3"';
  var td = 'style="padding:5px 10px;border-bottom:1px solid #ddd;vertical-align:top"';
  var out = [];
  out.push('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">');
  out.push('<h2 style="margin:0 0 6px">Monatsabrechnungsliste ' + MONTH_NAMES[month - 1] + ' ' + year + '</h2>');
  var totalMin = rows.reduce(function (s, r) { return s + r.minutes; }, 0);
  out.push('<p>' + rows.length + ' Termine, gesamt ' + fmtDuration_(totalMin) + ' (' + fmtDecimalHours_(totalMin) + ' Std.). ' +
    'Quelle: Raum 1–3 und Raum extern. CSV zur Übergabe an sevdesk im Anhang.</p>');

  if (warnings.length) {
    out.push('<p style="background:#fff3cd;border:1px solid #e0c36a;padding:8px 10px"><b>⚠️ Achtung, Liste evtl. unvollständig:</b><br>' +
      warnings.map(escHtml_).join('<br>') + '</p>');
  }

  out.push('<h3>Summe je Teammitglied</h3>');
  out.push('<table style="border-collapse:collapse"><tr><th ' + th + '>Teammitglied</th><th ' + th + '>Termine</th><th ' + th + '>Dauer</th><th ' + th + '>Std. (dezimal)</th></tr>');
  totalsByMember_(rows).forEach(function (t) {
    out.push('<tr><td ' + td + '>' + escHtml_(t.name) + '</td><td ' + td + '>' + t.count + '</td><td ' + td + '>' + fmtDuration_(t.minutes) +
      '</td><td ' + td + '>' + fmtDecimalHours_(t.minutes) + '</td></tr>');
  });
  out.push('</table>');

  out.push('<h3>Alle Termine</h3>');
  out.push('<table style="border-collapse:collapse"><tr>' +
    ['Datum', 'Uhrzeit', 'Art des Termins', 'Dauer', 'Teammitglied', 'Raum', 'Titel im Kalender', 'Hinweis'].map(function (h) { return '<th ' + th + '>' + h + '</th>'; }).join('') + '</tr>');
  if (!rows.length) {
    out.push('<tr><td ' + td + ' colspan="8">Keine stattgefundenen Termine gefunden.</td></tr>');
  }
  rows.forEach(function (r) {
    var flag = r.isTeam ? '' : ' style="background:#fff8e1"';
    out.push('<tr' + flag + '>' +
      '<td ' + td + '>' + fmtDate_(r.start) + '</td>' +
      '<td ' + td + '>' + fmtTime_(r.start) + '–' + fmtTime_(r.end) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.art) + '</td>' +
      '<td ' + td + '>' + fmtDuration_(r.minutes) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.member) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.room) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.title) + '</td>' +
      '<td ' + td + '>' + escHtml_(hintFor_(r)) + '</td></tr>');
  });
  out.push('</table>');

  if (allDay.length) {
    out.push('<h3>Bitte prüfen: ganztägige Termine (keine Dauer, nicht in der Summe)</h3><ul>');
    allDay.forEach(function (r) {
      out.push('<li>' + fmtDate_(r.start) + ' – ' + escHtml_(r.art) + ' – ' + escHtml_(r.member) + ' (' + escHtml_(r.room) + ')</li>');
    });
    out.push('</ul>');
  }
  out.push('<p style="color:#777;font-size:12px">Automatisch erstellt per Apps Script (Monatsabrechnung). Gelb hinterlegt = Teammitglied unbekannt.</p>');
  out.push('</div>');
  return out.join('\n');
}

function renderPlain_(year, month, rows, allDay, warnings) {
  var lines = ['Monatsabrechnungsliste ' + MONTH_NAMES[month - 1] + ' ' + year, ''];
  if (warnings.length) lines.push('ACHTUNG, evtl. unvollständig:', warnings.join('\n'), '');
  rows.forEach(function (r) {
    lines.push(fmtDate_(r.start) + ' | ' + r.art + ' | ' + fmtDuration_(r.minutes) + ' | ' + r.member + ' | ' + r.room);
  });
  if (allDay.length) {
    lines.push('', 'Bitte prüfen (ganztägig):');
    allDay.forEach(function (r) { lines.push(fmtDate_(r.start) + ' | ' + r.art + ' | ' + r.member + ' | ' + r.room); });
  }
  return lines.join('\n');
}

function renderCsv_(rows, allDay) {
  function q(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }
  var lines = [['Datum', 'Beginn', 'Ende', 'Art des Termins', 'Dauer (hh:mm)', 'Dauer (Std. dezimal)', 'Teammitglied', 'Raum', 'Titel im Kalender', 'Hinweis'].map(q).join(';')];
  rows.concat(allDay).forEach(function (r) {
    lines.push([
      fmtDate_(r.start),
      r.allDay ? '' : fmtTime_(r.start),
      r.allDay ? '' : fmtTime_(r.end),
      r.art,
      r.allDay ? 'ganztägig' : fmtDuration_(r.minutes).replace(' h', ''),
      r.allDay ? '' : fmtDecimalHours_(r.minutes),
      r.member,
      r.room,
      r.title,
      hintFor_(r) || (r.allDay ? 'Ganztägig – Dauer prüfen' : ''),
    ].map(q).join(';'));
  });
  return lines.join('\r\n');
}

// ---------- HILFSFUNKTIONEN ----------

function previousMonth_(now) {
  var y = Number(Utilities.formatDate(now, TIMEZONE, 'yyyy'));
  var m = Number(Utilities.formatDate(now, TIMEZONE, 'M'));
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

function monthKey_(year, month) {
  return year + '-' + (month < 10 ? '0' : '') + month;
}

/** Erster Tag 00:00 (Berlin) bis erster Tag des Folgemonats 00:00. */
function monthRange_(year, month) {
  var nextY = month === 12 ? year + 1 : year;
  var nextM = month === 12 ? 1 : month + 1;
  return {
    start: Utilities.parseDate(monthKey_(year, month) + '-01 00:00:00', TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
    end: Utilities.parseDate(monthKey_(nextY, nextM) + '-01 00:00:00', TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
  };
}

function draftExists_(subject) {
  try {
    return GmailApp.getDraftMessages().some(function (m) { return m.getSubject() === subject; });
  } catch (e) {
    Logger.log('Entwurfs-Prüfung fehlgeschlagen (' + e.message + ') – verlasse mich auf den Merker.');
    return false;
  }
}

function sendAlert_(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Monatsabrechnung: ' + subject, body);
  } catch (e) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + e.message);
  }
}
