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
 *       Art des Termins | Dauer | Datum (+ Beginn) | Teammitglied
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
 * DAUER
 *   Zählt NUR, was im TITEL ("2h 30min", "2,5h", "3 h") oder in der
 *   BESCHREIBUNG ("Dauer: 2,5 Stunden - 340,00 €") steht. Die im Kalender
 *   blockierte Zeit ist bewusst KEINE Grundlage: sie enthält Puffer für
 *   Aufräumen, Essen usw. (meist 1–1,5 Std. zusätzlich). Steht nirgends eine
 *   Dauer, bleibt das Feld leer (gelb markiert, "bitte ergänzen") und der
 *   Termin zählt in der Stundensumme 0 — er geht aber nicht verloren.
 *
 * ROBUSTHEIT
 *   - Nutzt nur den eingebauten CalendarApp (keine Zusatzdienste, keine
 *     manuelle Aktivierung nötig).
 *   - Täglicher Trigger mit "Nachholen": Die Funktion merkt sich, für welchen
 *     Monat schon ein Entwurf erstellt wurde. Fällt der Lauf am 1. aus
 *     (Google-Störung, Berechtigung abgelaufen …), wird er am nächsten Tag
 *     automatisch wiederholt — nie doppelt, nie vergessen.
 *   - Kalender-Aufrufe mit Wiederholung + Wartezeit (Rate-Limits,
 *     kurze Ausfälle).
 *   - Sperre gegen parallele Läufe (LockService).
 *   - Ein nicht lesbarer Raumkalender bricht den Lauf ab (kein stiller
 *     Teil-Bericht) und löst eine Warnmail aus; ab dem 5. des Monats wird
 *     stattdessen ein Entwurf MIT deutlichem Warnhinweis erstellt, damit die
 *     Abrechnung nicht ewig blockiert.
 *   - Bereits vorhandener Entwurf mit demselben Betreff → kein zweiter.
 *   - Recurring-Termine werden als Einzeltermine ausgewertet
 *     (CalendarApp expandiert Serien), abgesagte und von Jörg abgelehnte
 *     Termine entfallen, Sync-Blocker ("Blockiert (…)"/autoBlock) und
 *     Doubletten (gleiche Termin-ID oder gleiches Teammitglied+Titel+Beginn,
 *     auch über Räume hinweg) ebenfalls.
 *   - NICHTS GEHT UNBEMERKT VERLOREN: Jeder gelesene Kalendereintrag ist
 *     entweder berücksichtigt oder steht mit Grund in der Aufstellung
 *     "Nicht berücksichtigte Termine" (Mail + zweite CSV). Gründe: abgesagt,
 *     automatischer Blocker, Absage-Hinweis im Text, abgelehnt, Doublette,
 *     Termin von Jörg, von Jörg ohne Teammitglied angelegt, Beginn im
 *     Nachbarmonat, ganztägig. Die Mail zeigt eine Kontrollzeile
 *     "N gelesen = X berücksichtigt + Y nicht berücksichtigt".
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
// Passt keine Regel, steht "(nicht erkannt)" in der Spalte (gelb markiert) —
// der Original-Titel steht daneben. Lieber sichtbar offen als geraten.
// "TM" wird nur als eigenes Wort erkannt (nicht in "Termin" o. Ä.).
var ART_RULES = [
  { match: /massage\s+lernen/i,                                 art: 'Tantramassage lernen (Paare)' },
  { match: /intim\s*-?\s*massage/i,                            art: 'Intimmassage Workshop' },
  { match: /tantra\s*-?\s*massage.*paare|paare.*tantra/i,       art: 'Tantramassage für Paare' },
  { match: /tantra\s*-?\s*massage|\bTM\b/i,                    art: 'Tantramassage' },
  { match: /bodyflow/i,                                         art: 'Bodyflow-Massage' },
  { match: /heilmassage/i,                                      art: 'Frauen-Heilmassage' },
  { match: /sexological|körperarbeit|koerperarbeit|bodywork/i,  art: 'Körperarbeit (Sexological Bodywork)' },
  { match: /somatic|\bSE\b/i,                                   art: 'Somatic Experiencing' },
  { match: /ritual\s+zu\s+dritt/i,                              art: 'Ritual zu Dritt' },
  { match: /ritual/i,                                           art: 'Ritual' },
  { match: /kennenlern/i,                                       art: 'Kennenlern-Gespräch' },
  { match: /coaching/i,                                         art: 'Coaching' },
];

// Jörg (Inhaber) wird nicht abgerechnet. Termine mit seinem Namen im Titel
// (ohne Teammitglied) und Termine, die er selbst angelegt hat, ohne dass ein
// Teammitglied im Titel steht (Seminare, Kreise, Eigenes), landen in der
// Aufstellung "nicht berücksichtigt" — damit nichts unbemerkt verschwindet.
var OWNER_NAMES = ['Jörg', 'Joerg'];
var OWNER_EMAILS = ['joerg@spiritual-touch.de'];

// Hinweis auf Absage in Titel oder Beschreibung → nicht abrechnen, aber
// in der Aufstellung zeigen (z. B. "Abgesagt wegen Erkältung").
var CANCEL_REGEX = /abgesagt|storniert|ausgefallen|\bcancel(?:l?ed)?\b/i;

// Alles, was wie ein automatischer Blocker aussieht, wird ignoriert.
var IGNORE_TITLE_REGEX = /^blockiert\b/i;
var IGNORE_DESCRIPTION_MARKERS = ['autoBlock:true', 'kind:anfragen-sync'];

// Fehlt ein Raumkalender: bis zu welchem Tag des Monats wird gewartet
// (täglicher Neuversuch), bevor trotzdem ein Entwurf mit Warnung entsteht.
var GIVE_UP_AFTER_DAY = 5;

var ART_UNKNOWN = '(nicht erkannt)';
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
 * TESTLAUF Oktober 2026: legt den Entwurf mit Betreff "TESTLAUF – …" an,
 * unabhängig vom Merker und von bestehenden Entwürfen. Der Test-Entwurf kann
 * danach einfach gelöscht werden; der echte Ablauf bleibt unberührt.
 */
function testlaufOktober() {
  buildDraftForMonth_(2026, 10, true, true);
}

/**
 * Manuell für einen beliebigen Monat, z. B. zum Nachholen (echter Entwurf,
 * ohne TESTLAUF-Betreff): Zeile unten anpassen (Monat 1–12) und ▶ drücken.
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

function buildDraftForMonth_(year, month, allowPartial, testRun) {
  var range = monthRange_(year, month);
  var subject = (testRun ? 'TESTLAUF – ' : '') + subjectFor_(year, month);

  if (!testRun && draftExists_(subject)) {
    Logger.log('Entwurf "' + subject + '" existiert bereits – kein zweiter.');
    return { created: false, alreadyExists: true };
  }

  var warnings = [];
  var candidates = [];
  var skipped = [];
  var readCount = 0;
  var failedCalendars = [];

  ROOM_CALENDARS.forEach(function (room) {
    try {
      var cal = getCalendar_(room);
      if (!cal) throw new Error('Kalender nicht gefunden/kein Zugriff');
      listEvents_(cal, range.start, range.end).forEach(function (ev) {
        readCount++;
        var res = classifyEvent_(ev, room.label, range);
        if (res.skipped) skipped.push(res.skipped);
        else candidates.push(res.row);
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

  var dd = dedupe_(candidates);
  var rows = dd.kept;
  skipped = skipped.concat(dd.dupes);
  rows.sort(function (a, b) { return a.start - b.start; });
  skipped.sort(function (a, b) { return a.start - b.start; });

  var html = renderHtml_(year, month, rows, skipped, warnings, readCount);
  var plain = renderPlain_(year, month, rows, skipped, warnings, readCount);
  var prefix = '\uFEFF'; // BOM, damit Excel die Umlaute richtig liest
  var attachments = [
    Utilities.newBlob(prefix + renderCsv_(rows), 'text/csv', 'Monatsabrechnung_' + monthKey_(year, month) + '.csv'),
    Utilities.newBlob(prefix + renderSkippedCsv_(skipped), 'text/csv', 'Nicht_beruecksichtigt_' + monthKey_(year, month) + '.csv'),
  ];

  GmailApp.createDraft(DRAFT_TO, subject, plain, { htmlBody: html, attachments: attachments });
  Logger.log('Entwurf erstellt: ' + subject + ' (' + rows.length + ' berücksichtigt, ' + skipped.length + ' nicht berücksichtigt, ' + readCount + ' gelesen).');
  return { created: true, alreadyExists: false };
}

// ---------- KALENDER LESEN ----------

/** Raumkalender über ID, ersatzweise über den Namen. */
function getCalendar_(room) {
  var cal = null;
  if (room.id) {
    try {
      cal = retry_(function () { return CalendarApp.getCalendarById(room.id); });
    } catch (e) {
      Logger.log(room.label + ': Zugriff über ID fehlgeschlagen (' + e.message + '), versuche Namenssuche.');
    }
    if (cal) return cal;
    Logger.log(room.label + ': ID ' + room.id + ' nicht gefunden, versuche Namenssuche.');
  }
  if (room.nameMatch) {
    var cals = retry_(function () { return CalendarApp.getAllCalendars(); })
      .filter(function (c) { return room.nameMatch.test(c.getName()); });
    if (cals.length === 1) return cals[0];
    if (cals.length > 1) {
      throw new Error('Namenssuche mehrdeutig (' + cals.map(function (c) { return c.getName(); }).join(' | ') +
        ') – bitte die Kalender-ID in ROOM_CALENDARS eintragen.');
    }
  }
  return null;
}

/** Liest alle Termine im Zeitraum und bringt sie in eine einheitliche Form. */
function listEvents_(cal, start, end) {
  return retry_(function () { return cal.getEvents(start, end); }).map(normalizeEvent_);
}

function normalizeEvent_(e) {
  var creators = [];
  try { creators = e.getCreators(); } catch (x) { /* ohne Ersteller weiter */ }
  var declined = false;
  try { declined = e.getMyStatus() === CalendarApp.GuestStatus.NO; } catch (x) { /* ohne Status weiter */ }
  return {
    summary: e.getTitle(),
    description: e.getDescription(),
    allDay: e.isAllDayEvent(),
    startDate: e.getStartTime(),
    endDate: e.getEndTime(),
    creator: creators && creators.length ? { email: creators[0] } : null,
    declinedBySelf: declined,
  };
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

/**
 * Entscheidet für JEDEN gelesenen Kalendereintrag: abrechenbare Zeile oder
 * "nicht berücksichtigt" (mit Grund) — nichts fällt unbemerkt weg.
 * @return {{row:Object}|{skipped:Object}}
 */
function classifyEvent_(ev, roomLabel, range) {
  var title = (ev.summary || '').trim();
  var desc = ev.description || '';
  var creatorLabel = creatorLabel_(ev.creator);
  var allDay = !!ev.allDay;
  var start = ev.startDate;
  var end = ev.endDate;

  function skip(reason) {
    return { skipped: {
      start: start || new Date(0), allDay: allDay,
      room: roomLabel, title: title || '(ohne Titel)', creator: creatorLabel, reason: reason,
    } };
  }

  if (!start) return skip('Ohne gültige Startzeit');
  if (IGNORE_TITLE_REGEX.test(title)) return skip('Automatischer Blocker, kein echter Termin');
  for (var i = 0; i < IGNORE_DESCRIPTION_MARKERS.length; i++) {
    if (desc.indexOf(IGNORE_DESCRIPTION_MARKERS[i]) !== -1) return skip('Automatischer Blocker, kein echter Termin');
  }
  if (CANCEL_REGEX.test(title) || CANCEL_REGEX.test(desc)) {
    return skip('Hinweis auf Absage in Titel/Beschreibung – bitte prüfen, ob stattgefunden');
  }
  // Von Jörg (dem Kalenderkonto) abgelehnte Einladungen zählen nicht.
  if (ev.declinedBySelf) return skip('Von dir abgelehnt');
  // Beginn im Nachbarmonat (Termin über Monatsgrenze): zählt dort, nicht doppelt.
  if (start < range.start || start >= range.end) return skip('Beginn außerhalb des Monats (zählt im Nachbarmonat)');
  if (allDay) return skip('Ganztägig – keine Dauer, bitte manuell prüfen');

  var inTitle = membersIn_(title);
  if (!inTitle.members.length && OWNER_NAMES.some(function (n) { return wordRegex_(n).test(title); })) {
    return skip('Termin von Jörg – nicht abrechnungsrelevant');
  }
  var who = identifyMember_(title, ev.creator);
  if (who.source === 'unbekannt' && isOwnerCreator_(ev.creator)) {
    return skip('Von Jörg angelegt, kein Teammitglied im Titel – bitte prüfen (Eigenes/Seminar oder Buchung ohne Namen?)');
  }
  var idMatch = desc.match(/Termin-ID:\s*(\d+)/i);
  var dur = durationFor_(title, desc);
  var blockMin = end ? Math.round((end - start) / 60000) : 0;

  return { row: {
    start: start,
    minutes: dur ? dur.minutes : null, // null = nirgends eine Dauer gefunden
    durSource: dur ? dur.source : null,
    blockMinutes: blockMin, // nur zur Info im Hinweis, nie Abrechnungsgrundlage
    art: artFor_(title),
    member: who.label,
    members: who.members,
    isTeam: who.isTeam,
    source: who.source,
    room: roomLabel,
    title: title,
    creator: creatorLabel,
    appointmentId: idMatch ? idMatch[1] : null,
  } };
}

/**
 * Dauer in Minuten aus Titel, ersatzweise aus der Beschreibung — nie aus der
 * Kalender-Blockzeit (enthält Puffer).
 * @return {{minutes:number, source:string}|null}
 */
function durationFor_(title, desc) {
  var t = titleMinutes_(title);
  if (t !== null) return { minutes: t, source: 'Titel' };
  var d = descMinutes_(desc);
  if (d !== null) return { minutes: d, source: 'Beschreibung' };
  return null;
}

/** Dauer im Titel ("2h  30min", "2,5h", "3 h", "1h", "45min") oder null. */
function titleMinutes_(title) {
  var m = title.match(/(?<![\d-])(\d+(?:[.,]\d+)?)\s*(?:h|std\.?|stunden?)\b(?:\s*(\d+)\s*min)?/i);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60 + (m[2] ? Number(m[2]) : 0));
  var n = title.match(/(?<![\d-])(\d+)\s*min\b/i);
  return n ? Number(n[1]) : null;
}

/**
 * Dauer aus der Beschreibung — bewusst nur hinter dem Stichwort "Dauer:"
 * ("Dauer: 2,5 Stunden - 340,00 €"), damit Zahlen aus Gästenachrichten
 * ("… für 2 Std. Termin …") nicht fälschlich zählen.
 */
function descMinutes_(desc) {
  if (!desc) return null;
  var text = String(desc).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  var m = text.match(/Dauer:\s*(\d+(?:[.,]\d+)?)\s*(?:h|std\.?|stunden?)\b(?:\s*(\d+)\s*min)?/i);
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60 + (m[2] ? Number(m[2]) : 0));
  var n = text.match(/Dauer:\s*(\d+)\s*min\b/i);
  return n ? Number(n[1]) : null;
}

function isOwnerCreator_(creator) {
  return !!creator && !!creator.email && OWNER_EMAILS.indexOf(creator.email.toLowerCase()) !== -1;
}

function creatorLabel_(creator) {
  if (!creator) return 'unbekannt';
  if (creator.displayName && creator.email) return creator.displayName + ' <' + creator.email + '>';
  return creator.displayName || creator.email || 'unbekannt';
}

/**
 * Ermittelt das Teammitglied: Titel → Anleger → unbekannt (Beschreibung bewusst nicht).
 * @return {{label:string, members:string[], isTeam:boolean, source:string}}
 */
function identifyMember_(title, creator) {
  var inTitle = membersIn_(title);
  if (inTitle.members.length) {
    return { label: joinNames_(inTitle.members), members: inTitle.members, isTeam: true, source: 'Titel' };
  }
  var byCreator = memberByCreator_(creator);
  if (byCreator) {
    return { label: byCreator.name, members: [byCreator.name], isTeam: true, source: 'Anleger' };
  }
  var who = creator ? creatorLabel_(creator) : '';
  return {
    label: 'Extern/Raumvermietung: ' + (who || 'Anleger unbekannt'),
    members: [],
    isTeam: false,
    source: 'unbekannt',
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

function artFor_(title) {
  for (var i = 0; i < ART_RULES.length; i++) {
    if (ART_RULES[i].match.test(title)) return ART_RULES[i].art;
  }
  return ART_UNKNOWN;
}

function wordRegex_(word) {
  var esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-zÀ-ÿ])' + esc + '(?![A-Za-zÀ-ÿ])', 'i');
}

function joinNames_(list) { return list.join(' / '); }

/**
 * Doubletten (gleiche Termin-ID + Beginn, oder gleiches Teammitglied+Titel+Beginn, auch über Räume hinweg)
 * werden nur einmal gezählt; die Dublette erscheint unter "nicht berücksichtigt".
 */
function dedupe_(rows) {
  var seen = {};
  var kept = [];
  var dupes = [];
  rows.forEach(function (r) {
    var key = r.appointmentId
      ? 'id:' + r.appointmentId + '|' + r.start.getTime()
      : 'k:' + r.member + '|' + r.title + '|' + r.start.getTime(); // bewusst ohne Raum: dieselbe Buchung steht oft in zwei Räumen
    if (seen[key]) {
      dupes.push({
        start: r.start, allDay: false, room: r.room, title: r.title, creator: r.creator,
        reason: 'Doublette – bereits gezählt (' + seen[key].room + ')',
      });
    } else {
      seen[key] = r;
      kept.push(r);
    }
  });
  return { kept: kept, dupes: dupes };
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
    // Bei mehreren Teammitgliedern (Paare-Termine) bekommt jede Person die volle Dauer.
    var names = r.isTeam ? r.members : ['Extern/Raumvermietung'];
    names.forEach(function (k) {
      if (!map[k]) map[k] = { name: k, count: 0, minutes: 0, isTeam: r.isTeam };
      map[k].count++;
      map[k].minutes += r.minutes || 0;
    });
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
    if (a.isTeam !== b.isTeam) return a.isTeam ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

function fmtDur_(min) { return min === null || min === undefined ? '–' : fmtDuration_(min); }

function hintFor_(r) {
  var h = [];
  if (r.source === 'unbekannt') h.push('Unbekannt – Raumvermietung? Bitte prüfen');
  if (r.art === ART_UNKNOWN) h.push('Art nicht erkannt – siehe Titel');
  if (r.minutes === null) {
    h.push('Dauer nicht in Titel/Beschreibung gefunden – bitte ergänzen (Kalender blockiert ' + fmtDuration_(r.blockMinutes) + ', nur zur Info)');
  } else if (r.durSource === 'Beschreibung') {
    h.push('Dauer aus Beschreibung');
  }
  if (r.members && r.members.length > 1) h.push('Mehrere Teammitglieder – Dauer zählt je Person');
  return h.join('; ');
}

function isFlagged_(r) {
  return !r.isTeam || r.art === ART_UNKNOWN || r.minutes === null;
}

function renderHtml_(year, month, rows, skipped, warnings, readCount) {
  var th = 'style="text-align:left;padding:6px 10px;border-bottom:2px solid #888;background:#f3f3f3"';
  var td = 'style="padding:5px 10px;border-bottom:1px solid #ddd;vertical-align:top"';
  var out = [];
  out.push('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">');
  out.push('<h2 style="margin:0 0 6px">Monatsabrechnungsliste ' + MONTH_NAMES[month - 1] + ' ' + year + '</h2>');
  var totalMin = rows.reduce(function (s, r) { return s + (r.minutes || 0); }, 0);
  var noDur = rows.filter(function (r) { return r.minutes === null; }).length;
  out.push('<p>' + rows.length + ' Termine, gesamt ' + fmtDuration_(totalMin) + ' (' + fmtDecimalHours_(totalMin) + ' Std.). ' +
    'Quelle: Raum 1–3 und Raum extern. CSV zur Übergabe an sevdesk im Anhang. ' +
    'Dauer = laut Titel bzw. Beschreibung (nicht die Kalender-Blockzeit mit Puffer). ' +
    'Bei Terminen mit mehreren Teammitgliedern zählt die Dauer je Person in der Summe unten, in der Gesamtdauer nur einmal.</p>');
  out.push('<p style="margin-top:0;color:#555"><b>Kontrolle:</b> ' + readCount + ' Kalendereinträge gelesen = ' +
    rows.length + ' berücksichtigt + ' + skipped.length + ' nicht berücksichtigt (siehe unten).</p>');

  var notes = warnings.slice();
  if (noDur) notes.push(noDur + ' Termin(e) ohne erkennbare Dauer in Titel/Beschreibung – in der Liste gelb markiert, zählen in der Summe 0.');
  if (notes.length) {
    out.push('<p style="background:#fff3cd;border:1px solid #e0c36a;padding:8px 10px"><b>⚠️ Bitte beachten:</b><br>' +
      notes.map(escHtml_).join('<br>') + '</p>');
  }

  out.push('<h3>Summe je Teammitglied</h3>');
  out.push('<table style="border-collapse:collapse"><tr><th ' + th + '>Teammitglied</th><th ' + th + '>Termine</th><th ' + th + '>Dauer</th><th ' + th + '>Std. (dezimal)</th></tr>');
  totalsByMember_(rows).forEach(function (t) {
    out.push('<tr><td ' + td + '>' + escHtml_(t.name) + '</td><td ' + td + '>' + t.count + '</td><td ' + td + '>' + fmtDuration_(t.minutes) +
      '</td><td ' + td + '>' + fmtDecimalHours_(t.minutes) + '</td></tr>');
  });
  out.push('</table>');

  out.push('<h3>Alle berücksichtigten Termine</h3>');
  out.push('<table style="border-collapse:collapse"><tr>' +
    ['Datum', 'Beginn', 'Art des Termins', 'Dauer', 'Teammitglied', 'Raum', 'Titel im Kalender', 'Hinweis'].map(function (h) { return '<th ' + th + '>' + h + '</th>'; }).join('') + '</tr>');
  if (!rows.length) {
    out.push('<tr><td ' + td + ' colspan="8">Keine stattgefundenen Termine gefunden.</td></tr>');
  }
  rows.forEach(function (r) {
    var flag = isFlagged_(r) ? ' style="background:#fff8e1"' : '';
    out.push('<tr' + flag + '>' +
      '<td ' + td + '>' + fmtDate_(r.start) + '</td>' +
      '<td ' + td + '>' + fmtTime_(r.start) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.art) + '</td>' +
      '<td ' + td + '>' + fmtDur_(r.minutes) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.member) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.room) + '</td>' +
      '<td ' + td + '>' + escHtml_(r.title) + '</td>' +
      '<td ' + td + '>' + escHtml_(hintFor_(r)) + '</td></tr>');
  });
  out.push('</table>');

  out.push('<h3>Nicht berücksichtigte Termine (' + skipped.length + ')</h3>');
  out.push('<p style="margin-top:0;color:#555">Alles, was gelesen, aber nicht in die Abrechnung übernommen wurde — mit Grund. ' +
    'Bitte kurz überfliegen, damit kein abrechenbarer Termin durchrutscht.</p>');
  if (!skipped.length) {
    out.push('<p>Keine.</p>');
  } else {
    out.push('<table style="border-collapse:collapse"><tr>' +
      ['Datum', 'Beginn', 'Titel im Kalender', 'Raum', 'Angelegt von', 'Grund'].map(function (h) { return '<th ' + th + '>' + h + '</th>'; }).join('') + '</tr>');
    skipped.forEach(function (r) {
      out.push('<tr>' +
        '<td ' + td + '>' + fmtDate_(r.start) + '</td>' +
        '<td ' + td + '>' + (r.allDay ? 'ganztägig' : fmtTime_(r.start)) + '</td>' +
        '<td ' + td + '>' + escHtml_(r.title) + '</td>' +
        '<td ' + td + '>' + escHtml_(r.room) + '</td>' +
        '<td ' + td + '>' + escHtml_(r.creator) + '</td>' +
        '<td ' + td + '>' + escHtml_(r.reason) + '</td></tr>');
    });
    out.push('</table>');
  }
  out.push('<p style="color:#777;font-size:12px">Automatisch erstellt per Apps Script (Monatsabrechnung). Gelb hinterlegt = Teammitglied, Art oder Dauer unklar.</p>');
  out.push('</div>');
  return out.join('\n');
}

function renderPlain_(year, month, rows, skipped, warnings, readCount) {
  var lines = ['Monatsabrechnungsliste ' + MONTH_NAMES[month - 1] + ' ' + year, ''];
  if (warnings.length) lines.push('ACHTUNG, evtl. unvollständig:', warnings.join('\n'), '');
  lines.push('Kontrolle: ' + readCount + ' gelesen = ' + rows.length + ' berücksichtigt + ' + skipped.length + ' nicht berücksichtigt', '');
  rows.forEach(function (r) {
    lines.push(fmtDate_(r.start) + ' | ' + r.art + ' | ' + fmtDur_(r.minutes) + ' | ' + r.member + ' | ' + r.room);
  });
  lines.push('', 'Nicht berücksichtigt (' + skipped.length + '):');
  skipped.forEach(function (r) {
    lines.push(fmtDate_(r.start) + ' | ' + r.title + ' | ' + r.room + ' | ' + r.reason);
  });
  return lines.join('\n');
}

function csvQuote_(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

function renderCsv_(rows) {
  var lines = [['Datum', 'Beginn', 'Art des Termins', 'Dauer (hh:mm)', 'Dauer (Std. dezimal)', 'Teammitglied', 'Raum', 'Titel im Kalender', 'Hinweis'].map(csvQuote_).join(';')];
  rows.forEach(function (r) {
    lines.push([
      fmtDate_(r.start), fmtTime_(r.start), r.art,
      r.minutes === null ? '' : fmtDuration_(r.minutes).replace(' h', ''),
      r.minutes === null ? '' : fmtDecimalHours_(r.minutes),
      r.member, r.room, r.title, hintFor_(r),
    ].map(csvQuote_).join(';'));
  });
  return lines.join('\r\n');
}

function renderSkippedCsv_(skipped) {
  var lines = [['Datum', 'Beginn', 'Titel im Kalender', 'Raum', 'Angelegt von', 'Grund'].map(csvQuote_).join(';')];
  skipped.forEach(function (r) {
    lines.push([
      fmtDate_(r.start), r.allDay ? 'ganztägig' : fmtTime_(r.start),
      r.title, r.room, r.creator, r.reason,
    ].map(csvQuote_).join(';'));
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
