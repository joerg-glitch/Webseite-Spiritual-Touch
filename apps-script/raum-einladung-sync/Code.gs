/**
 * TERMIN-RÜCKSPIEGELUNG: GOOGLE KALENDER → AMELIA
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (getrennt von den bestehenden
 * Verfügbarkeits-Skripten "team-app/App Script - Sync" und
 * "apps-script/anfragen-verfuegbarkeit-sync").
 *
 * KURSWECHSEL (27.08.2026) — bitte zuerst lesen, falls eine ältere Version
 * dieses Skripts schon lief: Diese Datei hatte ursprünglich zwei
 * Richtungen — (1) neue Amelia-Termine automatisch in eine Kopie im
 * Kalender "Raum 1" spiegeln + der echten persönlichen Mailadresse eine
 * Kalender-Einladung schicken (weil das Team keinen Zugriff auf den
 * eigenen Hilfskalender hatte), und (2) täglich prüfen, ob das Team diese
 * Raum-1-Kopie verschoben hat, und das zurück nach Amelia spielen.
 *
 * Jörgs Entscheidung (27.08.2026): Teil (1) entfällt komplett. Statt der
 * Kopie gibt Jörg jedem Teammitglied direkten Google-Calendar-Zugriff auf
 * den EIGENEN Hilfskalender (Freigabe in Google Calendar, kein Code nötig
 * — siehe README, Abschnitt "Hilfskalender freigeben"). Die Person sieht
 * ihre Termine damit sofort und nativ, ohne Wartezeit und ohne Einladung,
 * und kann sie bei Bedarf selbst in einen Raumkalender legen. "Wir haben
 * einen Schritt der Automatisierung weniger" (Jörg). Übrig bleibt genau
 * EINE Richtung: (2), jetzt aber nicht mehr auf "die Raum-1-Kopie" bezogen
 * (die gibt es nicht mehr), sondern auf den echten Amelia-Termin, egal in
 * welchem Kalender er gerade liegt — Hilfskalender, wenn er ihn dort noch
 * nicht rausbewegt hat, oder ein beliebiger Raumkalender, wenn doch.
 *
 * Die Mitarbeiter-Mail-Weiterleitung (Amelia → anfragen+NAME@ → per
 * Gmail-Filter an NAME@ → Google-Chat-Room) ist von diesem Kurswechsel
 * NICHT betroffen und bleibt wie am 23.08.2026 eingerichtet — siehe
 * README, Abschnitt "Mitarbeiter-Mail weiterleiten".
 *
 * ZWECK (aktueller Stand, 27.08.2026 zum zweiten Mal angepasst): Ein
 * Teammitglied ändert Datum/Uhrzeit/Dauer eines bestätigten Termins nach
 * Jörgs Einschätzung in der Praxis so gut wie immer **nur im
 * Raumkalender** (Raum 1/2/3 — "so, wie es bisher die Geschichte gewohnt
 * ist"), nicht zusätzlich im eigenen Hilfskalender. Amelia selbst bekommt
 * von einer Raumkalender-Änderung nichts mit — sie kennt nur den Stand,
 * den sie beim letzten Schreiben in ihren (nie von Menschen bearbeiteten)
 * Hilfskalender eingetragen hat. Dieses Skript läuft einmal täglich und
 * vergleicht darum ganz bewusst NUR zwei Dinge direkt gegeneinander: die
 * Zeit im Raumkalender gegen die Zeit im Hilfskalender, beide über
 * dieselbe Termin-ID in der Kalender-Beschreibung gefunden. Weichen sie
 * ab, gilt der Raumkalender als der vom Team gemeinte, neue Stand — die
 * neue Zeit wird über die WordPress-Route /booking-reschedule (dieselbe,
 * die auch die Team-App für ihre eigene "Ändern"-Funktion nutzt, siehe
 * team-app/README.md) automatisch nach Amelia übertragen. Ganz ohne
 * Rückfrage oder Benachrichtigung an Jörg — nur echte Fehler landen per
 * Mail bei ihm (sendAlert()).
 *
 * Kein Amelia-Vergleich nötig: Weil der Hilfskalender laut dieser Annahme
 * nie von Menschen angefasst wird, ist "Zeit im Hilfskalender" praktisch
 * dasselbe wie "Zeit, die Amelia zuletzt gespeichert hat" — ein direkter
 * Abfragen bei Amelia selbst (frühere Version dieser Datei) ist dadurch
 * unnötig geworden. Bewusst einfacher gehalten: kein zusätzlicher
 * WordPress-Request nur zum Lesen, ein Termin ohne Raumkalender-Eintrag
 * wird schlicht nicht verglichen (nichts, was das Team hätte ändern
 * können).
 *
 * ZUSTANDSLOS: Führt kein eigenes Gedächtnis (kein PropertiesService-
 * Fingerabdruck) — bei jedem Lauf wird frisch verglichen. Einfacher und
 * robuster: keine veralteten/verwaisten Einträge, keine Aufräum-Logik
 * nötig.
 *
 * SETUP:
 * 1. Apps-Script-Projekt als joerg@spiritual-touch.de anlegen (hat Zugriff
 *    auf alle unten genannten Kalender).
 * 2. Diesen Code als Code.gs einfügen.
 * 3. In "Hilfskalender freigeben" (README) beschriebenen manuellen Schritt
 *    erledigen: jedes Teammitglied bekommt seinen eigenen Hilfskalender
 *    in Google Calendar freigegeben.
 * 4. ROOM_CALENDAR_IDS unten prüfen/ergänzen — aktuell nur Raum 1 bekannt.
 *    Gibt es weitere Raumkalender (Raum 2, 3, …), deren IDs hier ergänzen,
 *    sonst werden Verlegungen dorthin nicht erkannt.
 * 5. WP_RESCHEDULE_SECRET unten auf denselben Wert setzen wie
 *    ST_RESCHEDULE_SECRET in wordpress/buchungs-dashboard/
 *    wpcode-snippet.php (dort auch ST_RESCHEDULE_ADMIN_USER_ID setzen,
 *    falls noch nicht geschehen).
 * 6. Einmal manuell "runSyncNow" ausführen (Run-Button) → Google fragt
 *    nach Kalender-Berechtigungen → erlauben.
 * 7. Zeitgesteuerten Trigger einrichten: Funktion
 *    "syncTerminAenderungenZurueck", zeitgesteuert, "Tage-Timer" →
 *    einmal täglich, Uhrzeit egal (z. B. nachts). Nur EIN Trigger nötig —
 *    die frühere Minuten-Automatik entfällt komplett (siehe oben).
 *
 * Bewusst NICHT geprüft: Doppelbuchungen/Kollisionen mit anderen Terminen
 * der Zielperson — Jörg hat dieses Risiko in Kenntnis akzeptiert
 * (27.08.2026), um ganz ohne manuellen Freigabe-Schritt auszukommen.
 *
 * Mehrdeutigkeit: Taucht dieselbe Termin-ID in mehr als einem Raumkalender
 * mit UNTERSCHIEDLICHER Zeit auf (z. B. versehentlich in zwei Räume
 * gelegt), gilt sie als mehrdeutig und wird übersprungen und als Warnung
 * gemeldet, statt eine der beiden Zeiten zu raten. Dieselbe Zeit in
 * mehreren Raumkalendern ist dagegen unproblematisch (keine Abweichung
 * untereinander) und wird ganz normal verglichen.
 *
 * ⚠️ VORFALL 26.08.2026 (historisch, betraf den inzwischen entfernten
 * Kopier-Mechanismus): Eva war anfangs mit ihrem privaten Gmail-Kalender
 * in der Kopier-Liste enthalten. Weil das ausführende Konto dort nur
 * Lese- statt Schreibrechte hatte, schlug das Markieren als "erledigt"
 * jedes Mal fehl und ihre privaten Termine wurden minütlich neu als
 * Amelia-Termine kopiert — hunderte doppelte Kalendereinladungen. Dieses
 * Skript schreibt jetzt (Kurswechsel oben) nirgends mehr in einen
 * Hilfskalender oder Raumkalender, sondern liest nur und schreibt
 * ausschließlich nach WordPress/Amelia — die Ursache dieses Vorfalls
 * (Schreibversuch auf einen Kalender ohne Schreibrechte) kann strukturell
 * nicht mehr auftreten. Evas Hilfskalender ist deshalb unten wieder mit
 * dabei.
 */

// ---------- KONFIGURATION ----------

// Hilfskalender je Mitglied (IDs aus "team-app/App Script - Sync",
// MEMBERS-Liste dort — dieselbe Quelle wie zuvor). null = noch keine ID
// bekannt, wird beim Scannen übersprungen.
var HILFSKALENDER = {
  'Tara':       'c_fe6664e01f568080774112156e255089ea2ea2877109d6ddb241d046ebff58fb@group.calendar.google.com',
  'Eva':        'eva.saur1993@gmail.com', // ihr eigener Gmail-Kalender als Hilfskalender (bestätigt in team-app/App Script - Sync), siehe Datei-Header "Vorfall 26.08.2026", warum sie jetzt wieder mitgescannt wird
  'Asmita':     'c_72c5bf2bb1c90f5424d77c3f1f6593cf2cf6fe05f27204ff1c73f3632350cabd@group.calendar.google.com',
  'Amila':      'c_727306d56fd4b1755718073543de922a25edc2509fcb14f2b4e53b7a9263b72a@group.calendar.google.com',
  'Sarah':      'c_d37ba1f2e4913be355bc25873d90dc9ee115b70537adfd5a6b2a5f1e98d26361@group.calendar.google.com',
  'Dominik':    'c_0d3ba2a1dde3033c512dfd51c12fd0bb0c23b3e41297c169c214e76ced530669@group.calendar.google.com',
  'Konstantin': 'c_459599398173cc57da9c45a996d1946f1ea0f3b057bdcb1732fd752d298ae15e@group.calendar.google.com',
  'Alea':       'c_bee7bf11c2bdae2e7d8bda28b87fd27c5f4bd3cf45124c65da06d799ae9edb7f@group.calendar.google.com',
  'Stephanie':  'c_360bace4072d8f2356127d9b6dd12b2c45c63be5dd791f86fbc0018e00d06714@group.calendar.google.com',
  'Karen':      'c_1caea88007e19c7154765e9a9a3370c8f912f40a46c32145486b862d8770c0c7@group.calendar.google.com',
  'Maxine':     'c_b3600e5f62821b31ef76a82e9c9078070a0c8e9e29641463b7ae270e6871f33d@group.calendar.google.com',
  'Mila':       null, // noch keine Hilfskalender-ID bekannt, siehe README
};

// Raumkalender, in die das Team bestätigte Termine selbst verschiebt.
// IDs aus den Google-Calendar-Freigabelinks von Jörg (08.09.2026).
var ROOM_CALENDAR_IDS = [
  'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com', // Raum 1
  'c_9b8f2fdac6c5649a399ef26ac1dc80569fe4d8a78111b4db0d59391336f32761@group.calendar.google.com', // Raum 2
  'c_2eecd9c94fe4ebbabbc0997ef1aa97620bea9d17515070014d206c6409f2c897@group.calendar.google.com', // Raum 3
];

var SYNC_DAYS_AHEAD = 90; // gleicher Vorlauf wie das Buchungs-Dashboard
var SYNC_DAYS_BACK = 1;   // kleiner Puffer zurück, falls gerade auf "heute/gestern" verschoben

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// WordPress-Route (siehe wordpress/buchungs-dashboard/wpcode-snippet.php).
// WP_RESCHEDULE_SECRET MUSS exakt ST_RESCHEDULE_SECRET dort entsprechen.
var WP_RESCHEDULE_URL = 'https://spiritual-touch.de/wp-json/st/v1/booking-reschedule';
var WP_RESCHEDULE_SECRET = 'DEIN-ZUFAELLIGES-PASSWORT-HIER';

// Die von Jörg am 26.08.2026 in Amelias Kalender-Vorlage ergänzte Zeile
// "Termin-ID: %appointment_id%" (Amelia → Einstellungen → Termine →
// "Titel und Beschreibung der Veranstaltung") — einziger Schlüssel, den
// dieses Skript kennt. Termine ohne diese Zeile (sehr alte Buchungen)
// werden von diesem Skript nicht erfasst.
var APPOINTMENT_ID_REGEX = /Termin-ID:\s*(\d+)/i;

// ---------- HAUPTFUNKTION (Trigger: einmal täglich) ----------

function syncTerminAenderungenZurueck() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Ein anderer Lauf ist bereits aktiv – übersprungen.');
    return;
  }
  try {
    var now = new Date();
    var rangeStart = new Date(now.getTime() - SYNC_DAYS_BACK * 24 * 60 * 60 * 1000);
    var rangeEnd = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    var errors = [];

    // Termin-ID -> Event im Hilfskalender (der "letzte bekannte
    // Amelia-Stand", siehe Datei-Header). Bei Duplikaten (sollte laut
    // Amelias eigener Logik nicht vorkommen) gewinnt einfach der zuletzt
    // gefundene Eintrag — kein eigener Mehrdeutigkeits-Alarm hier, anders
    // als bei den Raumkalendern unten, wo das Team tatsächlich Einfluss
    // hat.
    var hilfsFound = {};
    Object.keys(HILFSKALENDER).forEach(function (name) {
      var calId = HILFSKALENDER[name];
      if (!calId) return;
      var calendar = CalendarApp.getCalendarById(calId);
      if (!calendar) {
        errors.push('Hilfskalender ' + name + ': nicht gefunden/kein Zugriff (' + calId + ')');
        return;
      }
      calendar.getEvents(rangeStart, rangeEnd).forEach(function (ev) {
        var match = (ev.getDescription() || '').match(APPOINTMENT_ID_REGEX);
        if (!match) return; // kein echter Amelia-Termin (z. B. ein Verfügbarkeits-Blocker) -> ignorieren
        hilfsFound[match[1]] = { label: 'Hilfskalender ' + name, event: ev };
      });
    });

    // Termin-ID -> Liste der Events, die in EINEM der Raumkalender dazu
    // gefunden wurden (kann mehr als einer sein, z. B. wenn dieselbe ID
    // versehentlich in zwei Räume gelegt wurde).
    var roomFound = {};
    ROOM_CALENDAR_IDS.forEach(function (calId, i) {
      var calendar = CalendarApp.getCalendarById(calId);
      if (!calendar) {
        errors.push('Raumkalender #' + (i + 1) + ': nicht gefunden/kein Zugriff (' + calId + ')');
        return;
      }
      calendar.getEvents(rangeStart, rangeEnd).forEach(function (ev) {
        var match = (ev.getDescription() || '').match(APPOINTMENT_ID_REGEX);
        if (!match) return;
        var id = match[1];
        if (!roomFound[id]) roomFound[id] = [];
        roomFound[id].push({ label: 'Raumkalender #' + (i + 1), event: ev });
      });
    });

    var ids = Object.keys(roomFound);
    if (!ids.length) {
      Logger.log('Keine Termine mit Termin-ID in einem Raumkalender gefunden.');
      if (errors.length) sendAlert('Warnungen im Lauf', errors.join('\n'));
      return;
    }

    var checked = 0;
    var pushed = 0;

    ids.forEach(function (id) {
      var rooms = roomFound[id];

      // Mehrdeutig, wenn dieselbe Termin-ID in mehreren Raumkalendern mit
      // UNTERSCHIEDLICHER Zeit auftaucht — dieselbe Zeit überall ist
      // unproblematisch (kein Widerspruch, wird unten normal verglichen).
      var distinctTimes = {};
      rooms.forEach(function (r) {
        distinctTimes[toUtcMysql_(r.event.getStartTime()) + '|' + toUtcMysql_(r.event.getEndTime())] = true;
      });
      if (Object.keys(distinctTimes).length > 1) {
        errors.push('Termin-ID ' + id + ': in mehreren Raumkalendern mit unterschiedlicher Zeit gefunden (' +
          rooms.map(function (r) { return r.label; }).join(', ') + ') — übersprungen, bitte manuell prüfen.');
        return;
      }

      var hilfs = hilfsFound[id];
      if (!hilfs) {
        // Kein (mehr auffindbarer) Hilfskalender-Eintrag zu dieser ID —
        // nichts, womit sich der Raumkalender vergleichen ließe. Kein
        // Fehler, kommt z. B. vor, wenn der Termin storniert wurde.
        return;
      }

      checked++;
      var roomEvent = rooms[0].event;
      var roomStart = roomEvent.getStartTime();
      var roomEnd = roomEvent.getEndTime();
      var hilfsStart = hilfs.event.getStartTime();
      var hilfsEnd = hilfs.event.getEndTime();

      if (toUtcMysql_(roomStart) === toUtcMysql_(hilfsStart) && toUtcMysql_(roomEnd) === toUtcMysql_(hilfsEnd)) {
        return; // unverändert
      }

      try {
        pushRescheduleToAmelia_(id, roomStart, roomEnd);
        pushed++;
        Logger.log('Termin-ID ' + id + ' (' + rooms[0].label + '): ' + toUtcMysql_(hilfsStart) + ' -> ' + toUtcMysql_(roomStart));
      } catch (err) {
        errors.push('Termin-ID ' + id + ' (' + rooms[0].label + '): ' + err.message);
      }
    });

    Logger.log(checked + ' Termine verglichen, ' + pushed + ' Verlegung(en) nach Amelia übertragen.');
    if (errors.length) {
      sendAlert('Warnungen/Fehler im Lauf', errors.join('\n'));
    }
  } catch (err) {
    sendAlert('Fehler im Lauf', err.message + '\n\n' + err.stack);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// Schickt die neue Zeit an die WordPress-Route /booking-reschedule (siehe
// wordpress/buchungs-dashboard/wpcode-snippet.php). Wirft bei Fehlschlag
// (HTTP-Fehler oder Amelia-Fehlerantwort), damit der Aufrufer die
// Abweichung als Fehler meldet statt sie stillschweigend zu verwerfen —
// wird beim nächsten Tageslauf automatisch erneut versucht, weil dieses
// Skript zustandslos ist (kein "schon erledigt"-Merker).
function pushRescheduleToAmelia_(appointmentId, startDate, endDate) {
  var payload = {
    appointmentId: Number(appointmentId),
    newBookingStart: toUtcMysql_(startDate),
    newBookingEnd: toUtcMysql_(endDate),
  };
  var response = UrlFetchApp.fetch(WP_RESCHEDULE_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-ST-Reschedule-Secret': WP_RESCHEDULE_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('WordPress antwortete mit HTTP ' + code + ': ' + response.getContentText());
  }
}

function toUtcMysql_(date) {
  return Utilities.formatDate(date, 'Etc/UTC', 'yyyy-MM-dd HH:mm:ss');
}

// Manueller Testlauf (Run-Button im Editor) — identisch zu
// syncTerminAenderungenZurueck.
function runSyncNow() {
  syncTerminAenderungenZurueck();
}

// ---------- EINMALIGE AUFRÄUM-FUNKTION (nur bei Bedarf) ----------
//
// Historisch für den Vorfall vom 26.08.2026 gebaut (siehe Datei-Header) —
// löscht alle Termine in einem angegebenen Kalender, bei denen die
// angegebene Mailadresse als Gast eingetragen ist. Seit dem Kurswechsel
// (27.08.2026) legt dieses Skript keine Kopien mit Gästen mehr an, daher
// im Normalbetrieb nicht mehr gebraucht — nur falls noch Karteileichen
// aus einem früheren Testlauf der alten Version existieren.
//
// VORAUSSETZUNG: Im Editor links unter "Dienste" (+) einmalig die
// "Calendar API" als erweiterten Dienst hinzufügen — nur damit lässt sich
// beim Löschen sendUpdates:'none' setzen (verhindert Absage-Mails an alle
// Gäste der gelöschten Termine).
//
// AUSFÜHREN: Im Editor eine eigene kleine Funktion schreiben, die
// cleanupCalendarEventsForGuest_(KALENDER_ID, 'mail@beispiel.de') aufruft,
// und die dann per ▶ ausführen.
function cleanupCalendarEventsForGuest_(calendarId, guestEmail) {
  var pageToken = null;
  var checked = 0;
  var deleted = 0;
  do {
    var response = Calendar.Events.list(calendarId, {
      pageToken: pageToken,
      maxResults: 2500,
      singleEvents: true,
      timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
    });
    var items = response.items || [];
    items.forEach(function (ev) {
      checked++;
      var attendees = ev.attendees || [];
      var matches = attendees.some(function (a) {
        return a.email && a.email.toLowerCase() === guestEmail.toLowerCase();
      });
      if (matches) {
        Calendar.Events.remove(calendarId, ev.id, { sendUpdates: 'none' });
        deleted++;
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  var summary = checked + ' Termine geprüft, ' + deleted + ' mit Gast ' + guestEmail + ' gelöscht (ohne Benachrichtigung).';
  Logger.log(summary);
  sendAlert('Aufräumen abgeschlossen', summary);
}

function sendAlert(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Termin-Rückspiegelung: ' + subject, body);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
