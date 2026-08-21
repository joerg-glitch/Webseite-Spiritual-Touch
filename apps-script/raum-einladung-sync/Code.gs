/**
 * RAUM-1-KOPIE + KALENDER-EINLADUNG FÜR ECHTE MITARBEITER-MAILADRESSEN
 * ======================================================================
 * Eigenständiges Apps-Script-Projekt (getrennt von den bestehenden
 * Verfügbarkeits-Skripten "team-app/App Script - Sync" und
 * "apps-script/anfragen-verfuegbarkeit-sync").
 *
 * Zweck: Team-Mitglieder haben keinen Zugriff auf ihren eigenen
 * Hilfskalender (den nutzt Amelia intern für Verfügbarkeit UND schreibt
 * bestätigte Termine dort hinein, sobald ein Termin einem echten
 * Mitarbeiter zugewiesen wird) und auch nicht auf die
 * anfragen+NAME@spiritual-touch.de-Mailadresse. Damit sie trotzdem
 * merken, wenn ein neuer Termin für sie bestätigt wurde, kopiert dieses
 * Skript jeden neuen (nicht von den Verfügbarkeits-Skripten selbst
 * erzeugten) Termin aus dem Hilfskalender in den Kalender "Raum 1" und
 * trägt die ECHTE persönliche Mailadresse der Person als Gast ein —
 * Google Calendar verschickt dadurch automatisch eine Einladungsmail an
 * eine Adresse, die die Person tatsächlich liest, ohne ihr Zugriff auf
 * die @spiritual-touch.de-Domain oder den Hilfskalender geben zu müssen.
 *
 * Die zweite Hälfte von Jörgs Anfrage (23.08.2026) — die Mitarbeiter-Mail,
 * die Amelia an anfragen+NAME@spiritual-touch.de schickt, weiterleiten an
 * NAME@spiritual-touch.de (landet dort automatisch im Google-Chat-Room
 * dieser Person) — braucht KEIN Skript: ein normaler Gmail-Filter im
 * anfragen@spiritual-touch.de-Postfach ("an: anfragen+NAME@spiritual-
 * touch.de" → "Weiterleiten an: NAME@spiritual-touch.de") reicht dafür
 * völlig. Siehe README in diesem Ordner für die genauen Schritte.
 *
 * EINRICHTUNG:
 * 1. Neues Apps-Script-Projekt unter script.google.com anlegen (als
 *    joerg@spiritual-touch.de — hat Zugriff auf alle unten genannten
 *    Kalender).
 * 2. Diesen Code als Code.gs einfügen.
 * 3. Einmal manuell "runSyncNow" ausführen (Run-Button) → Google fragt
 *    nach Kalender-Berechtigungen → erlauben.
 * 4. Zeitgesteuerten Trigger einrichten (Uhr-Symbol links): Funktion
 *    "syncRaumEinladungen", zeitgesteuert, "Minuten-Timer" → "Jede
 *    Minute" (schnellste verfügbare Option — damit die Kalender-
 *    Einladung praktisch zeitgleich mit Amelias eigener Mitarbeiter-Mail
 *    ankommt, siehe Jörgs Rückmeldung vom 23.08.2026: sein Team ist
 *    "nicht sehr technisch-affin" und soll bei "Mail da, Termin noch
 *    nicht im Kalender" nicht nachfragen müssen).
 * 5. ZWEITEN Trigger einrichten: Funktion "syncTeamChangesBackToAmelia",
 *    zeitgesteuert, "Tage-Timer" → einmal täglich, Uhrzeit egal (z. B.
 *    nachts) — trägt vom Team im Raum-1-Kalender verschobene Termine
 *    automatisch in Amelia ein, siehe "RÜCKRICHTUNG KALENDER → AMELIA"
 *    unten.
 * 6. WP_RESCHEDULE_SECRET unten (Konfiguration) auf denselben Wert
 *    setzen wie ST_RESCHEDULE_SECRET in wordpress/buchungs-dashboard/
 *    wpcode-snippet.php — langer zufälliger String, auf beiden Seiten
 *    identisch.
 * 7. Mila fehlt bewusst (keine Hilfskalender-ID bekannt, siehe README) —
 *    vor dem Ergänzen bei Jörg nachfragen.
 *
 * SICHERHEIT: Liest die Hilfskalender NUR — schreibt oder markiert dort
 * nichts mehr (siehe "Fingerabdruck-Abgleich" unten). Schreibt
 * ausschließlich in Raum 1. Braucht deshalb auch nur Lesezugriff auf die
 * Hilfskalender, nie Schreibzugriff.
 *
 * TERMIN-ID-ABGLEICH (26.08.2026, dritter Anlauf): Wenn Jörg einer
 * Anfrage nachträglich einen anderen Mitarbeiter zuweist ODER Datum/
 * Uhrzeit ändert, löscht Amelia den Termin im alten Hilfskalender und
 * legt ihn im neuen (oder mit neuer Zeit im selben) komplett neu an —
 * neue Google-Calendar-Event-ID. Ein Tag AM Termin selbst (erster
 * Anlauf) oder ein Fingerabdruck aus Titel+Zeit (zweiter Anlauf, siehe
 * Git-Verlauf) übersteht das eine wie das andere nicht zuverlässig —
 * Titel+Zeit ändert sich bei einer echten Verlegung ja gerade.
 *
 * Jörg hat deshalb Amelias Kalender-Vorlage um `Termin-ID: %appointment_
 * id%` in der Beschreibung ergänzt (Amelia → Einstellungen → Termine →
 * "Titel und Beschreibung der Veranstaltung") — die numerische Amelia-
 * Termin-ID bleibt über Umbesetzung UND Verlegung hinweg stabil.
 * `trackingKey_()` liest sie per Regex aus der Beschreibung und nutzt sie
 * als Schlüssel in `PropertiesService` (Fallback auf den alten
 * Titel+Zeit-Fingerabdruck für ältere Termine ohne diese Zeile). Bei
 * jedem Lauf wird der gespeicherte Stand (Mitarbeiter, Start, Ende,
 * Titel, Ort) mit dem aktuellen Amelia-Termin verglichen — geändert sich
 * etwas, wird die BESTEHENDE Raum-1-Kopie angepasst (Zeit verschoben,
 * Gast umgehängt, Titel/Ort aktualisiert) statt eine zweite anzulegen.
 * RÜCKRICHTUNG KALENDER → AMELIA (27.08.2026): Das Team darf Raum-1-
 * Termine frei verschieben (Jörgs ausdrückliche Vorgabe: alles andere
 * bedeutet "drei Ecken" — Team müsste ihm schreiben, er müsste es dann
 * manuell in Amelia nachtragen). Raum-1-Kopien werden deshalb NICHT mehr
 * mit `setGuestsCanModify(false)` gesperrt. Stattdessen läuft einmal
 * täglich `syncTeamChangesBackToAmelia()`: vergleicht für jeden per
 * echter Termin-ID getrackten Raum-1-Termin die aktuelle Start-/Endzeit
 * mit der zuletzt bekannten Amelia-Zeit (im selben PropertiesService-
 * Eintrag gespeichert) und trägt eine Abweichung automatisch über die
 * neue WordPress-Route /booking-reschedule in Amelia ein — ganz ohne
 * Rückfrage oder Benachrichtigung an Jörg (nur echte Fehler landen per
 * Mail bei ihm, siehe `sendAlert()`). Termine ohne echte Termin-ID
 * (Fingerabdruck-Fallback) werden dabei übersprungen, weil dafür keine
 * Amelia-Termin-ID zum Zurückschreiben vorliegt.
 *
 * Bewusst NICHT geprüft: Doppelbuchungen/Kollisionen mit anderen Terminen
 * der Zielperson — Jörg hat dieses Risiko in Kenntnis akzeptiert
 * (27.08.2026), um ganz ohne manuellen Freigabe-Schritt auszukommen.
 *
 * ⚠️ VORFALL 26.08.2026: Eva war anfangs mit ihrem privaten Gmail-Kalender
 * (statt einem reinen Amelia-Ressourcen-Konto) in MEMBERS enthalten. Das
 * Skript hat all ihre privaten Termine (Arzttermine, "Arbeit", Hotel-
 * Aufenthalt usw.) fälschlich als neue Amelia-Termine erkannt UND — weil
 * das ausführende Konto auf ihrem Kalender nur Lese- statt Schreibrechte
 * hatte — sie bei jedem Minuten-Lauf erneut kopiert (das Markieren als
 * "erledigt" schlug fehl). Ergebnis: hunderte doppelte
 * Kalendereinladungen. Eva wurde aus MEMBERS entfernt, `cleanupEvaMistaken
 * Copies()` ganz unten räumt die entstandenen Duplikate in einem Rutsch
 * auf. Der Umstieg auf den Fingerabdruck-Abgleich oben behebt zusätzlich
 * die eigentliche Ursache (Schreibversuch auf einen Kalender ohne
 * Schreibrechte) strukturell für jeden, nicht nur für Eva.
 */

// ---------- KONFIGURATION ----------

var RAUM1_CALENDAR_ID = 'c_f25a3e235e34401a8393190730178ce8a79865f54cac5f814cc18261794671a5@group.calendar.google.com';

// Name -> { Hilfskalender-ID (aus "team-app/App Script - Sync",
// MEMBERS-Liste dort), echte persönliche Mailadresse (für die
// Kalender-Einladung, von Jörg am 23.08.2026 mitgeteilt) }. Jörg
// absichtlich nicht enthalten ("analog zu allen anderen außer mir
// selbst").
var MEMBERS = [
  { name: 'Tara',       hilfsCalId: 'c_fe6664e01f568080774112156e255089ea2ea2877109d6ddb241d046ebff58fb@group.calendar.google.com', email: 'tara.spiritual@gmail.com' },
  // Eva ENTFERNT (26.08.2026, siehe README "Vorfall 26.08.2026") — ihr
  // Hilfskalender ist ihr privater Gmail-Kalender voller persönlicher
  // Termine, kein reines Amelia-Ressourcen-Konto. Nicht wieder ergänzen,
  // ohne vorher eine Filterung auf "wirklich von Amelia" zu bauen. Eva
  // kopiert ihre Termine seither selbst.
  { name: 'Asmita',     hilfsCalId: 'c_72c5bf2bb1c90f5424d77c3f1f6593cf2cf6fe05f27204ff1c73f3632350cabd@group.calendar.google.com', email: 'rositsa.bogdanova232@gmail.com' },
  { name: 'Amila',      hilfsCalId: 'c_727306d56fd4b1755718073543de922a25edc2509fcb14f2b4e53b7a9263b72a@group.calendar.google.com', email: 'uta.schuppert@gmail.com' },
  { name: 'Sarah',      hilfsCalId: 'c_d37ba1f2e4913be355bc25873d90dc9ee115b70537adfd5a6b2a5f1e98d26361@group.calendar.google.com', email: 'sarahfriedrich321@gmail.com' },
  { name: 'Dominik',    hilfsCalId: 'c_0d3ba2a1dde3033c512dfd51c12fd0bb0c23b3e41297c169c214e76ced530669@group.calendar.google.com', email: 'bimo83@t-online.de' },
  { name: 'Konstantin', hilfsCalId: 'c_459599398173cc57da9c45a996d1946f1ea0f3b057bdcb1732fd752d298ae15e@group.calendar.google.com', email: 'konstantion.dellbruegge@gmail.com' },
  { name: 'Alea',       hilfsCalId: 'c_bee7bf11c2bdae2e7d8bda28b87fd27c5f4bd3cf45124c65da06d799ae9edb7f@group.calendar.google.com', email: 'alea.tantramassage@gmail.com' },
  { name: 'Stephanie',  hilfsCalId: 'c_360bace4072d8f2356127d9b6dd12b2c45c63be5dd791f86fbc0018e00d06714@group.calendar.google.com', email: 'stephanie@primal-living.de' },
  { name: 'Karen',      hilfsCalId: 'c_1caea88007e19c7154765e9a9a3370c8f912f40a46c32145486b862d8770c0c7@group.calendar.google.com', email: 'karenzeiler24@gmail.com' },
  { name: 'Maxine',     hilfsCalId: 'c_b3600e5f62821b31ef76a82e9c9078070a0c8e9e29641463b7ae270e6871f33d@group.calendar.google.com', email: 'parampampas@yahoo.com' }
  // Mila fehlt bewusst: keine Hilfskalender-ID bekannt, taucht in keinem
  // bisherigen Sync-Skript auf. Vor dem Ergänzen bei Jörg die ID
  // erfragen (siehe README, "Offene Punkte").
];

var SYNC_DAYS_AHEAD = 90; // gleicher Vorlauf wie das Buchungs-Dashboard

// Präfix für die Fingerabdruck-Einträge in PropertiesService — siehe
// Datei-Header "FINGERABDRUCK-ABGLEICH".
var FINGERPRINT_PREFIX = 'raumSync_';

// Aus "team-app/App Script - Sync" — dieselben Marker, um dessen eigene
// Verfügbarkeits-Blocker sicher zu erkennen und zu überspringen.
var TEAM_APP_BLOCK_TAG_KEY = 'autoBlock';
var TEAM_APP_BLOCK_TAG_VALUE = 'true';
var TEAM_APP_BLOCK_TITLE = 'Blockiert (Verfügbarkeit-Sync)';

var ALERT_EMAIL = 'joerg@spiritual-touch.de';

// WordPress-Route für die Rückrichtung Kalender → Amelia (siehe
// "RÜCKRICHTUNG KALENDER → AMELIA" im Datei-Header). Muss zu
// ST_RESCHEDULE_SECRET in wordpress/buchungs-dashboard/wpcode-snippet.php
// passen (dort auch ST_RESCHEDULE_ADMIN_USER_ID setzen).
var WP_RESCHEDULE_URL = 'https://spiritual-touch.de/wp-json/st/v1/booking-reschedule';
var WP_RESCHEDULE_SECRET = 'DEIN-ZUFAELLIGES-PASSWORT-HIER';

// ---------- HAUPTFUNKTION (Trigger: jede Minute) ----------

function syncRaumEinladungen() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Ein anderer Lauf ist bereits aktiv – übersprungen.');
    return;
  }
  try {
    var raum1 = CalendarApp.getCalendarById(RAUM1_CALENDAR_ID);
    if (!raum1) {
      throw new Error('Raum-1-Kalender nicht gefunden/kein Zugriff: ' + RAUM1_CALENDAR_ID);
    }

    var props = PropertiesService.getScriptProperties();
    var now = new Date();
    var horizonEnd = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    var copied = 0;
    var updated = 0;
    var errors = [];

    MEMBERS.forEach(function (member) {
      var helperCal = CalendarApp.getCalendarById(member.hilfsCalId);
      if (!helperCal) {
        errors.push(member.name + ': Hilfskalender nicht gefunden/kein Zugriff (' + member.hilfsCalId + ')');
        return;
      }

      var events = helperCal.getEvents(now, horizonEnd);
      events.forEach(function (e) {
        try {
          if (isTeamAppBlock(e)) return; // Verfügbarkeits-Blocker, kein echter Termin

          var key = trackingKey_(e);
          var stored = props.getProperty(key);
          var snapshot = {
            member: member.name,
            email: member.email,
            title: e.getTitle(),
            start: e.getStartTime().toISOString(),
            end: e.getEndTime().toISOString(),
            location: e.getLocation() || '',
          };

          if (!stored) {
            // Noch nie gesehen -> neu nach Raum 1 kopieren.
            var newCopy = raum1.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime(), {
              description: e.getDescription(),
              location: e.getLocation(),
              guests: member.email,
              sendInvites: true,
            });
            // Bewusst OHNE setGuestsCanModify(false) — das Team soll den Termin
            // selbst verschieben können, siehe "RÜCKRICHTUNG KALENDER → AMELIA"
            // im Datei-Header.
            snapshot.raum1EventId = newCopy.getId();
            props.setProperty(key, JSON.stringify(snapshot));
            copied++;
            Logger.log('Kopiert für ' + member.name + ': "' + e.getTitle() + '" am ' + e.getStartTime());
            return;
          }

          var data = JSON.parse(stored);
          var memberChanged = data.member !== snapshot.member;
          var timeChanged = data.start !== snapshot.start || data.end !== snapshot.end;
          var titleChanged = data.title !== snapshot.title;
          var locationChanged = data.location !== snapshot.location;
          if (!memberChanged && !timeChanged && !titleChanged && !locationChanged) return; // unverändert

          var raum1Event = data.raum1EventId ? CalendarApp.getEventById(data.raum1EventId) : null;
          if (!raum1Event) {
            // Kopie existiert nicht mehr (z. B. manuell gelöscht) -> neu anlegen.
            raum1Event = raum1.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime(), {
              description: e.getDescription(),
              location: e.getLocation(),
              guests: member.email,
              sendInvites: true,
            });
          } else {
            if (memberChanged) {
              try {
                raum1Event.removeGuest(data.email);
              } catch (rmErr) {
                // Gast evtl. schon entfernt/nie erfolgreich hinzugefügt — kein Abbruch.
              }
              raum1Event.addGuest(member.email);
            }
            if (timeChanged) {
              raum1Event.setTime(e.getStartTime(), e.getEndTime());
            }
            if (titleChanged) {
              raum1Event.setTitle(e.getTitle());
            }
            if (locationChanged) {
              raum1Event.setLocation(e.getLocation() || '');
            }
            raum1Event.setDescription(e.getDescription() || '');
          }

          snapshot.raum1EventId = raum1Event.getId();
          props.setProperty(key, JSON.stringify(snapshot));
          updated++;
          Logger.log('Aktualisiert (' + key + '): "' + e.getTitle() + '" — ' + [
            memberChanged ? (data.member + ' -> ' + member.name) : null,
            timeChanged ? ('Zeit ' + data.start + ' -> ' + snapshot.start) : null,
            titleChanged ? 'Titel geändert' : null,
            locationChanged ? 'Ort geändert' : null,
          ].filter(Boolean).join(', '));
        } catch (evErr) {
          errors.push(member.name + ' / Termin "' + e.getTitle() + '": ' + evErr.message);
        }
      });
    });

    var prunedCount = pruneOldFingerprints_(props, now);

    Logger.log(copied + ' neu kopiert, ' + updated + ' aktualisiert (Umbesetzung/Verlegung), ' + prunedCount + ' alte Einträge aufgeräumt.');
    if (errors.length > 0) {
      sendAlert('Warnungen im Lauf', errors.join('\n'));
    }
  } catch (err) {
    sendAlert('Fehler im Lauf', err.message + '\n\n' + err.stack);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// Regex für die von Jörg am 26.08.2026 ergänzte Amelia-Vorlagenzeile
// "Termin-ID: %appointment_id%" (siehe Datei-Header).
var APPOINTMENT_ID_REGEX = /Termin-ID:\s*(\d+)/i;

// Liefert den stabilsten verfügbaren Schlüssel für einen Termin: die
// echte Amelia-Termin-ID aus der Beschreibung, wenn vorhanden (übersteht
// Umbesetzung UND Verlegung) — sonst Fallback auf den alten
// Titel+Zeit-Fingerabdruck für Termine von vor der Vorlagen-Änderung
// (übersteht nur eine reine Umbesetzung, keine Verlegung, siehe
// Datei-Header).
function trackingKey_(e) {
  var desc = e.getDescription() || '';
  var match = desc.match(APPOINTMENT_ID_REGEX);
  if (match) {
    return 'id_' + match[1];
  }
  return fingerprintKey_(e.getTitle(), e.getStartTime(), e.getEndTime());
}

// Baut aus Titel+Start+Ende einen kompakten, stabilen Schlüssel für
// PropertiesService (MD5, weil Property-Keys kurz und aus unbedenklichen
// Zeichen bestehen müssen). Nur noch Fallback, siehe trackingKey_().
function fingerprintKey_(title, start, end) {
  var raw = title + '|' + start.toISOString() + '|' + end.toISOString();
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  var hex = digestBytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return FINGERPRINT_PREFIX + hex;
}

// Entfernt Tracking-Einträge, deren Termin mehr als einen Tag in der
// Vergangenheit liegt — verhindert, dass PropertiesService (Limit: 500
// Einträge / 9 KB pro Wert / 500 KB insgesamt) über die Zeit unbegrenzt
// vollläuft.
function pruneOldFingerprints_(props, now) {
  var cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var all = props.getProperties();
  var pruned = 0;
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(FINGERPRINT_PREFIX) !== 0 && key.indexOf('id_') !== 0) return;
    try {
      var data = JSON.parse(all[key]);
      if (data.start && new Date(data.start) < cutoff) {
        props.deleteProperty(key);
        pruned++;
      }
    } catch (parseErr) {
      // Unlesbarer Alteintrag (z. B. vom allerersten Tag-basierten Format) -> löschen.
      props.deleteProperty(key);
      pruned++;
    }
  });
  return pruned;
}

// Manueller Testlauf (Run-Button im Editor) — identisch zu syncRaumEinladungen.
function runSyncNow() {
  syncRaumEinladungen();
}

// ---------- RÜCKRICHTUNG KALENDER → AMELIA (Trigger: einmal täglich) ----------
//
// Siehe Datei-Header, Abschnitt "RÜCKRICHTUNG KALENDER → AMELIA". Prüft für
// jeden per echter Amelia-Termin-ID getrackten Raum-1-Termin, ob die
// tatsächliche Start-/Endzeit von der zuletzt bekannten Amelia-Zeit
// abweicht (= das Team hat den Termin in Raum 1 verschoben) und trägt eine
// Abweichung automatisch in Amelia ein. Läuft bewusst NICHT im
// Minuten-Trigger mit (einmal täglich reicht laut Jörg, spart zusätzliche
// externe Requests bei jedem Minuten-Lauf).
function syncTeamChangesBackToAmelia() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Ein anderer Lauf ist bereits aktiv – übersprungen.');
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var pushed = 0;
    var errors = [];

    Object.keys(all).forEach(function (key) {
      if (key.indexOf('id_') !== 0) return; // nur Termine mit echter Amelia-Termin-ID lassen sich zurückschreiben

      var data;
      try {
        data = JSON.parse(all[key]);
      } catch (parseErr) {
        return; // unlesbarer Alteintrag, wird von pruneOldFingerprints_ im nächsten Minuten-Lauf entfernt
      }
      if (!data.raum1EventId) return;

      var raum1Event = CalendarApp.getEventById(data.raum1EventId);
      if (!raum1Event) return; // Kopie gelöscht — der Minuten-Lauf legt sie bei Bedarf neu an

      var currentStart = raum1Event.getStartTime();
      var currentEnd = raum1Event.getEndTime();
      var storedStart = new Date(data.start);
      var storedEnd = new Date(data.end);
      if (currentStart.getTime() === storedStart.getTime() && currentEnd.getTime() === storedEnd.getTime()) {
        return; // unverändert
      }

      var appointmentId = key.substring('id_'.length);
      try {
        pushRescheduleToAmelia_(appointmentId, currentStart, currentEnd);
        data.start = currentStart.toISOString();
        data.end = currentEnd.toISOString();
        props.setProperty(key, JSON.stringify(data));
        pushed++;
        Logger.log('Rückrichtung: Termin-ID ' + appointmentId + ' (' + data.member + ') auf ' + currentStart + ' – ' + currentEnd + ' verschoben.');
      } catch (pushErr) {
        errors.push('Termin-ID ' + appointmentId + ' (' + data.member + '): ' + pushErr.message);
      }
    });

    Logger.log(pushed + ' Verlegung(en) nach Amelia übertragen.');
    if (errors.length > 0) {
      sendAlert('Fehler bei Rückrichtung Kalender → Amelia', errors.join('\n'));
    }
  } catch (err) {
    sendAlert('Fehler im Lauf (Rückrichtung)', err.message + '\n\n' + err.stack);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// Schickt die neue Zeit an die WordPress-Route /booking-reschedule (siehe
// wordpress/buchungs-dashboard/wpcode-snippet.php). Wirft bei Fehlschlag
// (HTTP-Fehler oder Amelia-Fehlerantwort), damit der Aufrufer den Eintrag
// NICHT als erledigt markiert und es beim nächsten Tageslauf erneut
// versucht.
function pushRescheduleToAmelia_(appointmentId, startDate, endDate) {
  var payload = {
    appointmentId: Number(appointmentId),
    newBookingStart: Utilities.formatDate(startDate, 'Etc/UTC', 'yyyy-MM-dd HH:mm:ss'),
    newBookingEnd: Utilities.formatDate(endDate, 'Etc/UTC', 'yyyy-MM-dd HH:mm:ss'),
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

// Manueller Testlauf (Run-Button im Editor) — identisch zu syncTeamChangesBackToAmelia.
function runReverseSyncNow() {
  syncTeamChangesBackToAmelia();
}

function isTeamAppBlock(e) {
  if (e.getTag(TEAM_APP_BLOCK_TAG_KEY) === TEAM_APP_BLOCK_TAG_VALUE) return true;
  if (e.getTitle() === TEAM_APP_BLOCK_TITLE) return true;
  var desc = e.getDescription() || '';
  return desc.indexOf('autoBlock:true') > -1; // alte, vor der Tag-Umstellung erzeugte Blocker
}

// ---------- EINMALIGE AUFRÄUM-FUNKTION (Vorfall 26.08.2026) ----------
//
// Löscht alle Termine in Raum 1, bei denen die angegebene Mailadresse als
// Gast eingetragen ist — lässt alle anderen (echten) Raum-1-Termine
// unangetastet. Für den Vorfall vom 26.08.2026 gebaut (Evas privater
// Kalender wurde fälschlich als Quelle verwendet, siehe README), aber
// allgemein nutzbar für jede Adresse.
//
// VORAUSSETZUNG: Im Editor links unter "Dienste" (+) einmalig die
// "Calendar API" als erweiterten Dienst hinzufügen — nur damit lässt sich
// beim Löschen sendUpdates:'none' setzen. Ohne das würde Google Calendar
// für jeden gelöschten Termin eine Absage-Mail an alle Gäste verschicken
// — also noch mehr Mails an Eva und dich obendrauf auf die
// versehentlichen Einladungen.
//
// AUSFÜHREN: Im Editor die Funktion "cleanupEvaMistakenCopies" auswählen
// und ▶ klicken. Prüft/löscht in einem Rutsch, keine Einzelklicks nötig.
function cleanupRaum1EventsForGuest_(guestEmail) {
  var pageToken = null;
  var checked = 0;
  var deleted = 0;
  do {
    var response = Calendar.Events.list(RAUM1_CALENDAR_ID, {
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
        Calendar.Events.remove(RAUM1_CALENDAR_ID, ev.id, { sendUpdates: 'none' });
        deleted++;
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);

  var summary = checked + ' Termine in Raum 1 geprüft, ' + deleted + ' mit Gast ' + guestEmail + ' gelöscht (ohne Benachrichtigung).';
  Logger.log(summary);
  sendAlert('Aufräumen abgeschlossen', summary);
}

function cleanupEvaMistakenCopies() {
  cleanupRaum1EventsForGuest_('eva.saur1993@gmail.com');
}

function sendAlert(subject, body) {
  try {
    MailApp.sendEmail(ALERT_EMAIL, 'Raum-Einladung-Sync: ' + subject, body);
  } catch (mailErr) {
    Logger.log('Alert-Mail fehlgeschlagen: ' + mailErr.message);
  }
}
