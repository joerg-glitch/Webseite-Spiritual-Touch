/**
 * Anfragen-Verfügbarkeits-Sync
 *
 * Zweck: Der Kalender anfragen@spiritual-touch.de (genutzt vom Amelia-
 * Mitarbeiter "Nur auf Anfrage") soll Gästen zeigen, wann die Praxis
 * ÜBERHAUPT buchbar ist — ohne einzelne Verfügbarkeiten preiszugeben.
 *
 * Dieses Skript liest die persönlichen Google-Kalender der Team-Mitglieder
 * (TEAM_CALENDARS unten) für die kommenden SYNC_DAYS_AHEAD Tage und trägt
 * auf anfragen@ eine Blockierung für jeden Zeitraum ein, in dem KEIN
 * Mitglied verfügbar ist. Übrig bleiben nur die Zeitfenster, in denen
 * mindestens ein Mitglied frei ist.
 *
 * Bewusst getrennt vom bestehenden Verfügbarkeit-Sync (Team-App →
 * "Blockiert (Verfügbarkeit-Sync)" auf den persönlichen Kalendern):
 * Dieses Skript rührt an keinem der bestehenden Bausteine (Team-App,
 * Apps Script "ST Kalender Proxy", Amelia) — es liest deren Ergebnis
 * (die persönlichen Kalender) nur passiv und schreibt ausschließlich auf
 * anfragen@. Kann jederzeit ersetzt oder abgeschaltet werden, ohne den
 * Hauptprozess zu berühren.
 *
 * Alle selbst erzeugten Events sind über die Beschreibung
 * ("autoBlock:true;sourceDate:...;kind:anfragen-sync") markiert und
 * werden bei jedem Lauf zuerst gelöscht und neu geschrieben (idempotent,
 * kein manuelles Aufräumen nötig). Von Jörg manuell angelegte Events auf
 * anfragen@ bleiben unangetastet.
 *
 * Deployment:
 *   1. Neues Projekt unter script.google.com anlegen.
 *   2. Diese Datei als Code.gs einfügen, appsscript.json übernehmen.
 *   3. Einmal manuell "syncAnfragenVerfuegbarkeit" ausführen und die
 *      Kalender-Berechtigungen bestätigen (Ausführen als: joerg@spiritual-
 *      touch.de — hat Owner-Zugriff auf alle Kalender unten).
 *   4. Zeitgesteuerten Trigger einrichten: syncAnfragenVerfuegbarkeit,
 *      Zeitgesteuert, stündlich (Empfehlung — bei Bedarf anpassen).
 *
 * Siehe README.md in diesem Ordner für Details, Kalender-IDs-Tabelle und
 * Testanleitung.
 */

// anfragen@spiritual-touch.de
const ANFRAGEN_CALENDAR_ID =
  'c_401278f6887d93ae312284ce6931ed0c3547aafd33d6bb142843bbb7e29e4aa4@group.calendar.google.com';

// Alle Teammitglieder außer Jörg & Eva (haben eigene feste Buchungswege,
// laufen nicht über den "Nur auf Anfrage"-Mitarbeiter).
const TEAM_CALENDARS = {
  Tara: 'c_fe6664e01f568080774112156e255089ea2ea2877109d6ddb241d046ebff58fb@group.calendar.google.com',
  Asmita: 'c_72c5bf2bb1c90f5424d77c3f1f6593cf2cf6fe05f27204ff1c73f3632350cabd@group.calendar.google.com',
  Amila: 'c_727306d56fd4b1755718073543de922a25edc2509fcb14f2b4e53b7a9263b72a@group.calendar.google.com',
  Sarah: 'c_d37ba1f2e4913be355bc25873d90dc9ee115b70537adfd5a6b2a5f1e98d26361@group.calendar.google.com',
  Dominik: 'c_0d3ba2a1dde3033c512dfd51c12fd0bb0c23b3e41297c169c214e76ced530669@group.calendar.google.com',
  Konstantin: 'c_459599398173cc57da9c45a996d1946f1ea0f3b057bdcb1732fd752d298ae15e@group.calendar.google.com',
  Alea: 'c_bee7bf11c2bdae2e7d8bda28b87fd27c5f4bd3cf45124c65da06d799ae9edb7f@group.calendar.google.com',
  Stephanie: 'c_360bace4072d8f2356127d9b6dd12b2c45c63be5dd791f86fbc0018e00d06714@group.calendar.google.com',
  Karen: 'c_1caea88007e19c7154765e9a9a3370c8f912f40a46c32145486b862d8770c0c7@group.calendar.google.com',
  Maxine: 'c_b3600e5f62821b31ef76a82e9c9078070a0c8e9e29641463b7ae270e6871f33d@group.calendar.google.com',
};

const DAY_START_HOUR = 9; // wie Jörgs eigene Default-Regel (9–23 Uhr)
const DAY_END_HOUR = 23;
const SYNC_DAYS_AHEAD = 14;
const SLOT_MINUTES = 30; // gleiches Raster wie die historische Buchungs-Spezifikation
const TIMEZONE = 'Europe/Berlin';
const SYNC_MARKER = 'kind:anfragen-sync';
const BLOCK_TITLE = 'Blockiert (Anfragen-Sync)';

function syncAnfragenVerfuegbarkeit() {
  const days = [];
  for (let i = 0; i < SYNC_DAYS_AHEAD; i++) days.push(dateStrForOffset_(i));

  const rangeStart = dateAtHour_(days[0], 0);
  const rangeEnd = dateAtHour_(days[days.length - 1], 24);

  const anfragenCal = CalendarApp.getCalendarById(ANFRAGEN_CALENDAR_ID);
  if (!anfragenCal) {
    throw new Error('anfragen@-Kalender nicht gefunden oder kein Zugriff: ' + ANFRAGEN_CALENDAR_ID);
  }

  removeExistingSyncEvents_(anfragenCal, rangeStart, rangeEnd);

  const busyByMember = {};
  Object.keys(TEAM_CALENDARS).forEach(function (name) {
    const cal = CalendarApp.getCalendarById(TEAM_CALENDARS[name]);
    if (!cal) {
      Logger.log('Warnung: Kalender für ' + name + ' nicht gefunden, wird als durchgehend beschäftigt behandelt.');
      busyByMember[name] = [{ start: rangeStart, end: rangeEnd }];
      return;
    }
    busyByMember[name] = cal
      .getEvents(rangeStart, rangeEnd)
      .filter(function (e) {
        return e.getTransparency() !== CalendarApp.EventTransparency.TRANSPARENT;
      })
      .map(function (e) {
        return { start: e.getStartTime(), end: e.getEndTime() };
      });
  });

  let created = 0;
  days.forEach(function (dateStr) {
    created += syncDay_(anfragenCal, dateStr, busyByMember);
  });

  Logger.log('Anfragen-Sync: ' + created + ' Blockierung(en) für ' + days.length + ' Tage geschrieben.');
}

function syncDay_(anfragenCal, dateStr, busyByMember) {
  const dayStart = dateAtHour_(dateStr, DAY_START_HOUR);
  const dayEnd = dateAtHour_(dateStr, DAY_END_HOUR);
  const slots = buildSlots_(dayStart, dayEnd);
  const memberNames = Object.keys(busyByMember);

  const anyoneFree = slots.map(function (slot) {
    return memberNames.some(function (name) {
      return !busyByMember[name].some(function (r) {
        return overlaps_(slot.start, slot.end, r.start, r.end);
      });
    });
  });

  const gaps = findGaps_(slots, anyoneFree);
  gaps.forEach(function (gap) {
    anfragenCal.createEvent(BLOCK_TITLE, gap.start, gap.end, {
      description: 'autoBlock:true;sourceDate:' + dateStr + ';' + SYNC_MARKER,
    });
  });
  return gaps.length;
}

function removeExistingSyncEvents_(cal, rangeStart, rangeEnd) {
  cal
    .getEvents(rangeStart, rangeEnd)
    .filter(function (e) {
      return (e.getDescription() || '').indexOf(SYNC_MARKER) !== -1;
    })
    .forEach(function (e) {
      e.deleteEvent();
    });
}

function buildSlots_(dayStart, dayEnd) {
  const slots = [];
  let t = dayStart;
  while (t < dayEnd) {
    const next = new Date(t.getTime() + SLOT_MINUTES * 60000);
    slots.push({ start: t, end: next > dayEnd ? dayEnd : next });
    t = next;
  }
  return slots;
}

function findGaps_(slots, anyoneFree) {
  const gaps = [];
  let gapStart = null;
  slots.forEach(function (slot, i) {
    const free = anyoneFree[i];
    if (!free && gapStart === null) {
      gapStart = slot.start;
    }
    if (free && gapStart !== null) {
      gaps.push({ start: gapStart, end: slot.start });
      gapStart = null;
    }
  });
  if (gapStart !== null) {
    gaps.push({ start: gapStart, end: slots[slots.length - 1].end });
  }
  return gaps;
}

function overlaps_(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function dateStrForOffset_(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

function dateAtHour_(dateStr, hour) {
  if (hour === 24) {
    const next = Utilities.parseDate(dateStr + ' 00:00:00', TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    next.setDate(next.getDate() + 1);
    return next;
  }
  const hh = ('0' + hour).slice(-2);
  return Utilities.parseDate(dateStr + ' ' + hh + ':00:00', TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}
