<?php
/**
 * ST AMELIA-LOGIN-BRIDGE
 * ========================================
 * WPCode-Snippet (Typ: PHP Snippet, "Run everywhere" oder "Only in admin
 * area" NICHT wählen — muss auch auf der Website-Vorderseite laufen, weil
 * die Team-App als Elementor-Widget dort eingebettet ist).
 *
 * ZWECK:
 * Erlaubt einem Teammitglied, sich per Team-App-PIN in seinen eigenen
 * Amelia-Mitarbeiter-Bereich einzuloggen, OHNE ein WordPress-Passwort
 * einzugeben. Der PIN wird (wie beim bestehenden /wp-json/st/v1/cal
 * Snippet) an das Apps-Script "App Script" weitergereicht, das per Roster-
 * Sheet den Namen + die E-Mail zum PIN auflöst ("identify"-Aktion). Über
 * die E-Mail wird der passende WordPress-Benutzer gefunden und für diesen
 * einen Request serverseitig eingeloggt (wp_set_auth_cookie) — der Browser
 * bekommt danach ein normales WordPress-Session-Cookie und kann Amelias
 * eigenen Mitarbeiter-/Termin-Bereich in einem iframe laden.
 *
 * WICHTIG — WARUM DAS SICHER GENUG IST (UND WAS ZU BEACHTEN BLEIBT):
 * - Genau wie beim bestehenden /wp-json/st/v1/cal-Snippet braucht der
 *   Browser kein eigenes Secret zu kennen (wäre im Seitenquelltext ohnehin
 *   sichtbar und damit kein echter Schutz) — der gültige Team-App-PIN,
 *   serverseitig über das Apps Script geprüft, ist die Legitimation.
 * - Trotzdem: Ab jetzt hängt an einem 4-stelligen PIN eine echte,
 *   wenn auch stark eingeschränkte WordPress-Session (statt wie bisher nur
 *   Lese-/Schreibzugriff auf einen einzelnen Google-Kalender). Deshalb:
 *   · Die WordPress-Konten der Teammitglieder MÜSSEN eine eng gefasste
 *     Rolle haben (siehe EXPECTED_ROLE unten) — niemals Administrator.
 *   · Das Cookie ist bewusst ein Session-Cookie (verfällt beim
 *     Schließen des Browsers), keine "Angemeldet bleiben"-Variante.
 *   · Einfaches Rate-Limit gegen PIN-Raten (st_amelia_rate_limited()
 *     unten, max. 10 Fehlversuche pro IP in 10 Minuten).
 *
 * EINRICHTUNG:
 * 1. Diesen Code als eigenes WPCode-PHP-Snippet einfügen, aktivieren.
 * 2. APPS_SCRIPT_URL unten auf die echte Apps-Script-Web-App-URL des
 *    "App Script"-Projekts setzen (die /exec-URL aus "Bereitstellen").
 *    APPS_SCRIPT_SECRET muss exakt der SECRET-Konstante dort entsprechen
 *    ('ST2026geheim', falls unverändert).
 * 3. Für jedes Teammitglied einen WordPress-Benutzer anlegen:
 *    - E-Mail MUSS exakt der E-Mail-Adresse im Roster-Sheet entsprechen
 *      (Spalte B, z. B. amila@spiritual-touch.de) — darüber findet die
 *      Zuordnung statt.
 *    - Rolle: die, die Amelia beim Aktivieren von "Mitarbeiter-Login"
 *      selbst anlegt/erwartet (in Amelia-Einstellungen → Mitarbeiter prüfen,
 *      wie das bei euch heißt) — unten bei EXPECTED_ROLE eintragen.
 * 4. AMELIA_PANEL_URL unten auf die echte URL von Amelias eingebautem
 *    Mitarbeiter-Bereich setzen (die Seite/URL, die ihr sonst nutzen
 *    würdet, um "das Employee Panel beizubringen" — je nach Amelia-Version
 *    entweder eine eigene Panel-Seite mit Amelia-Shortcode oder die
 *    wp-admin-Kalenderansicht). Das kann ich von hier aus nicht sehen —
 *    bitte einmal selbst eingeloggt nachsehen und die URL eintragen.
 * 5. team-kalender-widget.html mit dem "Termine"-Bereich (siehe dortige
 *    Änderung) live einspielen, PIN-Login testen, prüfen dass der iframe
 *    wirklich nur die eigenen Termine zeigt und keine WordPress-Menüs mehr
 *    sichtbar sind.
 */

const ST_APPS_SCRIPT_URL    = 'https://script.google.com/macros/s/BITTE-EXEC-URL-EINTRAGEN/exec';
const ST_APPS_SCRIPT_SECRET = 'ST2026geheim';
const ST_EXPECTED_ROLE      = ''; // z.B. 'wpamelia_employee' — leer lassen, um die Rollenprüfung vorerst zu überspringen
const ST_AMELIA_PANEL_URL   = 'https://spiritual-touch.de/BITTE-PANEL-URL-EINTRAGEN/';
const ST_RATE_LIMIT_MAX     = 10;  // Fehlversuche
const ST_RATE_LIMIT_WINDOW  = 600; // Sekunden (10 Minuten)

add_action('rest_api_init', function () {
    register_rest_route('st/v1', '/amelia-login', [
        'methods'             => 'POST',
        'callback'            => 'st_amelia_login_handler',
        'permission_callback' => '__return_true', // Zugriffskontrolle passiert im Callback per PIN + Rate-Limit
    ]);
});

function st_amelia_login_handler(WP_REST_Request $request) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (st_amelia_rate_limited($ip)) {
        return new WP_REST_Response(['error' => 'too_many_attempts'], 429);
    }

    $body = $request->get_json_params();
    $pin  = trim((string) ($body['pin'] ?? ''));
    if ($pin === '') {
        return new WP_REST_Response(['error' => 'missing_pin'], 400);
    }

    // 1) PIN über das bestehende Apps Script auflösen (gleiche Quelle wie
    //    das Verfügbarkeit-Snippet — kein zweiter PIN-Speicher).
    $resp = wp_remote_post(ST_APPS_SCRIPT_URL, [
        'timeout' => 15,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => wp_json_encode([
            'pin'    => $pin,
            'secret' => ST_APPS_SCRIPT_SECRET,
            'action' => 'identify',
        ]),
    ]);
    if (is_wp_error($resp)) {
        return new WP_REST_Response(['error' => 'apps_script_unreachable'], 502);
    }
    $data = json_decode(wp_remote_retrieve_body($resp), true);
    if (empty($data['ok']) || empty($data['email'])) {
        st_amelia_record_failed_attempt($ip);
        return new WP_REST_Response(['error' => 'wrong_pin'], 401);
    }

    // 2) Passenden WordPress-Benutzer über die E-Mail finden.
    $user = get_user_by('email', $data['email']);
    if (!$user) {
        return new WP_REST_Response(['error' => 'no_wp_user_for_email', 'email' => $data['email']], 404);
    }
    if (ST_EXPECTED_ROLE !== '' && !in_array(ST_EXPECTED_ROLE, (array) $user->roles, true)) {
        return new WP_REST_Response(['error' => 'unexpected_role'], 403);
    }

    // 3) Diesen einen Request/Browser als dieser Benutzer einloggen —
    //    Session-Cookie (2. Parameter false), kein "Angemeldet bleiben".
    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, false, is_ssl());
    do_action('wp_login', $user->user_login, $user);

    return new WP_REST_Response([
        'ok'       => true,
        'name'     => $data['name'] ?? $user->display_name,
        'panelUrl' => st_amelia_add_embed_param(ST_AMELIA_PANEL_URL),
    ], 200);
}

// Einfaches IP-basiertes Rate-Limit über WordPress-Transients (keine
// zusätzliche Infrastruktur nötig) — begrenzt PIN-Rateversuche, weil an
// diesem Endpunkt (anders als /cal) eine echte Login-Session hängt.
function st_amelia_rate_limited($ip) {
    return (int) get_transient('st_amelia_fails_' . md5($ip)) >= ST_RATE_LIMIT_MAX;
}
function st_amelia_record_failed_attempt($ip) {
    $key = 'st_amelia_fails_' . md5($ip);
    $count = (int) get_transient($key);
    set_transient($key, $count + 1, ST_RATE_LIMIT_WINDOW);
}

function st_amelia_add_embed_param($url) {
    $sep = (strpos($url, '?') === false) ? '?' : '&';
    return $url . $sep . 'st_embed=1';
}

// Blendet WordPress-Chrome (Adminleiste/Menü) aus, wenn die Seite mit
// ?st_embed=1 aufgerufen wird — nur dann, damit der normale WP-Admin für
// euch selbst unangetastet bleibt.
add_action('admin_head', 'st_amelia_hide_chrome_admin');
add_action('wp_head', 'st_amelia_hide_chrome_admin');
function st_amelia_hide_chrome_admin() {
    if (!isset($_GET['st_embed'])) return;
    echo '<style>
      #adminmenumain,#wpadminbar,#wpfooter,#screen-meta-links,.notice{display:none!important}
      html.wp-toolbar{padding-top:0!important}
      #wpcontent,#wpbody-content{margin-left:0!important;padding-left:0!important}
    </style>';
}
