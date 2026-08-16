<?php
/**
 * ST Buchungs-Dashboard
 *
 * Mobile Lese-Übersicht über anstehende Amelia-Buchungen (inkl. "Ausstehend"),
 * damit Jörg unterwegs (Handy-Browser) schnell sieht, was ansteht — ohne durch
 * die wp-admin-Navigation zu müssen und ohne Amelia-Plan-Upgrade.
 *
 * BEWUSST NUR LESEND: Die eigentliche Freigabe (Status → "Freigegeben")
 * passiert weiterhin direkt in Amelia (Amelia → Bookings im wp-admin). Dieses
 * Dashboard verlinkt dorthin, ändert selbst aber nichts an Buchungsdaten —
 * damit die Amelia-eigene Logik (Bestätigungsmail, Google-Kalender-Sync,
 * Zahlungsstatus) garantiert intakt bleibt und nicht per Fremdcode umgangen
 * wird.
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
 */

add_action('rest_api_init', function () {
    register_rest_route('st/v1', '/booking-overview', [
        'methods' => 'GET',
        'callback' => 'st_booking_overview_handler',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
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

add_shortcode('st_booking_dashboard', function () {
    if (!is_user_logged_in() || !current_user_can('manage_options')) {
        return '<p>Kein Zugriff. Bitte als Admin im wp-admin einloggen und diese Seite erneut aufrufen.</p>';
    }

    $nonce = wp_create_nonce('wp_rest');
    $endpoint = esc_url_raw(rest_url('st/v1/booking-overview'));
    $bookings_admin_url = esc_url_raw(admin_url('admin.php?page=wpamelia-appointments'));

    ob_start();
    ?>
    <div id="st-bd" style="--st-sand:#F3ECE1;--st-card:#FBF7F0;--st-plum:#3E2A34;--st-soft:#6B5560;--st-clay:#B5654A;--st-clay-d:#9E5440;--st-line:#E4D9C8;--st-danger:#A24A3E;--st-sage:#7E8A6F;font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:16px;background:var(--st-sand);border-radius:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="margin:0;color:var(--st-plum);font-size:1.2rem;">Buchungen (nächste <span id="st-bd-days">30</span> Tage)</h2>
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
    </div>
    <script>
    (function () {
      const endpoint = <?php echo wp_json_encode($endpoint); ?>;
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
        return (a.service_name || '').indexOf('(bestätigt)') !== -1;
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
          return '' +
            '<div style="background:var(--st-card);border:1px solid var(--st-line);border-left:4px solid ' + color + ';border-radius:8px;padding:10px 12px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
                '<strong style="color:var(--st-plum);">' + fmtDate(a.bookingStart) + '</strong>' +
                '<span style="color:' + color + ';font-size:0.8rem;font-weight:600;">' + label + '</span>' +
              '</div>' +
              '<div style="color:var(--st-plum);margin-top:4px;">' + (a.service_name || 'Unbekannter Service') + ' — ' + (a.employee_name || '–') + '</div>' +
              '<div style="color:var(--st-soft);font-size:0.85rem;margin-top:2px;">' + (a.customer_name || '–') + (a.customer_phone ? ' · ' + a.customer_phone : '') + '</div>' +
              '<div style="color:' + kindColor + ';font-size:0.75rem;margin-top:4px;font-weight:600;">' + kind + '</div>' +
            '</div>';
        }).join('');
      }

      function load() {
        document.getElementById('st-bd-status').textContent = 'Lädt…';
        fetch(endpoint + '?days=30', { headers: { 'X-WP-Nonce': nonce } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              document.getElementById('st-bd-status').textContent = 'Fehler: ' + (data.detail || data.error);
              return;
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
      load();
    })();
    </script>
    <?php
    return ob_get_clean();
});
