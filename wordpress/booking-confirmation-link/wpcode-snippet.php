<?php
/**
 * Ein-Klick-Terminbestätigung (Kunde klickt Link in der Mail)
 *
 * Ursprünglich mit Gemini gebaut (16./17.08.2026), hier repariert und
 * gehärtet. Ablauf beim Klick auf .../danke-bestaetigt/?confirm_booking={id}:
 *   1. Status in Amelia (appointments + customer_bookings) auf "approved"
 *      setzen (rohes SQL-UPDATE — siehe Hinweis unten, warum das hier
 *      bewusst so bleibt statt auf den echten Amelia-Endpunkt umzustellen).
 *   2. Termindaten aus der DB laden (Kunde, Mitarbeiter, Service, Preis).
 *   3. Google Apps Script antriggern, um den Termin in den Raumkalender
 *      einzutragen.
 *   4. ICS-Datei on-the-fly bauen.
 *   5. Bestätigungsmail (HTML, mit ICS-Anhang, BCC an die Praxis) senden.
 *   6. Kunde auf die Dankeseite weiterleiten.
 *
 * ÄNDERUNGEN GEGENÜBER DER GEMINI-VERSION (17.08.2026):
 *
 * A) Kalender-Sync-Bug behoben: `wp_remote_get(..., ['blocking' => false])`
 *    ließ WordPress NICHT auf die Antwort warten und brach die Verbindung
 *    intern fast sofort ab — der Request kam bei Google mit hoher
 *    Wahrscheinlichkeit nie vollständig an (HTTPS-Handshake zu
 *    script.google.com braucht länger als das interne Mini-Timeout von
 *    `blocking => false`). Jetzt: `blocking` entfernt (= wartet), Ergebnis
 *    wird per `error_log()` sichtbar gemacht statt lautlos zu verschwinden.
 *
 * B) Leichte Kunden-Verifizierung ergänzt (siehe Abschnitt "1b." unten,
 *    standardmäßig AUS): Der Link `?confirm_booking={id}` allein hatte
 *    keinerlei Absicherung — jeder, der eine (niedrige, fortlaufende)
 *    Termin-ID errät, hätte fremde Termine freigeben können. Um das ohne
 *    zweiten Code-Ort zu schließen, unterstützt dieses Snippet jetzt
 *    zusätzlich einen `&email=...`-Parameter, der mit der hinterlegten
 *    Kunden-Mail abgeglichen wird. AKTIVIEREN in zwei Schritten:
 *      1. In Amelia bei der Vorlage/Mail, die diesen Link enthält, den Link
 *         um `&email=%customer_email%` ergänzen (reine Textänderung an der
 *         bestehenden Stelle, kein Code).
 *      2. Unten `REQUIRE_EMAIL_MATCH` von `false` auf `true` setzen.
 *    Bis dahin läuft alles wie bisher, nur mit einem Log-Eintrag, falls die
 *    Mail doch mitgeschickt aber falsch ist.
 *
 * Alles andere (Mail-Text, ICS-Aufbau, Ablauf) unverändert übernommen.
 *
 * WARUM WEITERHIN ROHES SQL-UPDATE STATT AMELIA-ENDPUNKT:
 * Es gibt einen sichereren Weg (denselben, den das Freigeben im
 * Buchungs-Dashboard nutzt: Amelias eigenen internen Endpunkt aufrufen,
 * damit native Mail/Kalender-Sync/Webhooks korrekt mitlaufen). Der
 * Unterschied hier: dieser Code läuft, wenn der KUNDE klickt — ganz ohne
 * eingeloggte Admin-Session, die für den echten Endpunkt nötig wäre. Das
 * lässt sich lösen (Server erzeugt sich serverseitig eine kurzlebige
 * Admin-Session für genau diesen einen Aufruf), ist aber ein separater,
 * größerer Umbau. Deshalb bewusst erstmal nicht angefasst — aktuell reicht
 * es, den bestehenden Ansatz lauffähig zu machen. Bei Bedarf später.
 */

define('ST_CONFIRM_REQUIRE_EMAIL_MATCH', false); // siehe Abschnitt B oben

add_action('init', 'custom_amelia_one_click_approval');
function custom_amelia_one_click_approval() {
    if (!isset($_GET['confirm_booking']) || empty($_GET['confirm_booking'])) {
        return;
    }

    global $wpdb;
    $id = intval($_GET['confirm_booking']);

    if ($id <= 0) {
        return;
    }

    $table_bookings     = $wpdb->prefix . 'amelia_customer_bookings';
    $table_appointments = $wpdb->prefix . 'amelia_appointments';
    $table_users        = $wpdb->prefix . 'amelia_users';
    $table_services      = $wpdb->prefix . 'amelia_services';

    // 1a. Termindaten VOR dem Status-Update laden (damit die optionale
    // E-Mail-Prüfung unten stattfinden kann, bevor irgendetwas verändert wird).
    $query = "SELECT
        a.bookingStart AS appointmentStart,
        a.bookingEnd AS appointmentEnd,
        b.price AS booking_price,
        c.email AS customer_email,
        c.firstName AS customer_firstName,
        c.lastName AS customer_lastName,
        p.firstName AS provider_firstName,
        s.name AS service_name,
        s.duration AS service_duration
    FROM {$table_appointments} a
    LEFT JOIN {$table_bookings} b ON b.appointmentId = a.id
    LEFT JOIN {$table_users} c ON c.id = b.customerId
    LEFT JOIN {$table_users} p ON p.id = a.providerId
    LEFT JOIN {$table_services} s ON s.id = a.serviceId
    WHERE a.id = %d LIMIT 1";

    $row = $wpdb->get_row($wpdb->prepare($query, $id));

    if (!$row) {
        wp_redirect('https://spiritual-touch.de/danke-bestaetigt/');
        exit;
    }

    // 1b. Optionale Verifizierung (siehe Abschnitt B im Kommentar oben).
    if (ST_CONFIRM_REQUIRE_EMAIL_MATCH) {
        $given_email = isset($_GET['email']) ? sanitize_email(wp_unslash($_GET['email'])) : '';
        if (empty($given_email) || strcasecmp($given_email, (string) $row->customer_email) !== 0) {
            error_log('ST Terminbestätigung: E-Mail-Prüfung fehlgeschlagen für Termin ' . $id);
            wp_die('Dieser Bestätigungslink ist ungültig oder abgelaufen. Bitte melde Dich bei uns: info@spiritual-touch.de');
        }
    } elseif (isset($_GET['email']) && strcasecmp(sanitize_email(wp_unslash($_GET['email'])), (string) $row->customer_email) !== 0) {
        // Mail-Parameter ist schon dabei, aber falsch — nur loggen, noch nicht blockieren,
        // solange ST_CONFIRM_REQUIRE_EMAIL_MATCH auf false steht.
        error_log('ST Terminbestätigung: E-Mail-Parameter vorhanden aber falsch für Termin ' . $id . ' (Prüfung noch nicht aktiv).');
    }

    // 2. Status jetzt auf 'approved' setzen.
    $wpdb->update($table_appointments, array('status' => 'approved'), array('id' => $id));
    $wpdb->update($table_bookings, array('status' => 'approved'), array('appointmentId' => $id));

    // 3. Google Raumkalender triggern.
    // ---> HIER DEINE NEUE GOOGLE WEB APP URL REIN <---
    $google_url = 'DEINE_NEUE_GOOGLE_URL_HIER';

    $query_args = array(
        'start'    => str_replace(' ', 'T', $row->appointmentStart),
        'end'      => str_replace(' ', 'T', $row->appointmentEnd),
        'customer' => $row->customer_firstName . ' ' . $row->customer_lastName,
        'provider' => $row->provider_firstName,
        'service'  => $row->service_name,
    );
    $request_url = add_query_arg($query_args, $google_url);

    // GEÄNDERT (A): kein 'blocking' => false mehr, Ergebnis wird geloggt statt verworfen.
    $calendar_response = wp_remote_get($request_url, array('timeout' => 20));
    if (is_wp_error($calendar_response)) {
        error_log('ST Raumkalender-Sync fehlgeschlagen (Termin ' . $id . '): ' . $calendar_response->get_error_message());
    } else {
        error_log('ST Raumkalender-Sync Antwort (Termin ' . $id . '): ' . wp_remote_retrieve_response_code($calendar_response) . ' — ' . wp_remote_retrieve_body($calendar_response));
    }

    // 4. ICS-Datei on-the-fly generieren.
    $start_time = date('Ymd\THis', strtotime($row->appointmentStart));
    $end_time = date('Ymd\THis', strtotime($row->appointmentEnd));
    $ics_content = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Spiritual Touch//DE\nBEGIN:VEVENT\n";
    $ics_content .= "DTSTART;TZID=Europe/Berlin:" . $start_time . "\n";
    $ics_content .= "DTEND;TZID=Europe/Berlin:" . $end_time . "\n";
    $ics_content .= "SUMMARY:Spiritual Touch | " . $row->service_name . "\n";
    $ics_content .= "LOCATION:Spiritual Touch Praxis\n";
    $ics_content .= "END:VEVENT\nEND:VCALENDAR";

    $upload_dir = wp_upload_dir();
    $ics_file = $upload_dir['basedir'] . '/termin_spiritual_touch.ics';
    file_put_contents($ics_file, $ics_content);

    // 5. Perfekte HTML-Mail mit BCC & Bild senden.
    if (!empty($row->customer_email)) {
        $date_str = date_i18n('d. F Y', strtotime($row->appointmentStart));
        $time_str = date_i18n('H:i', strtotime($row->appointmentStart));
        $price_str = '€' . number_format((float) $row->booking_price, 2, '.', '');
        $duration_minutes = intval($row->service_duration) / 60;
        $hours = floor($duration_minutes / 60);
        $mins = $duration_minutes % 60;
        $duration_str = ($hours > 0 ? $hours . 'h ' : '') . ($mins > 0 ? $mins . 'min' : '');

        // ---> BILD-LINK FÜR DEINE SIGNATUR ANPASSEN <---
        $logo_url = 'https://spiritual-touch.de/wp-content/uploads/DEIN_LOGO.png';

        $subject = "Terminbestätigung: Dein Termin bei Spiritual Touch";

        $html = '<html><body style="font-family: sans-serif; color: #0f1b2a; line-height: 1.5;">';
        $html .= '<p>Hallo ' . esc_html($row->customer_firstName) . ',</p>';
        $html .= '<p>gerne bestätigen wir Deinen Termin:<br>';
        $html .= 'Datum: <strong>' . $date_str . '</strong> um <strong>' . $time_str . ' Uhr</strong><br>';
        $html .= 'Begleitung: <strong>' . esc_html($row->provider_firstName) . '</strong><br>';
        $html .= 'Dauer: <strong>' . $duration_str . '</strong><br>';
        $html .= 'Honorar: <strong>' . $price_str . '</strong></p>';
        $html .= '<p>Deine Begleitung wird Dich in Kürze kontaktieren und die letzten Details mit Dir abstimmen.</p>';
        $html .= '<p><strong>Für ein wirklich schönes Erlebnis möchten wir Dir noch ein paar Hinweise mitgeben:</strong><br>';
        $html .= '<strong>1.</strong> Bitte gestalte Deine Anreise entspannt und sei pünktlich vor Ort.<br>';
        $html .= '<strong>2.</strong> Zusätzlich zur Massagezeit plane bitte zusätzlich 30-45 Minuten für Vor- & Nachgespräch, Duschen, Nachruhe-Zeit etc. ein. So kommst Du am Ende nicht unter Zeitdruck.<br>';
        $html .= '<strong>3.</strong> Details zur Bezahlung wird Dir Deine Begleitung mitteilen. Barzahlung ist am einfachsten, bei einzelnen Begleitern ist auch Paypal oder Karten-Zahlung möglich (gegen Gebühr). Bei einzelnen BegleiterInnen ist auch eine Anzahlung nötig.</p>';
        $html .= '<p>Sollte etwas Unvorhergesehenes passieren und Du kannst den Termin nicht wahrnehmen, informiere uns bitte möglichst zeitnah. Innerhalb von 24 Stunden ist eine kostenfreie Stornierung nicht mehr möglich. Die Praxis erreichst Du unter +4915781504469 auch per Whatsapp.</p>';
        $html .= '<p>Wir wünschen Dir eine wunderbare Erfahrung bei uns!</p>';
        $html .= '<p>Jörg & Eva</p>';
        $html .= '<p><strong>Institutsleitung</strong><br><em>Spiritual Touch</em><br><a href="https://spiritual-touch.de">spiritual-touch.de</a></p>';
        $html .= '<p><img src="' . $logo_url . '" alt="Spiritual Touch Logo" style="max-width:200px; height:auto;"></p>';
        $html .= '</body></html>';

        // Mail-Kopfzeilen inkl. CC/BCC an dich.
        $headers = array();
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $headers[] = 'From: Institut "Spiritual Touch" <info@spiritual-touch.de>';
        $headers[] = 'Bcc: anfragen+copy@spiritual-touch.de';

        // Mail MIT ICS-Anhang versenden.
        $sent = wp_mail($row->customer_email, $subject, $html, $headers, array($ics_file));
        if (!$sent) {
            error_log('ST Terminbestätigung: wp_mail() fehlgeschlagen für Termin ' . $id . ' (' . $row->customer_email . ')');
        }
    }

    // ICS-Datei vom Server löschen, nachdem sie gesendet wurde.
    if (file_exists($ics_file)) {
        unlink($ics_file);
    }

    wp_redirect('https://spiritual-touch.de/danke-bestaetigt/');
    exit;
}
