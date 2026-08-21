<?php
/**
 * Versionsnummer, unten im Dashboard sichtbar (siehe Shortcode) — damit auf
 * einen Blick im Browser erkennbar ist, ob ein WPCode-Deploy die neueste
 * Version tatsächlich übernommen hat, ohne dafür in GitHub nachsehen zu
 * müssen. Bei jeder inhaltlichen Änderung an dieser Datei erhöhen.
 *
 * Verlauf:
 *   2026-08-21.1  Smart Freigeben gebaut (Verfügbarkeitsprüfung, Zuweisung)
 *   2026-08-21.2  Zeitzonen-Fix (UTC→lokal) + Verfügbarkeit-Debug-Button
 *   2026-08-21.3  Service-Pairing per DB-Lookup statt fester Tabelle
 *   2026-08-21.4  Diagnosedaten bei Nonce-Fehler, Versionsnummer eingeführt
 *   2026-08-21.5  Fix: fehlender /wp-admin-Cookie selbst erzeugt statt
 *                 auf Browser-Weiterleitung zu hoffen (Login-Seite statt
 *                 Amelia-Bookings-Seite war die eigentliche Ursache des
 *                 Nonce-Fehlers)
 *   2026-08-21.6  Fix: Slots-Abgleich sucht jetzt am richtigen Pfad
 *                 (data.slots[Datum][Uhrzeit] als Schlüssel, nicht als
 *                 Text-Wert) + Debug-Ausgabe stark gekürzt, weil die volle
 *                 Amelia-Antwort (mehrjähriger Slot-Zeitraum) den Browser
 *                 zum Hängen brachte
 *   2026-08-23.1  Fix: Selbstblockade durch den gerade bewerteten Termin
 *                 selbst erkannt und per DB-Gegenprobe ausgeschlossen
 *                 (Jörgs Vorgabe: "eigenen Termin ausschließen"). Eva als
 *                 Backup-Kandidatin für "weiblich"/"egal" ergänzt (Jörg
 *                 selbst bleibt bewusst außen vor).
 *   2026-08-23.2  Fix: Anfragen/Bestätigt-Filter (isConfirmed) erkennt
 *                 jetzt an der providerId (Pseudo-Mitarbeiter 36/37/38)
 *                 statt am Servicenamen — die alte "(bestätigt)"-Text-
 *                 Prüfung markierte normale, direkt an einen echten
 *                 Mitarbeiter gebuchte Dienstleistungen (z. B.
 *                 Körperarbeit) fälschlich als "Anfrage".
 *   2026-08-23.3  Fix: Die 23.1-Selbstblockade-Gegenprobe war zu
 *                 großzügig — sie hätte auch echte, mehrstündige
 *                 Google-Kalender-Blockaden (siehe team-app "App Script -
 *                 Sync", von Amelia tatsächlich als Verfügbarkeit gelesen)
 *                 fälschlich übergangen. Neue Breiten-Plausibilitätsgrenze
 *                 (st_slots_gap_width_minutes_()): nur noch als
 *                 Selbstblockade werten, wenn die belegte Lücke ungefähr
 *                 zur Dauer des gerade bewerteten Termins passt.
 *   2026-08-23.4  Vereinfacht auf Jörgs Wunsch: Die komplette /slots-
 *                 Verfügbarkeitsprüfung entfernt (lieferte für jeden
 *                 Kandidaten dieselbe generische Antwort statt einer
 *                 echten personenbezogenen Prüfung — an einem echten Fall
 *                 fälschlich alle 9 Frauen als frei gemeldet, dazu langsam
 *                 durch 9 sequenzielle externe Requests). Smart Freigeben
 *                 zeigt jetzt einfach alle geschlechtspassenden
 *                 Kandidat:innen zur manuellen Auswahl, auch bei nur einer
 *                 Person — Jörg schaut selbst in den Kalender.
 *   2026-08-24.1  Neue Route /booking-reschedule für die Rückrichtung
 *                 Kalender → Amelia (siehe apps-script/raum-einladung-sync):
 *                 Wenn das Team einen Termin im Raum-1-Kalender auf eine
 *                 andere Zeit verschiebt, trägt ein einmal täglich
 *                 laufendes Apps Script das automatisch in Amelia ein — auf
 *                 Jörgs ausdrücklichen Wunsch ganz ohne Freigabe-Schritt
 *                 und ohne Benachrichtigung an ihn (nur Fehler melden).
 *                 Abgesichert per gemeinsamem Geheimnis (kein WP-Login
 *                 vorhanden), dafür st_fetch_appointment_raw_() um
 *                 categoryId erweitert (Join auf amelia_services) und
 *                 st_build_reschedule_payload_() neu gebaut. ⚠️ Vor Go-Live
 *                 müssen ST_RESCHEDULE_SECRET und ST_RESCHEDULE_ADMIN_USER_ID
 *                 unten mit echten Werten befüllt werden.
 *   2026-08-27.1  /booking-reschedule bekommt einen zweiten Aufrufer: die
 *                 Team-App (team-app/App Script, Menüpunkt "Termine →
 *                 Ändern") ruft jetzt direkt auf, wenn ein Teammitglied
 *                 Datum/Uhrzeit eines eigenen Termins anpasst — ersetzt den
 *                 zuvor angedachten Ansatz mit eingebettetem Amelia-Panel
 *                 (siehe team-app/README.md). Nur Kommentare hier
 *                 aktualisiert, keine Code-Änderung an der Route selbst
 *                 nötig, sie war bereits allgemein (aufrufer-unabhängig).
 */
define('ST_BD_VERSION', '2026-08-27.1');

/**
 * ST Buchungs-Dashboard
 *
 * Mobile Lese-Übersicht über anstehende Amelia-Buchungen (inkl. "Ausstehend"),
 * damit Jörg unterwegs (Handy-Browser) schnell sieht, was ansteht — ohne durch
 * die wp-admin-Navigation zu müssen und ohne Amelia-Plan-Upgrade.
 *
 * Freigeben (Status "Ausstehend" → "Freigegeben") geht direkt im Dashboard,
 * per Button. Kategorie/Dienstleistung/Mitarbeiter ändern noch nicht (siehe
 * README, Abschnitt "Nächster Schritt") — für beides gilt: kein rohes
 * Datenbank-UPDATE, sondern derselbe interne Request, den Amelias eigene
 * Oberfläche selbst verschickt, damit Bestätigungsmail/Kalender-Sync/
 * Zahlungsstatus garantiert intakt bleiben.
 *
 * Enthält:
 *   - REST-Route  GET /wp-json/st/v1/booking-overview  (JSON, nur für
 *     eingeloggte Admins, per WP-Nonce abgesichert)
 *   - Shortcode   [st_booking_dashboard]  (auf einer WordPress-Seite platzieren,
 *     z. B. über den WPCode-Shortcode-Type oder einen Elementor-Shortcode-Widget)
 *   - Filter "Alle / Anfragen / Bestätigt": erkennt am Namenszusatz
 *     "(bestätigt)", ob eine Buchung noch beim Anfrage-Platzhalter hängt oder
 *     schon auf das (bestätigt)-Duplikat mit echtem Mitarbeiter umgehängt
 *     wurde (siehe Jörgs Kategorie-Mechanik, versteckte Kategorie "Bestätigt").
 *
 * WICHTIG — Datenbank-Schema-Annahme:
 * Die SQL-Abfrage unten geht von den Standard-Amelia-Tabellennamen und
 * -Spalten aus (Tabellenpräfix "txva_", siehe database/wordpress-content.sql
 * in diesem Repo). Amelia-Tabellen/-Spalten können sich je nach Plugin-Version
 * leicht unterscheiden. Falls die erste Ausführung einen SQL-Fehler zeigt,
 * einmal `?debug=1` an die REST-URL anhängen (nur als eingeloggter Admin) —
 * das listet die tatsächlichen Spalten der relevanten Tabellen auf, damit die
 * Query schnell angepasst werden kann. Genau dasselbe Vorgehen wie beim
 * Login-Fix der Team-App (siehe Notion, "Buchungssystem — Übergabe &
 * Dokumentation").
 *
 * SCHREIB-AKTIONEN (Freigeben, Smart Freigeben):
 * Statt Amelias interne Logik nachzubauen, ruft der Proxy denselben internen
 * AJAX-Endpunkt auf, den Amelias eigene Oberfläche selbst benutzt
 * (admin-ajax.php?action=wpamelia_api), mit der GERADE AKTIVEN Session des
 * aufrufenden Admins (Cookies werden pro Request live weitergereicht, nie
 * gespeichert) und einem frisch von der echten Amelia-Bookings-Seite
 * abgegriffenen Nonce. Dadurch laufen Benachrichtigungen/Kalender-Sync/
 * Zahlungsstatus exakt wie bei einem normalen Klick in Amelia selbst.
 * Kein Secret/Token wird im Code gespeichert.
 *
 * SMART FREIGEBEN (siehe README, Abschnitt "Nächster Schritt: Smart
 * Freigeben" für Herkunft/Referenzdaten): Bei einer Anfrage-Buchung
 * ermittelt "Freigeben", welche Mitarbeiter:innen zur Geschlechts-
 * Präferenz passen, und zeigt sie im Dashboard zur Auswahl — auch wenn
 * nur eine Person infrage kommt. Jörg wählt nach einem kurzen Blick in
 * den eigenen Kalender manuell aus, danach läuft Zuweisung + Freigabe
 * automatisch (Route /booking-reassign, dann die bestehende
 * /booking-approve). Bewusst KEINE automatische Verfügbarkeitsprüfung
 * mehr (siehe Versionsverlauf 2026-08-23.4): ein Versuch darüber, Amelias
 * eigenen /slots-Endpunkt abzufragen, lieferte am 23.08.2026 an einem
 * echten Fall für jede Kandidatin dieselbe generische (falsche) Antwort
 * und war dazu sehr langsam — auf Jörgs Wunsch entfernt zugunsten von
 * "System schlägt Kandidat:innen vor, Mensch entscheidet".
 */

/**
 * Reicht die Cookies des aktuellen Requests (Login-Session des Admins) an
 * einen internen Amelia-Aufruf weiter. Nichts davon wird gespeichert.
 */
function st_forward_cookies_() {
    $cookies = [];
    foreach ($_COOKIE as $name => $value) {
        $cookies[] = new WP_Http_Cookie(['name' => $name, 'value' => $value]);
    }

    // WordPress schützt /wp-admin/-Seiten (admin.php, admin-ajax.php) mit
    // einem zusätzlichen Auth-Cookie, den der Browser NUR an /wp-admin/-
    // Aufrufe schickt (Cookie-Pfad-Beschränkung, siehe ADMIN_COOKIE_PATH).
    // Unser Dashboard läuft bewusst außerhalb von /wp-admin, auch die
    // REST-Route liegt unter /wp-json/ — dieser Cookie landet deshalb nie
    // in $_COOKIE, egal von welcher Seite aus aufgerufen wird (gefunden
    // 21.08.2026: admin.php?page=wpamelia-bookings kam server-seitig immer
    // als Login-Seite zurück). Deshalb hier für den bereits per
    // manage_options geprüften aktuellen Nutzer frisch erzeugen, statt auf
    // einen nie vorhandenen Browser-Cookie zu hoffen — dieselbe
    // WordPress-eigene Funktion, die auch beim echten Login läuft.
    $user_id = get_current_user_id();
    if ($user_id) {
        $scheme = is_ssl() ? 'secure_auth' : 'auth';
        $cookie_name = is_ssl() ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
        $cookies[] = new WP_Http_Cookie([
            'name' => $cookie_name,
            'value' => wp_generate_auth_cookie($user_id, time() + 10 * MINUTE_IN_SECONDS, $scheme),
        ]);
    }

    return $cookies;
}

/**
 * Holt sich einen frischen wpAmeliaNonce direkt von der echten Amelia-
 * Bookings-Seite (dieselbe Session) statt ihn zu raten oder fest zu
 * hinterlegen — Nonces laufen ab und werden bei jedem Seitenaufruf neu
 * erzeugt.
 */
function st_scrape_amelia_nonce_() {
    $url = admin_url('admin.php?page=wpamelia-bookings');
    $response = wp_remote_get($url, [
        'cookies' => st_forward_cookies_(),
        'timeout' => 15,
    ]);
    if (is_wp_error($response)) {
        return $response;
    }
    $body = wp_remote_retrieve_body($response);
    if (!preg_match('/wpAmeliaNonce["\']?\s*[:=]\s*["\']([a-zA-Z0-9]{6,20})["\']/', $body, $m)) {
        // Diagnosedaten mitgeben statt nur "nicht gefunden" — sonst lässt
        // sich von außen nicht unterscheiden, ob z. B. eine Login-Seite,
        // eine leere Antwort oder die richtige Seite mit geändertem
        // Nonce-Format zurückkam.
        return new WP_Error('nonce_not_found', 'Amelia-Nonce nicht auf der Bookings-Seite gefunden.', [
            'response_code' => wp_remote_retrieve_response_code($response),
            'html_length' => strlen($body),
            'html_snippet' => substr($body, 0, 1000),
        ]);
    }
    return ['nonce' => $m[1], 'html' => $body];
}

/**
 * Ruft admin-ajax.php?action=wpamelia_api&call=... mit der Session des
 * aktuellen Admins auf (Cookies live weitergereicht, frischer Nonce).
 */
function st_amelia_ajax_call_($method, $call_path, $query_extra = [], $body = null) {
    $ctx = st_scrape_amelia_nonce_();
    if (is_wp_error($ctx)) {
        return $ctx;
    }

    $query = array_merge(['action' => 'wpamelia_api', 'call' => $call_path, 'wpAmeliaNonce' => $ctx['nonce']], $query_extra);
    $url = admin_url('admin-ajax.php') . '?' . http_build_query($query);

    $args = [
        'method' => $method,
        'cookies' => st_forward_cookies_(),
        'timeout' => 20,
    ];
    if ($body !== null) {
        $args['headers'] = ['Content-Type' => 'application/json'];
        $args['body'] = wp_json_encode($body);
    }

    $response = wp_remote_request($url, $args);
    if (is_wp_error($response)) {
        return $response;
    }

    return [
        'code' => wp_remote_retrieve_response_code($response),
        'data' => json_decode(wp_remote_retrieve_body($response), true),
    ];
}

/**
 * "Smart Freigeben" — Referenzdaten Stand 17.08.2026 (siehe README, Abschnitt
 * "Nächster Schritt: Smart Freigeben" für die Herkunft dieser Werte, per
 * "Referenz anzeigen"-Button im Dashboard geholt). Bei Personalwechseln oder
 * neuen Anfrage/Bestätigt-Service-Paaren hier UND in der README-Tabelle
 * aktualisieren.
 */

const ST_CAT_ANFRAGE = 8;
const ST_CAT_BESTAETIGT = 7;

/**
 * Findet zur aktuellen Dienstleistung das passende "(Bestätigt)"-Gegenstück
 * in Kategorie 7 — per Namens-/Dauer-Abgleich direkt in der DB statt über
 * eine feste ID-Tabelle. Grund: Der reale Dienstleistungskatalog hat pro
 * Basis-Service oft mehrere Varianten in verschiedenen Kategorien (z. B.
 * "Intuitive Tantramassage" separat für Männer/Frauen/Anfrage, alle mit
 * eigener Service-ID) — eine feste Tabelle mit nur den "(Anfrage)"-IDs
 * erfasst diese anderen Varianten nicht (siehe 17.08.2026: Termin mit
 * serviceId 13 — "Intuitive Tantramassage", Kategorie "Angebote für
 * Männer" — schlug fehl, weil nur ID 37 aus der "(Anfrage)"-Kategorie
 * bekannt war). Liefert null, wenn kein Gegenstück existiert (z. B. bei
 * Dienstleistungen ohne Bestätigt-Duplikat wie Bodyflow-Massage) — dann
 * lieber Fehler zeigen als raten.
 */
function st_confirmed_service_id_($wpdb, $prefix, $current_service_id) {
    $services_table = $prefix . 'amelia_services';
    $current = $wpdb->get_row($wpdb->prepare(
        "SELECT name, duration FROM {$services_table} WHERE id = %d",
        $current_service_id
    ));
    if (!$current) {
        return null;
    }
    if (stripos($current->name, '(bestätigt)') !== false) {
        return (int) $current_service_id;
    }

    $base_name = trim(preg_replace('/\s*\(anfrage\)\s*$/i', '', $current->name));
    $match = $wpdb->get_row($wpdb->prepare(
        "SELECT id FROM {$services_table} WHERE categoryId = %d AND duration = %d AND name = %s LIMIT 1",
        ST_CAT_BESTAETIGT,
        $current->duration,
        $base_name . ' (Bestätigt)'
    ));
    return $match ? (int) $match->id : null;
}

/**
 * Die drei Geschlechts-Pseudo-Mitarbeiter, die der Kunde tatsächlich im
 * Buchungsformular wählt (landet als providerId auf der Anfrage-Buchung).
 */
function st_gender_preference_($pseudo_provider_id) {
    $map = [38 => 'egal', 37 => 'maennlich', 36 => 'weiblich'];
    return isset($map[$pseudo_provider_id]) ? $map[$pseudo_provider_id] : null;
}

/**
 * Echte Mitarbeiter für die Anfrage-Zuweisung (alle außer Jörg & Eva, die
 * eigene feste Buchungswege haben, siehe apps-script/anfragen-verfuegbarkeit-
 * sync). Konstantin fehlt bewusst — taucht in Amelia (Stand 17.08.2026) nicht
 * auf; vor einer Erweiterung dieser Liste bei Jörg nachfragen, siehe README
 * "Offen".
 */
function st_real_providers_() {
    return [
        4  => ['name' => 'Tara',      'gender' => 'weiblich'],
        5  => ['name' => 'Asmita',    'gender' => 'weiblich'],
        6  => ['name' => 'Alea',      'gender' => 'weiblich'],
        7  => ['name' => 'Stephanie', 'gender' => 'weiblich'],
        8  => ['name' => 'Karen',     'gender' => 'weiblich'],
        9  => ['name' => 'Sarah',     'gender' => 'weiblich'],
        17 => ['name' => 'Maxine',    'gender' => 'weiblich'],
        28 => ['name' => 'Amila',     'gender' => 'weiblich'],
        29 => ['name' => 'Dominik',   'gender' => 'maennlich'],
        // Eva ist laut Jörg (23.08.2026) bewusst das Backup für "weiblich":
        // "immer verfügbar, solange irgendein Teammitglied da ist ODER Eva,
        // wenn sie nicht blockiert ist, mit ihrem eigenen Kalender" — deshalb
        // hier normaler Kandidat wie alle anderen, per eigener Amelia-ID
        // gegen ihren echten Kalender geprüft. Jörg selbst (ID 1) bleibt
        // bewusst NICHT im Pool — eigene Entscheidung vom 21.08.2026, er
        // will die männliche Lücke manuell/bewusst füllen statt automatisch.
        2  => ['name' => 'Eva',       'gender' => 'weiblich'],
    ];
}

/** Mitarbeiter, die zur Geschlechts-Präferenz passen ('egal' => alle). */
function st_candidate_providers_($gender_preference) {
    $out = [];
    foreach (st_real_providers_() as $id => $p) {
        if ($gender_preference === 'egal' || $p['gender'] === $gender_preference) {
            $out[$id] = $p['name'];
        }
    }
    return $out;
}

/**
 * Holt die für Zuweisung/Verfügbarkeitsprüfung nötigen Rohfelder EINER
 * Buchung direkt aus der DB — bewusst eine eigene, engere Abfrage statt die
 * booking-overview-Liste zu erweitern, damit interne Felder (customFields,
 * internalNotes, Coupon) nicht bei jedem Dashboard-Laden für alle sichtbaren
 * Buchungen mitgeschickt werden (siehe README, Abschnitt "Sicherheit").
 */
function st_fetch_appointment_raw_($wpdb, $prefix, $appointment_id) {
    $sql = "
        SELECT
            a.id AS appointment_id,
            a.bookingStart,
            a.bookingEnd,
            a.serviceId AS service_id,
            a.providerId AS provider_id,
            a.internalNotes AS internal_notes,
            a.locationId AS location_id,
            s.categoryId AS category_id,
            TIMESTAMPDIFF(SECOND, a.bookingStart, a.bookingEnd) AS duration_seconds,
            cb.id AS booking_id,
            cb.status AS booking_status,
            cb.customerId AS customer_id,
            cb.persons AS persons,
            cb.customFields AS custom_fields,
            cb.couponId AS coupon_id
        FROM {$prefix}amelia_appointments a
        LEFT JOIN {$prefix}amelia_customer_bookings cb
            ON cb.appointmentId = a.id AND cb.status != 'canceled'
        LEFT JOIN {$prefix}amelia_services s
            ON s.id = a.serviceId
        WHERE a.id = %d
        LIMIT 1
    ";
    return $wpdb->get_row($wpdb->prepare($sql, $appointment_id));
}

/**
 * Baut aus der DB-Zeile das komplette Termin-Objekt, das Amelias
 * "Aktualisieren"-Request erwartet (siehe README, Payload-Beispiel aus dem
 * DevTools-Mitschnitt vom 16.08.) — alle Felder außer categoryId/serviceId/
 * providerId kommen unverändert aus der DB.
 */
function st_build_reassign_payload_($row, $new_provider_id, $confirmed_service_id) {
    $custom_fields = new stdClass();
    if (!empty($row->custom_fields)) {
        $decoded = json_decode($row->custom_fields, true);
        if ($decoded !== null) {
            $custom_fields = $decoded;
        }
    }

    // row->bookingStart kommt roh aus der DB (UTC). Amelias eigenes
    // Bearbeiten-Formular zeigt und übernimmt Zeiten in Site-Zeitzone
    // (Berlin) — deshalb hier umrechnen, sonst würde die Zuweisung den
    // Termin unbemerkt um den UTC-Offset verschieben. ⚠️ Bei diesem Feld
    // (anders als bei den reinen Lesefeldern) noch nicht an einer echten
    // Buchung verifiziert — beim ersten Test genau prüfen, ob die Uhrzeit
    // in Amelia danach stimmt.
    $local_start = get_date_from_gmt($row->bookingStart);
    $parts = explode(' ', $local_start);
    $date = $parts[0];
    $time = isset($parts[1]) ? substr($parts[1], 0, 5) : '00:00';

    return [
        'bookings' => [[
            'coupon' => ['id' => $row->coupon_id !== null ? (int) $row->coupon_id : null],
            'customerId' => (int) $row->customer_id,
            'customFields' => $custom_fields,
            'duration' => (int) $row->duration_seconds,
            'extras' => [],
            'id' => (int) $row->booking_id,
            'packageCustomerService' => null,
            'persons' => (int) $row->persons,
            'status' => $row->booking_status ?: 'pending',
        ]],
        'bookingStart' => $local_start,
        'categoryId' => ST_CAT_BESTAETIGT,
        'date' => $date,
        'id' => (int) $row->appointment_id,
        'internalNotes' => $row->internal_notes ?: '',
        'lessonSpace' => false,
        'locationId' => $row->location_id !== null ? (int) $row->location_id : null,
        'notifyParticipants' => 1,
        'providerId' => (int) $new_provider_id,
        'recurring' => [],
        'removedBookings' => [],
        'serviceId' => (int) $confirmed_service_id,
        'time' => $time,
        'createPaymentLinks' => true,
    ];
}

/**
 * Baut das Termin-Objekt für die Rückrichtung Kalender → Amelia
 * (Terminverlegung durchs Team): categoryId/serviceId/providerId bleiben
 * unverändert aus der DB (es ändert sich nur die Zeit), im Unterschied zu
 * st_build_reassign_payload_(), wo umgekehrt providerId/categoryId/serviceId
 * geändert werden und die Zeit unverändert bleibt.
 */
function st_build_reschedule_payload_($row, $new_start_utc_mysql, $new_end_utc_mysql) {
    $custom_fields = new stdClass();
    if (!empty($row->custom_fields)) {
        $decoded = json_decode($row->custom_fields, true);
        if ($decoded !== null) {
            $custom_fields = $decoded;
        }
    }

    $duration_seconds = strtotime($new_end_utc_mysql) - strtotime($new_start_utc_mysql);

    $local_start = get_date_from_gmt($new_start_utc_mysql);
    $parts = explode(' ', $local_start);
    $date = $parts[0];
    $time = isset($parts[1]) ? substr($parts[1], 0, 5) : '00:00';

    return [
        'bookings' => [[
            'coupon' => ['id' => $row->coupon_id !== null ? (int) $row->coupon_id : null],
            'customerId' => (int) $row->customer_id,
            'customFields' => $custom_fields,
            'duration' => (int) $duration_seconds,
            'extras' => [],
            'id' => (int) $row->booking_id,
            'packageCustomerService' => null,
            'persons' => (int) $row->persons,
            'status' => $row->booking_status ?: 'pending',
        ]],
        'bookingStart' => $local_start,
        'categoryId' => $row->category_id !== null ? (int) $row->category_id : ST_CAT_BESTAETIGT,
        'date' => $date,
        'id' => (int) $row->appointment_id,
        'internalNotes' => $row->internal_notes ?: '',
        'lessonSpace' => false,
        'locationId' => $row->location_id !== null ? (int) $row->location_id : null,
        'notifyParticipants' => 1,
        'providerId' => (int) $row->provider_id,
        'recurring' => [],
        'removedBookings' => [],
        'serviceId' => (int) $row->service_id,
        'time' => $time,
        'createPaymentLinks' => true,
    ];
}

/**
 * Gemeinsames Passwort für die Rückrichtung Kalender → Amelia: Das Apps
 * Script, das einmal täglich prüft, was das Team im Raum-1-Kalender
 * verschoben hat, läuft serverseitig (kein Browser, keine WP-Login-Session,
 * daher kein current_user_can()-Check möglich) — Absicherung stattdessen per
 * gemeinsamem Geheimnis im Header "X-ST-Reschedule-Secret".
 *
 * ⚠️ WERT UNBEDINGT ÄNDERN, BEVOR DAS APPS SCRIPT LIVE GEHT. Auf beiden
 * Seiten identisch eintragen (hier UND in Code.gs bei WP_RESCHEDULE_SECRET).
 * Langer zufälliger String, z. B. per Passwort-Generator.
 */
define('ST_RESCHEDULE_SECRET', 'DEIN-ZUFAELLIGES-PASSWORT-HIER');

/**
 * st_amelia_ajax_call_() braucht eine eingeloggte WP-Session, um über
 * st_forward_cookies_() einen gültigen Amelia-Admin-Cookie zu erzeugen
 * (siehe dort) — bei /booking-reschedule gibt es aber keine Session (Apps
 * Script ruft ohne Browser-Login auf, nur mit dem Geheimnis oben). Deshalb
 * hier die Nutzer-ID eines echten WP-Admin-Accounts hinterlegen (z. B.
 * Jörgs eigener Account) — wp-admin → Benutzer → auf den Namen klicken →
 * die Zahl in der URL (user_id=...). Der Handler setzt darüber kurzzeitig
 * nur für diesen einen Request den "aktuellen Nutzer" (wp_set_current_user),
 * NICHT den globalen Login-Status — nach dem Request ist nichts verändert.
 */
define('ST_RESCHEDULE_ADMIN_USER_ID', 0);

add_action('rest_api_init', function () {
    $admin_only = function () {
        return current_user_can('manage_options');
    };

    // Für /booking-reschedule: kein WP-Login vorhanden (Apps Script ruft
    // server-zu-server auf), daher Prüfung per gemeinsamem Geheimnis statt
    // current_user_can(). hash_equals() gegen Timing-Angriffe.
    $reschedule_secret_ok = function (WP_REST_Request $request) {
        $given = $request->get_header('x-st-reschedule-secret');
        return is_string($given) && hash_equals(ST_RESCHEDULE_SECRET, $given);
    };

    register_rest_route('st/v1', '/booking-overview', [
        'methods' => 'GET',
        'callback' => 'st_booking_overview_handler',
        'permission_callback' => $admin_only,
    ]);

    register_rest_route('st/v1', '/booking-approve', [
        'methods' => 'POST',
        'callback' => 'st_booking_approve_handler',
        'permission_callback' => $admin_only,
    ]);

    // Smart Freigeben, Schritt 1: prüft, welche zur Geschlechts-Präferenz
    // passenden Mitarbeiter am Termin laut Amelias eigenem /slots-Endpunkt
    // frei sind. Rein lesend (fragt nur Amelia ab), daher GET — auch direkt
    // im Browser mit ?debug=1 aufrufbar, siehe Datei-Header.
    register_rest_route('st/v1', '/booking-availability', [
        'methods' => 'GET',
        'callback' => 'st_booking_availability_handler',
        'permission_callback' => $admin_only,
    ]);

    // Smart Freigeben, Schritt 2: weist eine Anfrage-Buchung einem echten
    // Mitarbeiter zu (Kategorie → Bestätigt, Service → passendes
    // (Bestätigt)-Duplikat, providerId → gewählter Mitarbeiter) über
    // denselben "Aktualisieren"-Request, den Amelias eigene Oberfläche
    // benutzt. Löst noch keine Freigabe aus — das Dashboard ruft danach
    // /booking-approve.
    register_rest_route('st/v1', '/booking-reassign', [
        'methods' => 'POST',
        'callback' => 'st_booking_reassign_handler',
        'permission_callback' => $admin_only,
    ]);

    // Liefert einen Ausschnitt der echten Amelia-Bookings-Seite (Kategorien/
    // Services/Mitarbeiter-Daten, die die Oberfläche für ihre eigenen
    // Dropdowns einbettet) — Zwischenschritt, um die Kategorie/Dienstleistung/
    // Mitarbeiter-ändern-Aktion sicher (ohne Rateschema) fertigzubauen.
    register_rest_route('st/v1', '/amelia-bootstrap-debug', [
        'methods' => 'GET',
        'callback' => 'st_amelia_bootstrap_debug_handler',
        'permission_callback' => $admin_only,
    ]);

    // Nur lesend: listet Kategorien, Dienstleistungen (mit Kategorie-ID) und
    // Mitarbeiter/Pseudo-Mitarbeiter mit ihren echten IDs auf. Grundlage für
    // die "Smart Freigeben"-Automatik (Kategorie/Dienstleistung/Mitarbeiter
    // anhand von Namensmustern statt geratener IDs zuordnen).
    register_rest_route('st/v1', '/amelia-reference', [
        'methods' => 'GET',
        'callback' => 'st_amelia_reference_handler',
        'permission_callback' => $admin_only,
    ]);

    // Rückrichtung Kalender/Team-App → Amelia: zwei Aufrufer.
    // (1) apps-script/raum-einladung-sync ruft einmal täglich auf, wenn es
    //     im Raum-1-Kalender eine vom Team verschobene Uhrzeit/Dauer
    //     erkennt.
    // (2) team-app/App Script ruft direkt auf, wenn ein Teammitglied in
    //     der Team-App selbst über "Termine → Ändern" Datum/Uhrzeit anpasst
    //     (seit 27.08.2026).
    // Trägt die neue Zeit über denselben "Aktualisieren"-Request ein, den
    // auch /booking-reassign benutzt — Mitarbeiter/Kategorie/Dienstleistung
    // bleiben dabei unverändert. Kein Freigabe-Schritt nötig (der Termin ist
    // ja schon "Bestätigt"), keine Doppelbuchungsprüfung (siehe README).
    register_rest_route('st/v1', '/booking-reschedule', [
        'methods' => 'POST',
        'callback' => 'st_booking_reschedule_handler',
        'permission_callback' => $reschedule_secret_ok,
    ]);
});

function st_booking_overview_handler(WP_REST_Request $request) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    if ($request->get_param('debug')) {
        return st_booking_overview_debug_($wpdb, $prefix);
    }

    $days = (int) $request->get_param('days');
    $days = $days > 0 ? min(90, $days) : 30;

    $sql = "
        SELECT
            a.id AS appointment_id,
            a.bookingStart,
            a.bookingEnd,
            a.status AS appointment_status,
            a.providerId AS provider_id,
            s.name AS service_name,
            CONCAT(p.firstName, ' ', p.lastName) AS employee_name,
            cb.id AS booking_id,
            cb.status AS booking_status,
            cb.price,
            CONCAT(c.firstName, ' ', c.lastName) AS customer_name,
            c.phone AS customer_phone,
            c.email AS customer_email
        FROM {$prefix}amelia_appointments a
        LEFT JOIN {$prefix}amelia_services s ON s.id = a.serviceId
        LEFT JOIN {$prefix}amelia_users p ON p.id = a.providerId
        LEFT JOIN {$prefix}amelia_customer_bookings cb ON cb.appointmentId = a.id
        LEFT JOIN {$prefix}amelia_users c ON c.id = cb.customerId
        WHERE a.bookingStart BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL %d DAY)
          AND (cb.status IS NULL OR cb.status != 'canceled')
        ORDER BY a.bookingStart ASC
    ";

    $rows = $wpdb->get_results($wpdb->prepare($sql, $days));

    if ($wpdb->last_error) {
        return new WP_REST_Response([
            'error' => 'db_error',
            'detail' => $wpdb->last_error,
            'hint' => 'Spaltennamen ggf. abweichend — GET .../booking-overview?debug=1 zum Prüfen der echten Tabellenstruktur aufrufen.',
        ], 500);
    }

    // Amelia speichert bookingStart/bookingEnd in UTC (wie WordPress selbst).
    // Ohne diese Umrechnung zeigt das Dashboard 2 Stunden früher an als
    // Amelias eigene Oberfläche (Berlin = UTC+2 im Sommer).
    foreach ($rows as $row) {
        $row->bookingStart = get_date_from_gmt($row->bookingStart);
        $row->bookingEnd = get_date_from_gmt($row->bookingEnd);
    }

    return new WP_REST_Response(['ok' => true, 'days' => $days, 'appointments' => $rows], 200);
}

function st_booking_overview_debug_($wpdb, $prefix) {
    $tables = ['amelia_appointments', 'amelia_customer_bookings', 'amelia_users', 'amelia_services'];
    $out = [];
    foreach ($tables as $t) {
        $full = $prefix . $t;
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $full));
        if (!$exists) {
            $out[$t] = 'Tabelle nicht gefunden: ' . $full;
            continue;
        }
        $out[$t] = $wpdb->get_col("SHOW COLUMNS FROM {$full}", 0);
    }
    return new WP_REST_Response(['ok' => true, 'tables' => $out], 200);
}

function st_booking_approve_handler(WP_REST_Request $request) {
    $id = (int) $request->get_param('appointmentId');
    if (!$id) {
        return new WP_REST_Response(['error' => 'missing_appointment_id'], 400);
    }

    $result = st_amelia_ajax_call_('POST', '/appointments/status/' . $id, [], ['status' => 'approved']);
    if (is_wp_error($result)) {
        return new WP_REST_Response(['error' => 'amelia_request_failed', 'detail' => $result->get_error_message(), 'debug' => $result->get_error_data()], 502);
    }

    return new WP_REST_Response(['ok' => true, 'amelia_response' => $result['data']], $result['code'] ?: 200);
}

function st_booking_availability_handler(WP_REST_Request $request) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    $appointment_id = (int) $request->get_param('appointmentId');
    if (!$appointment_id) {
        return new WP_REST_Response(['error' => 'missing_appointment_id'], 400);
    }

    $row = st_fetch_appointment_raw_($wpdb, $prefix, $appointment_id);
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'detail' => $wpdb->last_error], 500);
    }
    if (!$row) {
        return new WP_REST_Response(['error' => 'appointment_not_found'], 404);
    }

    $confirmed_service_id = st_confirmed_service_id_($wpdb, $prefix, (int) $row->service_id);
    if (!$confirmed_service_id) {
        return new WP_REST_Response(['error' => 'unknown_service_pairing', 'serviceId' => (int) $row->service_id], 422);
    }

    $gender = st_gender_preference_((int) $row->provider_id);
    if ($gender === null) {
        return new WP_REST_Response(['error' => 'unknown_gender_pseudo_provider', 'providerId' => (int) $row->provider_id], 422);
    }

    // Bewusst KEINE Verfügbarkeitsprüfung mehr gegen Amelias /slots-Endpunkt
    // (siehe README, "Vereinfacht 23.08.2026"): Der lieferte für jeden
    // Kandidaten dieselbe generische Antwort statt einer echten
    // personenbezogenen Prüfung, war dazu sehr langsam (9 sequenzielle
    // externe Requests bei "weiblich"/"egal") und hat bei einem echten Test
    // fälschlich alle 9 Frauen als frei gemeldet, obwohl nur 2 es wirklich
    // waren. Auf Jörgs eigenen Wunsch zeigt Smart Freigeben jetzt einfach
    // alle zur Geschlechts-Präferenz passenden Kandidat:innen zur Auswahl —
    // er wirft selbst kurz einen Blick in den Kalender und entscheidet.
    $matches = [];
    foreach (st_candidate_providers_($gender) as $provider_id => $name) {
        $matches[] = ['providerId' => $provider_id, 'name' => $name];
    }

    // row->bookingStart kommt roh aus der DB (UTC, wie Amelia intern
    // speichert) — für die Anzeige auf Site-Zeitzone (Berlin) umrechnen,
    // wie überall sonst im Dashboard.
    $local_start = get_date_from_gmt($row->bookingStart);
    $parts = explode(' ', $local_start);
    $date = $parts[0];
    $time = isset($parts[1]) ? substr($parts[1], 0, 5) : '00:00';

    return new WP_REST_Response([
        'ok' => true,
        'appointmentId' => $appointment_id,
        'date' => $date,
        'time' => $time,
        'gender' => $gender,
        'candidatesChecked' => count($matches),
        'matches' => $matches,
    ], 200);
}

function st_booking_reassign_handler(WP_REST_Request $request) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    $appointment_id = (int) $request->get_param('appointmentId');
    $new_provider_id = (int) $request->get_param('providerId');
    if (!$appointment_id || !$new_provider_id) {
        return new WP_REST_Response(['error' => 'missing_params'], 400);
    }

    $row = st_fetch_appointment_raw_($wpdb, $prefix, $appointment_id);
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'detail' => $wpdb->last_error], 500);
    }
    if (!$row) {
        return new WP_REST_Response(['error' => 'appointment_not_found'], 404);
    }

    $confirmed_service_id = st_confirmed_service_id_($wpdb, $prefix, (int) $row->service_id);
    if (!$confirmed_service_id) {
        return new WP_REST_Response(['error' => 'unknown_service_pairing', 'serviceId' => (int) $row->service_id], 422);
    }

    $payload = st_build_reassign_payload_($row, $new_provider_id, $confirmed_service_id);
    $result = st_amelia_ajax_call_('POST', '/appointments/' . $appointment_id, [], $payload);
    if (is_wp_error($result)) {
        return new WP_REST_Response(['error' => 'amelia_request_failed', 'detail' => $result->get_error_message(), 'debug' => $result->get_error_data()], 502);
    }

    return new WP_REST_Response(['ok' => true, 'amelia_response' => $result['data']], $result['code'] ?: 200);
}

/**
 * Rückrichtung Kalender → Amelia: trägt eine vom Team im Raum-1-Kalender
 * verschobene Uhrzeit/Dauer in Amelia ein. Erwartet newBookingStart/
 * newBookingEnd als UTC-MySQL-Strings ("YYYY-MM-DD HH:MM:SS"), damit hier
 * dieselbe get_date_from_gmt()-Umrechnung greift wie überall sonst in dieser
 * Datei — das Apps Script schickt also KEINE lokale Berliner Zeit, sondern
 * UTC (CalendarEvent.getStartTime() als ISO-String mit toISOString() bzw.
 * äquivalent, siehe Code.gs).
 */
function st_booking_reschedule_handler(WP_REST_Request $request) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    $appointment_id = (int) $request->get_param('appointmentId');
    $new_start = $request->get_param('newBookingStart');
    $new_end = $request->get_param('newBookingEnd');
    if (!$appointment_id || !$new_start || !$new_end) {
        return new WP_REST_Response(['error' => 'missing_params'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $new_start)
        || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $new_end)) {
        return new WP_REST_Response(['error' => 'invalid_datetime_format', 'expected' => 'YYYY-MM-DD HH:MM:SS (UTC)'], 400);
    }

    $row = st_fetch_appointment_raw_($wpdb, $prefix, $appointment_id);
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'detail' => $wpdb->last_error], 500);
    }
    if (!$row) {
        return new WP_REST_Response(['error' => 'appointment_not_found'], 404);
    }

    if (!ST_RESCHEDULE_ADMIN_USER_ID) {
        return new WP_REST_Response(['error' => 'not_configured', 'detail' => 'ST_RESCHEDULE_ADMIN_USER_ID ist noch nicht gesetzt (siehe Kommentar im Code).'], 500);
    }
    wp_set_current_user(ST_RESCHEDULE_ADMIN_USER_ID);

    $payload = st_build_reschedule_payload_($row, $new_start, $new_end);
    $result = st_amelia_ajax_call_('POST', '/appointments/' . $appointment_id, [], $payload);
    if (is_wp_error($result)) {
        return new WP_REST_Response(['error' => 'amelia_request_failed', 'detail' => $result->get_error_message(), 'debug' => $result->get_error_data()], 502);
    }

    return new WP_REST_Response(['ok' => true, 'amelia_response' => $result['data']], $result['code'] ?: 200);
}

function st_amelia_bootstrap_debug_handler(WP_REST_Request $request) {
    $ctx = st_scrape_amelia_nonce_();
    if (is_wp_error($ctx)) {
        return new WP_REST_Response(['error' => $ctx->get_error_message(), 'debug' => $ctx->get_error_data()], 502);
    }

    $html = $ctx['html'];
    return new WP_REST_Response([
        'ok' => true,
        'nonce_found' => $ctx['nonce'],
        'html_length' => strlen($html),
        'snippet_around_categories' => st_find_snippet_($html, 'categor'),
        'snippet_around_services' => st_find_snippet_($html, '"services"'),
        'snippet_around_providers' => st_find_snippet_($html, 'provider'),
    ], 200);
}

function st_amelia_reference_handler(WP_REST_Request $request) {
    global $wpdb;
    $prefix = $wpdb->prefix;

    $categories = $wpdb->get_results("SELECT id, name FROM {$prefix}amelia_categories ORDER BY name");
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'table' => 'amelia_categories', 'detail' => $wpdb->last_error], 500);
    }

    $services = $wpdb->get_results("SELECT id, name, categoryId, duration FROM {$prefix}amelia_services ORDER BY name");
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'table' => 'amelia_services', 'detail' => $wpdb->last_error], 500);
    }

    // amelia_users enthält Kunden UND Mitarbeiter/Pseudo-Mitarbeiter — über
    // 'type' eingrenzen (Amelia-Standardspalte). Falls die Spalte anders
    // heißt, zeigt der Fehlertext unten sofort, welche Tabelle betroffen ist.
    $providers = $wpdb->get_results("SELECT id, firstName, lastName, email FROM {$prefix}amelia_users WHERE type = 'provider' ORDER BY firstName");
    if ($wpdb->last_error) {
        return new WP_REST_Response(['error' => 'db_error', 'table' => 'amelia_users', 'detail' => $wpdb->last_error], 500);
    }

    return new WP_REST_Response([
        'ok' => true,
        'categories' => $categories,
        'services' => $services,
        'providers' => $providers,
    ], 200);
}

function st_find_snippet_($haystack, $needle, $context = 500) {
    $pos = stripos($haystack, $needle);
    if ($pos === false) {
        return null;
    }
    $start = max(0, $pos - 100);
    return substr($haystack, $start, $context);
}

add_shortcode('st_booking_dashboard', function () {
    if (!is_user_logged_in() || !current_user_can('manage_options')) {
        return '<p>Kein Zugriff. Bitte als Admin im wp-admin einloggen und diese Seite erneut aufrufen.</p>';
    }

    $nonce = wp_create_nonce('wp_rest');
    $endpoint = esc_url_raw(rest_url('st/v1/booking-overview'));
    $approve_endpoint = esc_url_raw(rest_url('st/v1/booking-approve'));
    $availability_endpoint = esc_url_raw(rest_url('st/v1/booking-availability'));
    $reassign_endpoint = esc_url_raw(rest_url('st/v1/booking-reassign'));
    $reference_endpoint = esc_url_raw(rest_url('st/v1/amelia-reference'));
    $bookings_admin_url = esc_url_raw(admin_url('admin.php?page=wpamelia-bookings'));

    ob_start();
    ?>
    <div id="st-bd" style="--st-sand:#F3ECE1;--st-card:#FBF7F0;--st-plum:#3E2A34;--st-soft:#6B5560;--st-clay:#B5654A;--st-clay-d:#9E5440;--st-line:#E4D9C8;--st-danger:#A24A3E;--st-sage:#7E8A6F;font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:16px;background:var(--st-sand);border-radius:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0;color:var(--st-plum);font-size:1.2rem;">Buchungen (nächste <span id="st-bd-days">90</span> Tage)</h2>
        <button id="st-bd-refresh" style="background:var(--st-clay);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:0.9rem;">Aktualisieren</button>
      </div>
      <a href="<?php echo $bookings_admin_url; ?>" target="_blank" rel="noopener" style="display:block;margin-bottom:14px;color:var(--st-clay-d);font-size:0.85rem;">→ Amelia-Buchungen im wp-admin öffnen (zum Freigeben/Ändern)</a>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="st-bd-filter-btn" data-filter="all" style="flex:1;background:var(--st-clay);color:#fff;border:none;border-radius:8px;padding:8px 6px;font-size:0.82rem;">Alle</button>
        <button class="st-bd-filter-btn" data-filter="anfrage" style="flex:1;background:var(--st-card);color:var(--st-plum);border:1px solid var(--st-line);border-radius:8px;padding:8px 6px;font-size:0.82rem;">Anfragen</button>
        <button class="st-bd-filter-btn" data-filter="bestaetigt" style="flex:1;background:var(--st-card);color:var(--st-plum);border:1px solid var(--st-line);border-radius:8px;padding:8px 6px;font-size:0.82rem;">Bestätigt</button>
      </div>
      <div id="st-bd-status" style="color:var(--st-soft);font-size:0.9rem;margin-bottom:10px;"></div>
      <div id="st-bd-list"></div>
      <hr style="border:none;border-top:1px solid var(--st-line);margin:18px 0 10px;">
      <button id="st-bd-reference" style="background:none;border:1px solid var(--st-line);color:var(--st-soft);border-radius:8px;padding:6px 12px;font-size:0.8rem;">Referenz anzeigen (Kategorien/Dienstleistungen/Mitarbeiter)</button>
      <pre id="st-bd-reference-out" style="display:none;white-space:pre-wrap;word-break:break-word;background:var(--st-card);border:1px solid var(--st-line);border-radius:8px;padding:10px;font-size:0.75rem;margin-top:8px;max-height:340px;overflow:auto;"></pre>

      <div style="text-align:center;color:var(--st-soft);font-size:0.7rem;margin-top:14px;">Version <?php echo esc_html(ST_BD_VERSION); ?></div>
    </div>
    <script>
    (function () {
      const endpoint = <?php echo wp_json_encode($endpoint); ?>;
      const approveEndpoint = <?php echo wp_json_encode($approve_endpoint); ?>;
      const availabilityEndpoint = <?php echo wp_json_encode($availability_endpoint); ?>;
      const reassignEndpoint = <?php echo wp_json_encode($reassign_endpoint); ?>;
      const referenceEndpoint = <?php echo wp_json_encode($reference_endpoint); ?>;
      const nonce = <?php echo wp_json_encode($nonce); ?>;
      const statusLabels = { pending: 'Ausstehend', approved: 'Freigegeben', canceled: 'Storniert', rejected: 'Abgelehnt', noshow: 'No-Show' };
      const statusColors = { pending: '#B5654A', approved: '#7E8A6F', canceled: '#999', rejected: '#A24A3E', noshow: '#A24A3E' };
      let allAppointments = [];
      let activeFilter = 'all';

      // "Anfrage" = noch auf einem der drei Geschlechts-Pseudo-Mitarbeiter
      // (36/37/38, siehe README) hängend, "Bestätigt" = schon auf einen
      // echten Mitarbeiter umgehängt. Ursprünglich wurde das am Namenszusatz
      // "(bestätigt)" im Service erkannt — das hat aber nur die vier
      // extra angelegten Anfrage/Bestätigt-Servicepaare erfasst und normale
      // Dienstleistungen ohne diesen Namenszusatz (z. B. "Körperarbeit",
      // direkt mit einem echten Mitarbeiter gebucht) fälschlich als
      // "Anfrage" markiert (gefunden 23.08.2026 am Anfragen/Bestätigt-
      // Filter). Die providerId ist zuverlässiger, weil sie unabhängig vom
      // jeweiligen Servicenamen ist.
      var PSEUDO_PROVIDER_IDS = [36, 37, 38];
      function isConfirmed(a) {
        return PSEUDO_PROVIDER_IDS.indexOf(Number(a.provider_id)) === -1;
      }

      function fmtDate(iso) {
        if (!iso) return '–';
        const d = new Date(iso.replace(' ', 'T'));
        return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      }

      function applyFilter(appointments) {
        if (activeFilter === 'anfrage') return appointments.filter(function (a) { return !isConfirmed(a); });
        if (activeFilter === 'bestaetigt') return appointments.filter(isConfirmed);
        return appointments;
      }

      function updateFilterButtons() {
        document.querySelectorAll('.st-bd-filter-btn').forEach(function (btn) {
          const active = btn.getAttribute('data-filter') === activeFilter;
          btn.style.background = active ? 'var(--st-clay)' : 'var(--st-card)';
          btn.style.color = active ? '#fff' : 'var(--st-plum)';
        });
      }

      function render(appointments) {
        const list = document.getElementById('st-bd-list');
        const statusEl = document.getElementById('st-bd-status');
        const filtered = applyFilter(appointments);
        if (!filtered.length) {
          list.innerHTML = '';
          statusEl.textContent = 'Keine Buchungen in diesem Zeitraum/Filter.';
          return;
        }
        statusEl.textContent = filtered.length + ' Buchung(en)';
        list.innerHTML = filtered.map(function (a) {
          const st = a.booking_status || a.appointment_status || 'pending';
          const color = statusColors[st] || '#999';
          const label = statusLabels[st] || st;
          const kind = isConfirmed(a) ? 'Bestätigt' : 'Anfrage';
          const kindColor = isConfirmed(a) ? 'var(--st-sage)' : 'var(--st-clay-d)';
          const approveBtn = st === 'pending'
            ? '<button class="st-bd-approve-btn" data-appointment-id="' + a.appointment_id + '" style="margin-top:8px;background:var(--st-sage);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:0.82rem;">Freigeben</button>'
            : '';
          return '' +
            '<div style="background:var(--st-card);border:1px solid var(--st-line);border-left:4px solid ' + color + ';border-radius:8px;padding:10px 12px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
                '<strong style="color:var(--st-plum);">' + fmtDate(a.bookingStart) + '</strong>' +
                '<span style="color:' + color + ';font-size:0.8rem;font-weight:600;" data-status-for="' + a.appointment_id + '">' + label + '</span>' +
              '</div>' +
              '<div style="color:var(--st-plum);margin-top:4px;">' + (a.service_name || 'Unbekannter Service') + ' — ' + (a.employee_name || '–') + '</div>' +
              '<div style="color:var(--st-soft);font-size:0.85rem;margin-top:2px;">' + (a.customer_name || '–') + (a.customer_phone ? ' · ' + a.customer_phone : '') + '</div>' +
              '<div style="color:' + kindColor + ';font-size:0.75rem;margin-top:4px;font-weight:600;">' + kind + '</div>' +
              approveBtn +
            '</div>';
        }).join('');

        list.querySelectorAll('.st-bd-approve-btn').forEach(function (btn) {
          btn.addEventListener('click', function () { approveBooking(btn); });
        });
      }

      function findAppointment(id) {
        return allAppointments.filter(function (a) { return String(a.appointment_id) === String(id); })[0];
      }

      // Anfrage-Buchung: erst Verfügbarkeit prüfen (Smart Freigeben).
      // Bereits Bestätigt (nur noch pending wegen Zahlung o.ä.): direkt
      // freigeben wie bisher.
      function approveBooking(btn) {
        const id = btn.getAttribute('data-appointment-id');
        const appt = findAppointment(id);
        if (appt && !isConfirmed(appt)) {
          smartApprove(btn, id);
        } else {
          plainApprove(btn, id);
        }
      }

      function plainApprove(btn, id) {
        if (!confirm('Termin #' + id + ' wirklich freigeben? Löst die Bestätigungsmail an den Kunden aus.')) {
          return;
        }
        btn.disabled = true;
        doApprove(btn, id, 'Freigeben');
      }

      function smartApprove(btn, id) {
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Lade Kandidat:innen…';
        fetch(availabilityEndpoint + '?appointmentId=' + encodeURIComponent(id), { headers: { 'X-WP-Nonce': nonce } })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok || result.data.error) {
              alert('Fehler beim Laden der Kandidat:innen: ' + (result.data.detail || result.data.error || 'unbekannt'));
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            const matches = result.data.matches || [];
            if (matches.length === 0) {
              alert('Keine passenden Mitarbeiter:innen gefunden. Bitte manuell in Amelia zuweisen.');
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            // Immer auswählen lassen (auch bei nur einer Person) — kein
            // automatischer Verfügbarkeits-Check mehr, siehe Datei-Header
            // "SMART FREIGEBEN". Jörg schaut selbst kurz in den Kalender.
            showCandidatePicker(btn, id, matches, originalText);
          })
          .catch(function (err) {
            alert('Verbindungsfehler: ' + err);
            btn.disabled = false;
            btn.textContent = originalText;
          });
      }

      function showCandidatePicker(btn, id, matches, originalText) {
        btn.disabled = false;
        btn.textContent = originalText;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#FBF7F0;border-radius:12px;padding:16px;max-width:320px;width:100%;';
        const title = document.createElement('div');
        title.style.cssText = 'color:#3E2A34;font-weight:600;margin-bottom:10px;';
        title.textContent = 'Wer übernimmt Termin #' + id + '?';
        box.appendChild(title);

        matches.forEach(function (m) {
          const optBtn = document.createElement('button');
          optBtn.type = 'button';
          optBtn.textContent = m.name;
          optBtn.style.cssText = 'display:block;width:100%;text-align:left;background:#7E8A6F;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:6px;font-size:0.9rem;';
          optBtn.addEventListener('click', function () {
            document.body.removeChild(overlay);
            reassignAndApprove(btn, id, m, originalText);
          });
          box.appendChild(optBtn);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.style.cssText = 'display:block;width:100%;text-align:center;background:none;border:1px solid #E4D9C8;color:#6B5560;border-radius:8px;padding:8px 12px;margin-top:4px;font-size:0.85rem;';
        cancelBtn.addEventListener('click', function () { document.body.removeChild(overlay); });
        box.appendChild(cancelBtn);

        overlay.appendChild(box);
        document.body.appendChild(overlay);
      }

      function reassignAndApprove(btn, id, candidate, originalText) {
        if (!confirm('Termin #' + id + ' an ' + candidate.name + ' zuweisen und freigeben? Löst die Bestätigungsmail an den Kunden aus.')) {
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Weise zu…';
        fetch(reassignEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
          body: JSON.stringify({ appointmentId: id, providerId: candidate.providerId }),
        })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok || result.data.error) {
              alert('Fehler bei der Zuweisung: ' + (result.data.detail || result.data.error || 'unbekannt'));
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            doApprove(btn, id, originalText);
          })
          .catch(function (err) {
            alert('Verbindungsfehler bei der Zuweisung: ' + err);
            btn.disabled = false;
            btn.textContent = originalText;
          });
      }

      function doApprove(btn, id, originalText) {
        btn.textContent = 'Wird freigegeben…';
        fetch(approveEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
          body: JSON.stringify({ appointmentId: id }),
        })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok || result.data.error) {
              alert('Fehler beim Freigeben: ' + (result.data.detail || result.data.error || 'unbekannt'));
              btn.disabled = false;
              btn.textContent = originalText || 'Freigeben';
              return;
            }
            load();
          })
          .catch(function (err) {
            alert('Verbindungsfehler: ' + err);
            btn.disabled = false;
            btn.textContent = originalText || 'Freigeben';
          });
      }

      function load() {
        document.getElementById('st-bd-status').textContent = 'Lädt…';
        fetch(endpoint + '?days=90', { headers: { 'X-WP-Nonce': nonce } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              document.getElementById('st-bd-status').textContent = 'Fehler: ' + (data.detail || data.error);
              return;
            }
            if (data.days) {
              document.getElementById('st-bd-days').textContent = data.days;
            }
            allAppointments = data.appointments || [];
            render(allAppointments);
          })
          .catch(function (err) {
            document.getElementById('st-bd-status').textContent = 'Verbindungsfehler: ' + err;
          });
      }

      document.querySelectorAll('.st-bd-filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeFilter = btn.getAttribute('data-filter');
          updateFilterButtons();
          render(allAppointments);
        });
      });

      document.getElementById('st-bd-refresh').addEventListener('click', load);

      document.getElementById('st-bd-reference').addEventListener('click', function () {
        const out = document.getElementById('st-bd-reference-out');
        out.style.display = 'block';
        out.textContent = 'Lädt…';
        fetch(referenceEndpoint, { headers: { 'X-WP-Nonce': nonce } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              out.textContent = 'Fehler (' + (data.table || '?') + '): ' + (data.detail || data.error);
              return;
            }
            let text = 'KATEGORIEN\n';
            data.categories.forEach(function (c) { text += c.id + '  ' + c.name + '\n'; });
            text += '\nDIENSTLEISTUNGEN\n';
            data.services.forEach(function (s) { text += s.id + '  ' + s.name + '  (Kategorie ' + s.categoryId + ', ' + s.duration + 's)\n'; });
            text += '\nMITARBEITER\n';
            data.providers.forEach(function (p) { text += p.id + '  ' + p.firstName + ' ' + p.lastName + '  ' + p.email + '\n'; });
            out.textContent = text;
          })
          .catch(function (err) {
            out.textContent = 'Verbindungsfehler: ' + err;
          });
      });

      load();
    })();
    </script>
    <?php
    return ob_get_clean();
});
