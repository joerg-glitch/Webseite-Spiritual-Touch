<?php
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
 * Freigeben" für Herkunft/Referenzdaten): Bei einer Anfrage-Buchung prüft
 * "Freigeben" zuerst per Amelias eigenem /slots-Endpunkt, welche zur
 * Geschlechts-Präferenz passenden Mitarbeiter am Termin frei sind, und
 * übernimmt bei genau einem Treffer automatisch Zuweisung + Freigabe (Route
 * /booking-reassign, dann die bestehende /booking-approve). Bei mehreren
 * Treffern wählt das Dashboard-UI aus, bei null Treffern passiert nichts.
 * ⚠️ Das genaue Antwortformat von /slots ist NICHT aus einem echten
 * DevTools-Mitschnitt übernommen (der lag beim Schreiben dieses Codes nicht
 * vor) — vor dem produktiven Vertrauen auf die Automatik einmal
 * GET .../booking-availability?appointmentId=<echte Anfrage-ID>&debug=1
 * aufrufen und die rohe Amelia-Antwort mit dem, was st_slots_contains_time_
 * daraus liest, abgleichen. Genau dasselbe Kalibrierungs-Vorgehen wie beim
 * SQL-Schema (?debug=1) und beim Nonce-Scraping (amelia-bootstrap-debug).
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
        return new WP_Error('nonce_not_found', 'Amelia-Nonce nicht auf der Bookings-Seite gefunden.');
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

/** Anfrage-Service-ID => Bestätigt-Service-ID (gleiche Dauer in beiden). */
function st_confirmed_service_id_($anfrage_service_id) {
    $map = [37 => 33, 39 => 35, 38 => 34, 40 => 36];
    return isset($map[$anfrage_service_id]) ? $map[$anfrage_service_id] : null;
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

    $parts = explode(' ', $row->bookingStart);
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
        'bookingStart' => $row->bookingStart,
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
 * Sucht in der decodierten /slots-Antwort rekursiv nach der exakten Uhrzeit
 * des Termins ("HH:MM" als Teilstring irgendeines String-Werts). Bewusst
 * unspezifisch gegenüber der genauen Verschachtelung, weil das reale
 * Antwortformat noch nicht kalibriert ist — siehe Kalibrierungshinweis oben
 * im Datei-Header und ?debug=1 an /booking-availability.
 */
function st_slots_contains_time_($data, $time) {
    if (is_string($data)) {
        return strpos($data, $time) !== false;
    }
    if (is_array($data)) {
        foreach ($data as $v) {
            if (st_slots_contains_time_($v, $time)) {
                return true;
            }
        }
    }
    return false;
}

add_action('rest_api_init', function () {
    $admin_only = function () {
        return current_user_can('manage_options');
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
        return new WP_REST_Response(['error' => 'amelia_request_failed', 'detail' => $result->get_error_message()], 502);
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

    $confirmed_service_id = st_confirmed_service_id_((int) $row->service_id);
    if (!$confirmed_service_id) {
        return new WP_REST_Response(['error' => 'unknown_service_pairing', 'serviceId' => (int) $row->service_id], 422);
    }

    $gender = st_gender_preference_((int) $row->provider_id);
    if ($gender === null) {
        return new WP_REST_Response(['error' => 'unknown_gender_pseudo_provider', 'providerId' => (int) $row->provider_id], 422);
    }

    $candidates = st_candidate_providers_($gender);
    $debug = (bool) $request->get_param('debug');

    $parts = explode(' ', $row->bookingStart);
    $date = $parts[0];
    $time = isset($parts[1]) ? substr($parts[1], 0, 5) : '00:00';

    $matches = [];
    $raw_per_candidate = [];

    foreach ($candidates as $provider_id => $name) {
        $query = [
            'serviceId' => $confirmed_service_id,
            'providerIds' => [$provider_id],
            'serviceDuration' => (int) $row->duration_seconds,
            'dates' => [$date],
        ];
        $result = st_amelia_ajax_call_('GET', '/slots', $query);
        if (is_wp_error($result)) {
            $raw_per_candidate[$provider_id] = ['error' => $result->get_error_message()];
            continue;
        }
        if ($debug) {
            $raw_per_candidate[$provider_id] = $result['data'];
        }
        if (st_slots_contains_time_($result['data'], $time)) {
            $matches[] = ['providerId' => $provider_id, 'name' => $name];
        }
    }

    $response = [
        'ok' => true,
        'appointmentId' => $appointment_id,
        'date' => $date,
        'time' => $time,
        'gender' => $gender,
        'candidatesChecked' => count($candidates),
        'matches' => $matches,
    ];
    if ($debug) {
        $response['raw'] = $raw_per_candidate;
    }
    return new WP_REST_Response($response, 200);
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

    $confirmed_service_id = st_confirmed_service_id_((int) $row->service_id);
    if (!$confirmed_service_id) {
        return new WP_REST_Response(['error' => 'unknown_service_pairing', 'serviceId' => (int) $row->service_id], 422);
    }

    $payload = st_build_reassign_payload_($row, $new_provider_id, $confirmed_service_id);
    $result = st_amelia_ajax_call_('POST', '/appointments/' . $appointment_id, [], $payload);
    if (is_wp_error($result)) {
        return new WP_REST_Response(['error' => 'amelia_request_failed', 'detail' => $result->get_error_message()], 502);
    }

    return new WP_REST_Response(['ok' => true, 'amelia_response' => $result['data']], $result['code'] ?: 200);
}

function st_amelia_bootstrap_debug_handler(WP_REST_Request $request) {
    $ctx = st_scrape_amelia_nonce_();
    if (is_wp_error($ctx)) {
        return new WP_REST_Response(['error' => $ctx->get_error_message()], 502);
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

      // "Anfrage" = noch beim Platzhalter-Service, "Bestätigt" = auf das
      // "(bestätigt)"-Duplikat mit echtem Mitarbeiter umgehängt (siehe Jörgs
      // Kategorie-Mechanik: versteckte Kategorie "Bestätigt" mit einem
      // "(bestätigt)"-Duplikat pro Dienstleistung, allen Mitarbeitern zugeordnet).
      function isConfirmed(a) {
        return (a.service_name || '').toLowerCase().indexOf('(bestätigt)') !== -1;
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
        btn.textContent = 'Prüfe Verfügbarkeit…';
        fetch(availabilityEndpoint + '?appointmentId=' + encodeURIComponent(id), { headers: { 'X-WP-Nonce': nonce } })
          .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok || result.data.error) {
              alert('Fehler bei der Verfügbarkeitsprüfung: ' + (result.data.detail || result.data.error || 'unbekannt'));
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            const matches = result.data.matches || [];
            if (matches.length === 0) {
              alert('Niemand Passendes frei am ' + result.data.date + ' um ' + result.data.time + ' Uhr. Bitte manuell in Amelia zuweisen.');
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            if (matches.length === 1) {
              reassignAndApprove(btn, id, matches[0], originalText);
              return;
            }
            showCandidatePicker(btn, id, matches, originalText);
          })
          .catch(function (err) {
            alert('Verbindungsfehler bei der Verfügbarkeitsprüfung: ' + err);
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
