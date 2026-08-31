<?php
/**
 * Plugin Name: Induction Platform
 * Description: Staff induction portal — registers custom post types, REST endpoints, and embeds the React portal via shortcode.
 * Version:     1.1.6
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

defined( 'ABSPATH' ) || exit;

// ── Authorization header fallback for cPanel / shared hosting ─────────────────
// Apache on shared hosts often strips the Authorization header before it reaches
// PHP. This restores it from wherever the server makes it available, which is
// required for the JWT Authentication plugin to work without .htaccess changes.
if ( ! isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
    if ( isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif ( function_exists( 'getallheaders' ) ) {
        $all_headers = getallheaders();
        if ( isset( $all_headers['Authorization'] ) ) {
            $_SERVER['HTTP_AUTHORIZATION'] = $all_headers['Authorization'];
        }
    }
}

define( 'INDUCTION_DIR',     plugin_dir_path( __FILE__ ) );
define( 'INDUCTION_URL',     plugin_dir_url( __FILE__ ) );
define( 'INDUCTION_VERSION', '1.0.0' );

// "Meet Our Team" limits. These are enforced server-side as well as in the admin
// UI, so a direct REST call cannot store text the team page can't lay out.
define( 'INDUCTION_TEAM_TITLE_MAX_LENGTH',  60 );
define( 'INDUCTION_TEAM_REGION_MAX_LENGTH', 60 );
define( 'INDUCTION_TEAM_BIO_MAX_LENGTH',    280 );
define( 'INDUCTION_TEAM_MAX_ENTRIES',       200 );

// Reminder emails are composed in the SPA, so the subject arrives as free text.
define( 'INDUCTION_REMINDER_SUBJECT_MAX_LENGTH', 200 );

// Location map markers. The colour list must stay in step with MARKER_COLORS
// in app/src/components/LocationMap.tsx — it's the palette the admin can pick.
define( 'INDUCTION_LOCATION_MAX_MARKERS',       50 );
define( 'INDUCTION_LOCATION_MAX_PATHS',         20 );
define( 'INDUCTION_LOCATION_MAX_PATH_POINTS',  200 );
define( 'INDUCTION_LOCATION_LABEL_MAX_LENGTH',  60 );
define( 'INDUCTION_LOCATION_MARKER_COLORS', [ 'red', 'amber', 'blue', 'green' ] );

// ─── Bootstrap ───────────────────────────────────────────────────────────────

add_action( 'init',            'induction_register_post_types' );
add_action( 'init',            'induction_register_roles' );
add_action( 'init',            'induction_register_user_meta' );
add_action( 'rest_api_init',   'induction_register_routes' );
add_action( 'wp_enqueue_scripts', 'induction_maybe_enqueue_portal' );
add_action( 'plugins_loaded',  'induction_create_tables' );
add_filter( 'template_include', 'induction_portal_template' );
add_shortcode( 'induction_portal', 'induction_portal_shortcode' );
add_action( 'admin_init',      'induction_block_portal_users_from_admin' );
add_filter( 'show_admin_bar',  'induction_hide_admin_bar_for_portal_users' );

// ─── Custom Post Types ───────────────────────────────────────────────────────

function induction_register_post_types(): void {
    // Training modules
    register_post_type( 'induction_module', [
        'label'        => 'Training Modules',
        'public'       => false,
        'show_in_rest' => true,
        'rest_base'    => 'induction_module',
        'supports'     => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ],
        'show_ui'      => current_user_can( 'manage_induction' ),
        'show_in_menu' => current_user_can( 'manage_induction' ),
        'capability_type' => 'post',
    ] );

    $induction_auth = '__return_true';
    register_post_meta( 'induction_module', 'module_role_targets',      [ 'type' => 'array',   'single' => true, 'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ], 'default' => [],   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_estimated_minutes', [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_order',             [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_duration_days',     [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_blocks',            [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '[]', 'sanitize_callback' => 'induction_sanitize_blocks_json', 'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'quiz_pass_threshold',      [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 70,  'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_icon',              [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',  'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_module', 'module_hero_image',        [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,   'auth_callback' => $induction_auth ] );

    // Reference documents
    register_post_type( 'induction_document', [
        'label'        => 'Reference Documents',
        'public'       => false,
        'show_in_rest' => true,
        'rest_base'    => 'induction_document',
        'supports'     => [ 'title', 'custom-fields' ],
        'show_ui'      => current_user_can( 'manage_induction' ),
        'show_in_menu' => current_user_can( 'manage_induction' ),
        'capability_type' => 'post',
    ] );

    register_post_meta( 'induction_document', 'document_category',     [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',  'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_document', 'document_file_id',      [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_document', 'document_role_targets', [ 'type' => 'array',   'single' => true, 'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ], 'default' => [],   'auth_callback' => $induction_auth ] );

    // Class locations — a place staff need to get to, with a pinned map, any
    // markers the admin drops on it (meeting point, where to fish, parking…)
    // and free-form notes. Served through the standard posts controller like
    // documents are, so WP's own capability checks gate read vs edit.
    register_post_type( 'induction_location', [
        'label'        => 'Locations',
        'public'       => false,
        'show_in_rest' => true,
        'rest_base'    => 'induction_location',
        'supports'     => [ 'title', 'custom-fields' ],
        'show_ui'      => current_user_can( 'manage_induction' ),
        'show_in_menu' => current_user_can( 'manage_induction' ),
        'capability_type' => 'post',
    ] );

    register_post_meta( 'induction_location', 'location_address',      [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',   'sanitize_callback' => 'sanitize_text_field', 'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_lat',          [ 'type' => 'number',  'single' => true, 'show_in_rest' => true, 'default' => 0,    'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_lng',          [ 'type' => 'number',  'single' => true, 'show_in_rest' => true, 'default' => 0,    'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_zoom',         [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 17,   'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_thumbnail_id', [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,    'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_notes',        [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',   'sanitize_callback' => 'wp_kses_post', 'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_markers',      [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '[]', 'sanitize_callback' => 'induction_sanitize_markers_json', 'auth_callback' => $induction_auth ] );
    register_post_meta( 'induction_location', 'location_paths',        [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '[]', 'sanitize_callback' => 'induction_sanitize_paths_json',   'auth_callback' => $induction_auth ] );
}

// A staff member's "Meet Our Team" profile — an optional photo, job title,
// region and short bio shown on the staff portal's team page, gated behind an
// explicit opt-in checkbox so nobody appears there without an admin
// deliberately enabling it. The job title is its own field rather than a
// rendering of the WP role: "Senior Instructor" is what the team page should
// show, while the role stays purely a permissions concern.
function induction_register_user_meta(): void {
    $induction_auth = fn() => current_user_can( 'manage_induction' );

    register_meta( 'user', 'induction_team_photo',    [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,     'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_title',    [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',    'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_region',   [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',    'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_bio',      [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',    'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_visible',  [ 'type' => 'boolean', 'single' => true, 'show_in_rest' => true, 'default' => false, 'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_is_owner', [ 'type' => 'boolean', 'single' => true, 'show_in_rest' => true, 'default' => false, 'auth_callback' => $induction_auth ] );
}

// ─── Sanitization ───────────────────────────────────────────────────────────

// Meta values must be handed to update_*_meta() SLASHED.
//
// update_metadata() runs wp_unslash() on the value before the sanitize
// callback sees it. For a JSON string that is destructive: a quote inside JSON
// is written \" and unslashing strips the backslash, so
//     {"html":"after \"Nice Catch\"."}
// arrives at the sanitizer as
//     {"html":"after "Nice Catch"."}
// which is no longer valid JSON. induction_sanitize_blocks_json() then can't
// decode it, returns '[]', and the module is stored empty — a 200 response with
// module_blocks:"[]" and no error anywhere. Content with no quote in it has no
// backslash to lose, which is exactly why removing the quote "fixed" the save.
//
// wp_slash() pre-compensates so WP's unslash returns the string we meant. Every
// meta write of user-supplied text goes through this.
function induction_slash_meta( string $value ): string {
    return wp_slash( $value );
}

// The one way JSON should be encoded before it goes into post meta.
//
// wp_json_encode() returns FALSE when the data contains malformed UTF-8 — which
// rich text pasted out of OneNote/Word demonstrably can. That FALSE used to be
// handed straight to update_post_meta(), and because this file has no
// declare(strict_types=1), PHP quietly coerced it to '' on the way into a
// string-typed parameter. An empty meta value then reads back through
// `get_post_meta( … ) ?: '[]'` as an empty array, so a save that looked like a
// clean 200 silently emptied the module. JSON_INVALID_UTF8_SUBSTITUTE (PHP 7.2+)
// replaces a bad byte sequence with U+FFFD instead of failing the whole encode,
// so the content survives with one replacement character rather than vanishing.
// Returns null — never '' or false — if encoding is genuinely impossible, so
// callers must decide what to do rather than storing a silent wipe.
function induction_encode_meta_json( $value ): ?string {
    $flags   = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE;
    $encoded = wp_json_encode( $value, $flags );
    return is_string( $encoded ) && '' !== $encoded ? $encoded : null;
}

// Map markers arrive as a JSON string from the admin SPA. Rebuild the array
// field by field rather than trusting what was sent: coordinates are clamped
// to real lat/lng ranges, colours to the palette the UI offers, and anything
// unparseable collapses to an empty set instead of poisoning the map.
function induction_sanitize_markers_json( string $value ): string {
    $decoded = json_decode( $value, true );
    if ( ! is_array( $decoded ) ) {
        return '[]';
    }

    $markers = [];
    foreach ( array_slice( $decoded, 0, INDUCTION_LOCATION_MAX_MARKERS ) as $marker ) {
        if ( ! is_array( $marker ) || ! isset( $marker['lat'], $marker['lng'] ) ) {
            continue;
        }
        $lat = (float) $marker['lat'];
        $lng = (float) $marker['lng'];
        if ( $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180 ) {
            continue;
        }
        $color = isset( $marker['color'] ) ? (string) $marker['color'] : '';
        $markers[] = [
            'id'    => isset( $marker['id'] ) ? sanitize_key( (string) $marker['id'] ) : uniqid( 'm' ),
            'lat'   => $lat,
            'lng'   => $lng,
            'label' => isset( $marker['label'] )
                ? mb_substr( sanitize_text_field( (string) $marker['label'] ), 0, INDUCTION_LOCATION_LABEL_MAX_LENGTH )
                : '',
            'color' => in_array( $color, INDUCTION_LOCATION_MARKER_COLORS, true ) ? $color : 'red',
        ];
    }

    return induction_encode_meta_json( $markers ) ?? '[]';
}

// Drawn lines — "swim out to here", "walk around this way". Same defensive
// rebuild as the markers: every coordinate is re-derived and range-checked, and
// a line with fewer than two surviving points is dropped rather than stored as
// a degenerate one-point line the map can't draw.
function induction_sanitize_paths_json( string $value ): string {
    $decoded = json_decode( $value, true );
    if ( ! is_array( $decoded ) ) {
        return '[]';
    }

    $paths = [];
    foreach ( array_slice( $decoded, 0, INDUCTION_LOCATION_MAX_PATHS ) as $path ) {
        if ( ! is_array( $path ) || ! isset( $path['points'] ) || ! is_array( $path['points'] ) ) {
            continue;
        }

        $points = [];
        foreach ( array_slice( $path['points'], 0, INDUCTION_LOCATION_MAX_PATH_POINTS ) as $point ) {
            if ( ! is_array( $point ) || count( $point ) < 2 ) {
                continue;
            }
            $lat = (float) $point[0];
            $lng = (float) $point[1];
            if ( $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180 ) {
                continue;
            }
            $points[] = [ $lat, $lng ];
        }

        if ( count( $points ) < 2 ) {
            continue;
        }

        $color = isset( $path['color'] ) ? (string) $path['color'] : '';
        $paths[] = [
            'id'     => isset( $path['id'] ) ? sanitize_key( (string) $path['id'] ) : uniqid( 'p' ),
            'label'  => isset( $path['label'] )
                ? mb_substr( sanitize_text_field( (string) $path['label'] ), 0, INDUCTION_LOCATION_LABEL_MAX_LENGTH )
                : '',
            'color'  => in_array( $color, INDUCTION_LOCATION_MARKER_COLORS, true ) ? $color : 'amber',
            'points' => $points,
        ];
    }

    return induction_encode_meta_json( $paths ) ?? '[]';
}

function induction_sanitize_blocks_json( string $value ): string {
    $decoded = json_decode( $value, true );
    // Must be a valid JSON array; reject anything else.
    if ( ! is_array( $decoded ) || json_last_error() !== JSON_ERROR_NONE ) {
        return '[]';
    }
    // Re-encode to ensure clean JSON (no trailing commas, etc.). If that somehow
    // fails, keep the value that already parsed rather than returning '[]' —
    // returning the empty array here is what a content wipe looks like.
    return induction_encode_meta_json( $decoded ) ?? $value;
}

// ─── Roles ───────────────────────────────────────────────────────────────────

function induction_register_roles(): void {
    if ( ! get_role( 'staff' ) ) {
        add_role( 'staff', 'Staff', [] );
    }
    // Always sync caps so existing installs pick up changes on plugin update.
    $staff_role = get_role( 'staff' );
    foreach ( [
        'read',
        'read_private_posts',
    ] as $cap ) {
        $staff_role->add_cap( $cap );
    }

    if ( ! get_role( 'induction_admin' ) ) {
        add_role( 'induction_admin', 'Induction Admin', [] );
    }
    // Always sync caps so existing installs pick up changes on plugin update.
    $induction_admin = get_role( 'induction_admin' );
    foreach ( [
        'read',
        'manage_induction',
        'edit_posts',
        'edit_others_posts',
        'publish_posts',
        'upload_files',
        'read_private_posts',
        'delete_posts',
        'delete_others_posts',
    ] as $cap ) {
        $induction_admin->add_cap( $cap );
    }

    // Grant administrators the manage_induction capability so they can use
    // the React admin app without needing a separate induction_admin account.
    $administrator = get_role( 'administrator' );
    if ( $administrator && ! $administrator->has_cap( 'manage_induction' ) ) {
        $administrator->add_cap( 'manage_induction' );
    }
}

// ─── Database table ──────────────────────────────────────────────────────────

function induction_create_tables(): void {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    // Progress table
    $progress_table = $wpdb->prefix . 'induction_progress';
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$progress_table'" ) !== $progress_table ) {
        dbDelta( "CREATE TABLE $progress_table (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id      BIGINT UNSIGNED NOT NULL,
            module_id    BIGINT UNSIGNED NOT NULL,
            status       ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
            started_at   DATETIME NULL,
            completed_at DATETIME NULL,
            time_spent   INT UNSIGNED DEFAULT 0,
            score        DECIMAL(5,2) DEFAULT NULL,
            passed       TINYINT(1) DEFAULT NULL,
            created_at   DATETIME NOT NULL,
            updated_at   DATETIME NOT NULL,
            UNIQUE KEY user_module (user_id, module_id),
            KEY idx_user_id (user_id),
            KEY idx_module_id (module_id)
        ) $charset;" );
    }

    // Add score/passed columns if they don't exist (migration for existing installs)
    $cols = $wpdb->get_col( "DESCRIBE $progress_table", 0 );
    if ( ! in_array( 'score', $cols, true ) ) {
        $wpdb->query( "ALTER TABLE $progress_table ADD COLUMN score DECIMAL(5,2) DEFAULT NULL AFTER time_spent" );
    }
    if ( ! in_array( 'passed', $cols, true ) ) {
        $wpdb->query( "ALTER TABLE $progress_table ADD COLUMN passed TINYINT(1) DEFAULT NULL AFTER score" );
    }
    if ( ! in_array( 'quiz_submitted_at', $cols, true ) ) {
        $wpdb->query( "ALTER TABLE $progress_table ADD COLUMN quiz_submitted_at DATETIME DEFAULT NULL AFTER passed" );
    }

    // One-time backfill: an earlier version of induction_quiz_grade() only
    // wrote score/passed and left status/completed_at untouched, so grading
    // a submission as passed never actually completed the module. Reconcile
    // any rows still stuck in that inconsistent state.
    if ( ! get_option( 'induction_progress_status_backfilled' ) ) {
        $wpdb->query( "UPDATE $progress_table SET status = 'completed', completed_at = COALESCE(completed_at, updated_at) WHERE passed = 1 AND status <> 'completed'" );
        $wpdb->query( "UPDATE $progress_table SET status = 'in_progress', completed_at = NULL WHERE passed = 0 AND status = 'completed'" );
        update_option( 'induction_progress_status_backfilled', 1 );
    }

    // One-time dedup: on some installs the UNIQUE KEY below never actually
    // applied (dbDelta is strict about CREATE TABLE formatting and silently
    // skips constraints it can't parse), which let duplicate rows pile up
    // for the same user_id + module_id. Different pages picked different
    // duplicates (e.g. Array.find() vs a Map keyed by module id), so admin
    // and staff views disagreed about the same student's progress. Keep
    // only the most recently updated row per pair, then re-assert the
    // unique index so duplicates can't reappear.
    if ( ! get_option( 'induction_progress_deduped' ) ) {
        $dupe_keys = $wpdb->get_results(
            "SELECT user_id, module_id FROM $progress_table GROUP BY user_id, module_id HAVING COUNT(*) > 1",
            ARRAY_A
        ) ?? [];

        foreach ( $dupe_keys as $key ) {
            $ids = $wpdb->get_col( $wpdb->prepare(
                "SELECT id FROM $progress_table WHERE user_id = %d AND module_id = %d ORDER BY updated_at DESC, id DESC",
                $key['user_id'], $key['module_id']
            ) );
            $ids_to_delete = array_slice( $ids, 1 );
            if ( $ids_to_delete ) {
                $placeholders = implode( ',', array_fill( 0, count( $ids_to_delete ), '%d' ) );
                $wpdb->query( $wpdb->prepare( "DELETE FROM $progress_table WHERE id IN ($placeholders)", $ids_to_delete ) );
            }
        }

        $existing_index = $wpdb->get_col( "SHOW INDEX FROM $progress_table WHERE Key_name = 'user_module'" );
        if ( empty( $existing_index ) ) {
            $wpdb->query( "ALTER TABLE $progress_table ADD UNIQUE KEY user_module (user_id, module_id)" );
        }

        update_option( 'induction_progress_deduped', 1 );
    }

    // Quiz responses table
    $quiz_table = $wpdb->prefix . 'induction_quiz_responses';
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$quiz_table'" ) !== $quiz_table ) {
        dbDelta( "CREATE TABLE $quiz_table (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id      BIGINT UNSIGNED NOT NULL,
            module_id    BIGINT UNSIGNED NOT NULL,
            block_id     VARCHAR(64) NOT NULL,
            answer       TEXT NOT NULL,
            is_correct   TINYINT(1) DEFAULT NULL,
            created_at   DATETIME NOT NULL,
            UNIQUE KEY user_module_block (user_id, module_id, block_id),
            KEY idx_user_module (user_id, module_id)
        ) $charset;" );
    }

    // Assignments table — one row per (user, module) assignment, with a due date.
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$assignments_table'" ) !== $assignments_table ) {
        dbDelta( "CREATE TABLE $assignments_table (
            id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id      BIGINT UNSIGNED NOT NULL,
            module_id    BIGINT UNSIGNED NOT NULL,
            assigned_at  DATETIME NOT NULL,
            due_date     DATETIME NULL,
            assigned_by  BIGINT UNSIGNED NULL,
            UNIQUE KEY user_module (user_id, module_id),
            KEY idx_user_id (user_id),
            KEY idx_module_id (module_id)
        ) $charset;" );
    }
}

// ─── REST API endpoints ──────────────────────────────────────────────────────

function induction_register_routes(): void {
    $ns = 'induction/v1';

    // GET /progress/user/{id}
    register_rest_route( $ns, '/progress/user/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_user_progress',
        'permission_callback' => 'induction_can_view_own_progress',
        'args'                => [ 'id' => [ 'type' => 'integer' ] ],
    ] );

    // POST /progress
    register_rest_route( $ns, '/progress', [
        'methods'             => 'POST',
        'callback'            => 'induction_upsert_progress',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
            'status'    => [ 'type' => 'string',  'required' => true, 'enum' => [ 'not_started', 'in_progress', 'completed' ] ],
            'time_spent'=> [ 'type' => 'integer', 'default'  => 0 ],
        ],
    ] );

    // GET /assignments/user/{id} — returns modules assigned to a user
    register_rest_route( $ns, '/assignments/user/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_user_assignments',
        'permission_callback' => 'induction_can_view_own_progress',
        'args'                => [ 'id' => [ 'type' => 'integer' ] ],
    ] );

    // GET /assignments/records/user/{id} — raw assignment rows (with due dates)
    register_rest_route( $ns, '/assignments/records/user/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_user_assignment_records',
        'permission_callback' => 'induction_can_view_own_progress',
        'args'                => [ 'id' => [ 'type' => 'integer' ] ],
    ] );

    // POST /assignments/bulk — assign module(s) to user(s) (admin only)
    register_rest_route( $ns, '/assignments/bulk', [
        'methods'             => 'POST',
        'callback'            => 'induction_bulk_assign',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // POST /assignments/remove — unassign module(s) from user(s) (admin only)
    register_rest_route( $ns, '/assignments/remove', [
        'methods'             => 'POST',
        'callback'            => 'induction_unassign',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // POST /assignments/role — assign a module to every current member of a role
    register_rest_route( $ns, '/assignments/role', [
        'methods'             => 'POST',
        'callback'            => 'induction_assign_role',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // POST /assignments/role/remove — unassign a module from a role
    register_rest_route( $ns, '/assignments/role/remove', [
        'methods'             => 'POST',
        'callback'            => 'induction_unassign_role',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // GET /progress/module/{id} — all progress records for a module (admin only)
    register_rest_route( $ns, '/progress/module/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_module_progress',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
        'args'                => [ 'id' => [ 'type' => 'integer' ] ],
    ] );

    // GET /reports/summary — aggregate completion stats (admin only)
    register_rest_route( $ns, '/reports/summary', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_reports_summary',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // GET /reports/overdue — overdue assignments (admin only)
    register_rest_route( $ns, '/reports/overdue', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_overdue',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // POST /quiz/save — save a single answer without grading
    register_rest_route( $ns, '/quiz/save', [
        'methods'             => 'POST',
        'callback'            => 'induction_quiz_save',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
            'block_id'  => [ 'type' => 'string',  'required' => true ],
            'answer'    => [ 'type' => 'string',  'required' => true ],
        ],
    ] );

    // POST /quiz/check — grade a single answer immediately (section or module quiz)
    register_rest_route( $ns, '/quiz/check', [
        'methods'             => 'POST',
        'callback'            => 'induction_quiz_check',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
            'block_id'  => [ 'type' => 'string',  'required' => true ],
            'answer'    => [ 'type' => 'string',  'required' => true ],
        ],
    ] );

    // POST /quiz/submit-for-review — student submits the module-level quiz
    // as-is (unchecked); an admin grades it via /quiz/grade below.
    register_rest_route( $ns, '/quiz/submit-for-review', [
        'methods'             => 'POST',
        'callback'            => 'induction_quiz_submit_for_review',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
        ],
    ] );

    // GET /quiz/pending-review — module-level quiz submissions awaiting grading
    register_rest_route( $ns, '/quiz/pending-review', [
        'methods'             => 'GET',
        'callback'            => 'induction_quiz_pending_review',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
    ] );

    // GET /quiz/review/user/{user_id}/module/{module_id} — one submission's
    // questions, correct answers, and the student's answers, for grading.
    register_rest_route( $ns, '/quiz/review/user/(?P<user_id>\d+)/module/(?P<module_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_quiz_review_detail',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
        'args'                => [
            'user_id'   => [ 'type' => 'integer' ],
            'module_id' => [ 'type' => 'integer' ],
        ],
    ] );

    // POST /quiz/grade — admin records per-question correctness + pass/fail
    register_rest_route( $ns, '/quiz/grade', [
        'methods'             => 'POST',
        'callback'            => 'induction_quiz_grade',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
            'results'   => [ 'type' => 'object',  'required' => true ],
            'passed'    => [ 'type' => 'boolean', 'required' => true ],
        ],
    ] );

    // GET /quiz/responses/user/{user_id}/module/{module_id} — get saved answers
    register_rest_route( $ns, '/quiz/responses/user/(?P<user_id>\d+)/module/(?P<module_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_quiz_get_responses',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer' ],
            'module_id' => [ 'type' => 'integer' ],
        ],
    ] );

    // GET /me — current user identity (avoids wp/v2/users which hosts may block)
    register_rest_route( $ns, '/me', [
        'methods'             => 'GET',
        'callback'            => function () {
            $user = wp_get_current_user();
            return rest_ensure_response( [
                'id'    => $user->ID,
                'name'  => $user->display_name,
                'email' => $user->user_email,
                'roles' => $user->roles,
            ] );
        },
        'permission_callback' => 'is_user_logged_in',
    ] );

    // GET /staff — list all staff users (avoids wp/v2/users which hosts may block)
    register_rest_route( $ns, '/staff', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_staff_list',
            'permission_callback' => 'induction_is_admin_user',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_create_staff',
            'permission_callback' => 'induction_is_admin_user',
        ],
    ] );

    register_rest_route( $ns, '/roles', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_roles',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // POST /staff-roles — create a new staff role (a custom WordPress role)
    register_rest_route( $ns, '/staff-roles', [
        'methods'             => 'POST',
        'callback'            => 'induction_create_staff_role',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // DELETE /staff-roles/{slug} — remove a staff role (blocked while in use)
    register_rest_route( $ns, '/staff-roles/(?P<slug>[a-zA-Z0-9_-]+)', [
        'methods'             => 'DELETE',
        'callback'            => 'induction_delete_staff_role',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'slug' => [ 'type' => 'string', 'required' => true ] ],
    ] );

    register_rest_route( $ns, '/staff/remove', [
        'methods'             => 'POST',
        'callback'            => 'induction_delete_staff',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // GET /staff/{id} — single staff user
    register_rest_route( $ns, '/staff/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_staff_member',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    // POST /staff/{id}/role — change a staff member's role
    register_rest_route( $ns, '/staff/(?P<id>\d+)/role', [
        'methods'             => 'POST',
        'callback'            => 'induction_update_staff_role',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    // POST /staff/{id}/team-profile — set a staff member's Meet Our Team photo/bio/visibility
    register_rest_route( $ns, '/staff/(?P<id>\d+)/team-profile', [
        'methods'             => 'POST',
        'callback'            => 'induction_update_team_profile',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    // Locations. These deliberately do NOT go through wp/v2/induction_location:
    // writing post meta through the posts controller runs WP's per-key meta
    // capability chain, which rejected location_lat on the live site even with
    // a permissive auth_callback. Every other write in this plugin uses this
    // namespace with induction_is_admin_user, so locations do too.
    register_rest_route( $ns, '/locations', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_locations',
            'permission_callback' => 'is_user_logged_in',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_create_location',
            'permission_callback' => 'induction_is_admin_user',
        ],
    ] );

    register_rest_route( $ns, '/locations/(?P<id>\d+)', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_location',
            'permission_callback' => 'is_user_logged_in',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_update_location',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
        [
            'methods'             => 'DELETE',
            'callback'            => 'induction_delete_location',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
    ] );

    // GET  /staff/{id}/reminder — what the SPA needs to compose a reminder
    // POST /staff/{id}/reminder — send the subject/body the admin composed
    register_rest_route( $ns, '/staff/(?P<id>\d+)/reminder', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_reminder_context',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_send_training_reminder',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
    ] );

    // GET /team — published Meet Our Team entries (any signed-in staff member)
    register_rest_route( $ns, '/team', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_team',
        'permission_callback' => 'is_user_logged_in',
    ] );

    // GET /modules, POST /modules — list and create modules
    register_rest_route( $ns, '/modules', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_modules',
            'permission_callback' => 'induction_is_admin_user',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_create_module',
            'permission_callback' => 'induction_is_admin_user',
        ],
    ] );

    // GET /modules/{id}, POST /modules/{id}, DELETE /modules/{id}
    register_rest_route( $ns, '/modules/(?P<id>\d+)', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_module',
            'permission_callback' => 'is_user_logged_in',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_update_module',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
        [
            'methods'             => 'DELETE',
            'callback'            => 'induction_delete_module',
            'permission_callback' => 'induction_is_admin_user',
            'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
        ],
    ] );
}

// ─── Permissions ─────────────────────────────────────────────────────────────

function induction_can_view_own_progress( WP_REST_Request $request ): bool {
    if ( ! is_user_logged_in() ) {
        return false;
    }
    $requested_id = (int) $request->get_param( 'id' );
    // Staff may only query their own records. Admins may query anyone.
    return get_current_user_id() === $requested_id
        || current_user_can( 'manage_induction' );
}

// ─── REST Callbacks ───────────────────────────────────────────────────────────

function induction_get_user_progress( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $user_id = (int) $request->get_param( 'id' );
    $table   = $wpdb->prefix . 'induction_progress';

    $rows = $wpdb->get_results(
        $wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d", $user_id ),
        ARRAY_A
    );

    return new WP_REST_Response( array_map( 'induction_format_progress_row', $rows ?? [] ) );
}

function induction_upsert_progress( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table      = $wpdb->prefix . 'induction_progress';
    $user_id    = (int) $request->get_param( 'user_id' );
    $module_id  = (int) $request->get_param( 'module_id' );
    $status     = $request->get_param( 'status' );
    $time_spent = (int) $request->get_param( 'time_spent' );
    $now        = current_time( 'mysql' );

    // Staff can only update their own progress.
    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    $existing = $wpdb->get_row(
        $wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    );

    // Never let this endpoint downgrade an already-completed module back to
    // in_progress — the client calls it opportunistically just to mark a
    // module "visited", and a race between that call and the progress fetch
    // resolving must not stomp a real completion. Only quiz grading (an
    // explicit admin action) is allowed to revert a completed module.
    if ( $existing && $existing['status'] === 'completed' && $status !== 'completed' ) {
        return new WP_REST_Response( induction_format_progress_row( $existing ) );
    }

    if ( $existing ) {
        $data = [
            'status'     => $status,
            'time_spent' => $time_spent,
            'updated_at' => $now,
        ];
        if ( $status === 'in_progress' && ! $existing['started_at'] ) {
            $data['started_at'] = $now;
        }
        if ( $status === 'completed' && ! $existing['completed_at'] ) {
            $data['completed_at'] = $now;
        }
        $wpdb->update( $table, $data, [ 'id' => $existing['id'] ] );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $existing['id'] ), ARRAY_A );
    } else {
        $wpdb->insert( $table, [
            'user_id'      => $user_id,
            'module_id'    => $module_id,
            'status'       => $status,
            'started_at'   => $status === 'in_progress' ? $now : null,
            'completed_at' => $status === 'completed'   ? $now : null,
            'time_spent'   => $time_spent,
            'created_at'   => $now,
            'updated_at'   => $now,
        ] );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
    }

    return new WP_REST_Response( induction_format_progress_row( $row ) );
}

function induction_get_user_assignments( WP_REST_Request $request ): WP_REST_Response {
    $user_id = (int) $request->get_param( 'id' );
    $user    = get_userdata( $user_id );

    if ( ! $user ) {
        return new WP_REST_Response( [ 'message' => 'User not found' ], 404 );
    }

    // Fetch published modules assigned to this user, either explicitly
    // (module_role_targets contains "user:{id}") or via one of their current
    // roles. The old "all" broadcast sentinel stays retired — it's not a
    // real role, and re-legitimising it would bring back the "shows to
    // literally everyone forever" failure mode; explicit per-role targeting
    // (a real, currently-registered role) is what replaced it.
    $roles = $user->roles;

    $modules = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'module_order',
        'order'          => 'ASC',
    ] );

    $assigned = array_filter( $modules, function( $post ) use ( $user_id, $roles ) {
        $targets = get_post_meta( $post->ID, 'module_role_targets', true ) ?: [];
        return in_array( 'user:' . $user_id, $targets, true ) || array_intersect( $roles, $targets );
    } );

    // Return full REST representation of each post.
    $controller = new WP_REST_Posts_Controller( 'induction_module' );
    $request_for_post = new WP_REST_Request( 'GET' );
    $request_for_post->set_param( 'context', 'view' );

    $result = array_values( array_map(
        fn( $post ) => $controller->prepare_item_for_response( $post, $request_for_post )->get_data(),
        $assigned
    ) );

    return new WP_REST_Response( $result );
}

// Keeps well-formed "user:{id}" targets and real, currently-registered role
// slugs; drops anything else (e.g. the old "all" broadcast sentinel, or a
// role that no longer exists). Every assign/unassign call runs targets
// through this so stale/invalid entries don't linger indefinitely.
function induction_normalise_targets( array $targets ): array {
    $valid_roles = array_keys( induction_assignable_roles() );
    return array_values( array_filter( $targets, function ( $t ) use ( $valid_roles ) {
        return is_string( $t ) && ( str_starts_with( $t, 'user:' ) || in_array( $t, $valid_roles, true ) );
    } ) );
}

// Due date for a new/updated assignment: an explicit override wins, otherwise
// it's auto-calculated from the module's configured duration, otherwise none.
function induction_calculate_due_date( int $module_id, $explicit_due, string $now ): ?string {
    if ( $explicit_due ) {
        return $explicit_due;
    }
    $duration_days = (int) get_post_meta( $module_id, 'module_duration_days', true );
    if ( $duration_days > 0 ) {
        return date( 'Y-m-d H:i:s', strtotime( $now . ' +' . $duration_days . ' days' ) );
    }
    return null;
}

// Creates the tracked assignment row if it doesn't exist yet; if it does,
// only touches the due date when a non-null one was actually computed (so
// re-syncing an already-tracked user never blanks out an existing due date).
function induction_ensure_assignment_row( int $user_id, int $module_id, ?string $due_date, string $now ): void {
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $assignments_table WHERE user_id = %d AND module_id = %d",
        $user_id, $module_id
    ) );
    if ( $existing ) {
        if ( $due_date !== null ) {
            $wpdb->update( $assignments_table, [ 'due_date' => $due_date ], [ 'id' => (int) $existing ] );
        }
    } else {
        $wpdb->insert( $assignments_table, [
            'user_id'     => $user_id,
            'module_id'   => $module_id,
            'assigned_at' => $now,
            'due_date'    => $due_date,
            'assigned_by' => get_current_user_id(),
        ] );
    }
}

// Ensures every CURRENT member of $role has a tracked assignment row for
// $module_id. Shared by the "assign to role" endpoint and by the new-hire /
// role-change sync, so a module already targeted at a role stays in sync
// with who's actually in that role over time.
function induction_sync_role_assignments( int $module_id, string $role, $explicit_due = null ): void {
    $now      = current_time( 'mysql' );
    $due_date = induction_calculate_due_date( $module_id, $explicit_due, $now );
    foreach ( get_users( [ 'role' => $role, 'fields' => 'ID' ] ) as $uid ) {
        induction_ensure_assignment_row( (int) $uid, $module_id, $due_date, $now );
    }
}

function induction_bulk_assign( WP_REST_Request $request ): WP_REST_Response {
    $module_id = (int) $request->get_param( 'module_id' );
    $user_ids  = array_map( 'intval', (array) $request->get_param( 'user_ids' ) );

    if ( ! $module_id || empty( $user_ids ) ) {
        return new WP_REST_Response( [ 'message' => 'module_id and user_ids are required' ], 400 );
    }

    // Add each user as an explicit target on the module's role_targets meta.
    $current_targets = induction_normalise_targets( get_post_meta( $module_id, 'module_role_targets', true ) ?: [] );
    foreach ( $user_ids as $uid ) {
        $key = 'user:' . $uid;
        if ( ! in_array( $key, $current_targets, true ) ) {
            $current_targets[] = $key;
        }
    }
    update_post_meta( $module_id, 'module_role_targets', $current_targets );

    $now      = current_time( 'mysql' );
    $due_date = induction_calculate_due_date( $module_id, $request->get_param( 'due_date' ), $now );
    foreach ( $user_ids as $uid ) {
        induction_ensure_assignment_row( $uid, $module_id, $due_date, $now );
    }

    return new WP_REST_Response( [ 'assigned' => count( $user_ids ) ] );
}

function induction_unassign( WP_REST_Request $request ): WP_REST_Response {
    $module_id = (int) $request->get_param( 'module_id' );
    $user_ids  = array_map( 'intval', (array) $request->get_param( 'user_ids' ) );

    if ( ! $module_id || empty( $user_ids ) ) {
        return new WP_REST_Response( [ 'message' => 'module_id and user_ids are required' ], 400 );
    }

    // Remove each user's explicit "user:{id}" target from the module.
    $current_targets = induction_normalise_targets( get_post_meta( $module_id, 'module_role_targets', true ) ?: [] );
    $remove_keys     = array_map( fn( $uid ) => 'user:' . $uid, $user_ids );
    $updated         = array_values( array_filter(
        $current_targets,
        fn( $t ) => ! in_array( $t, $remove_keys, true )
    ) );
    update_post_meta( $module_id, 'module_role_targets', $updated );

    // Delete the assignment rows for these users.
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    $placeholders      = implode( ',', array_fill( 0, count( $user_ids ), '%d' ) );
    $wpdb->query( $wpdb->prepare(
        "DELETE FROM $assignments_table WHERE module_id = %d AND user_id IN ($placeholders)",
        array_merge( [ $module_id ], $user_ids )
    ) );

    return new WP_REST_Response( [ 'removed' => count( $user_ids ) ] );
}

function induction_assign_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $module_id = (int) $request->get_param( 'module_id' );
    $role      = sanitize_key( (string) $request->get_param( 'role' ) );

    if ( ! $module_id || $role === '' ) {
        return new WP_REST_Response( [ 'message' => 'module_id and role are required' ], 400 );
    }
    $assignable = induction_assignable_roles();
    if ( ! isset( $assignable[ $role ] ) ) {
        return new WP_Error( 'invalid_role', 'Please choose a valid role.', [ 'status' => 400 ] );
    }

    $current_targets = induction_normalise_targets( get_post_meta( $module_id, 'module_role_targets', true ) ?: [] );
    if ( ! in_array( $role, $current_targets, true ) ) {
        $current_targets[] = $role;
        update_post_meta( $module_id, 'module_role_targets', $current_targets );
    }

    induction_sync_role_assignments( $module_id, $role, $request->get_param( 'due_date' ) );

    return new WP_REST_Response( [ 'assigned_role' => $role ] );
}

function induction_unassign_role( WP_REST_Request $request ): WP_REST_Response {
    $module_id = (int) $request->get_param( 'module_id' );
    $role      = sanitize_key( (string) $request->get_param( 'role' ) );

    if ( ! $module_id || $role === '' ) {
        return new WP_REST_Response( [ 'message' => 'module_id and role are required' ], 400 );
    }

    $current_targets = induction_normalise_targets( get_post_meta( $module_id, 'module_role_targets', true ) ?: [] );
    $updated         = array_values( array_filter( $current_targets, fn( $t ) => $t !== $role ) );
    update_post_meta( $module_id, 'module_role_targets', $updated );

    // Drop the tracked assignment for each current member of this role,
    // unless they're also individually targeted — that assignment is
    // independent of the role and must survive the role being unassigned.
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    foreach ( get_users( [ 'role' => $role, 'fields' => 'ID' ] ) as $uid ) {
        if ( in_array( 'user:' . $uid, $updated, true ) ) {
            continue;
        }
        $wpdb->delete( $assignments_table, [ 'module_id' => $module_id, 'user_id' => (int) $uid ] );
    }

    return new WP_REST_Response( [ 'removed_role' => $role ] );
}

function induction_get_user_assignment_records( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $user_id = (int) $request->get_param( 'id' );
    $table   = $wpdb->prefix . 'induction_assignments';
    $rows    = $wpdb->get_results(
        $wpdb->prepare( "SELECT module_id, assigned_at, due_date FROM $table WHERE user_id = %d", $user_id ),
        ARRAY_A
    ) ?? [];
    return new WP_REST_Response( array_map( fn( $r ) => [
        'moduleId'   => (int) $r['module_id'],
        'assignedAt' => $r['assigned_at'],
        'dueDate'    => $r['due_date'] ?: null,
    ], $rows ) );
}

function induction_get_module_progress( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $module_id = (int) $request->get_param( 'id' );
    $table     = $wpdb->prefix . 'induction_progress';

    $rows = $wpdb->get_results(
        $wpdb->prepare( "SELECT * FROM $table WHERE module_id = %d", $module_id ),
        ARRAY_A
    );

    return new WP_REST_Response( array_map( 'induction_format_progress_row', $rows ?? [] ) );
}

function induction_get_reports_summary(): WP_REST_Response {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_progress';

    // All published modules.
    $modules = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'module_order',
        'order'          => 'ASC',
    ] );

    // All staff users.
    $staff = get_users( [ 'role' => 'staff', 'fields' => [ 'ID', 'display_name' ] ] );

    // All progress records in one query (avoids N+1).
    $all_progress = $wpdb->get_results(
        "SELECT * FROM $table",
        ARRAY_A
    ) ?? [];

    // Index progress by module_id → user_id.
    $progress_index = [];
    foreach ( $all_progress as $row ) {
        $progress_index[ (int) $row['module_id'] ][ (int) $row['user_id'] ] = $row;
    }

    $staff_map = [];
    foreach ( $staff as $u ) {
        $staff_map[ (int) $u->ID ] = $u->display_name;
    }

    $total_staff   = count( $staff );
    $total_modules = count( $modules );
    $total_completions = 0;
    $total_possible    = $total_modules * $total_staff;

    $module_reports = [];

    foreach ( $modules as $module ) {
        $mid       = $module->ID;
        $mod_prog  = $progress_index[ $mid ] ?? [];
        $completed = 0;
        $breakdown = [];

        foreach ( $staff as $user ) {
            $uid  = (int) $user->ID;
            $prog = $mod_prog[ $uid ] ?? null;
            $status = $prog ? $prog['status'] : 'not_started';
            if ( $status === 'completed' ) {
                $completed++;
                $total_completions++;
            }
            $breakdown[] = [
                'user_id'      => $uid,
                'name'         => $user->display_name,
                'status'       => $status,
                'completed_at' => $prog ? ( $prog['completed_at'] ?: null ) : null,
            ];
        }

        $module_reports[] = [
            'module_id'       => $mid,
            'module_title'    => get_the_title( $mid ),
            'total_assigned'  => $total_staff,
            'total_completed' => $completed,
            'completion_pct'  => $total_staff > 0 ? (int) round( ( $completed / $total_staff ) * 100 ) : 0,
            'staff_breakdown' => $breakdown,
        ];
    }

    // Completions grouped by date for the line chart.
    $completions_by_date = $wpdb->get_results(
        "SELECT DATE(completed_at) as date, COUNT(*) as completed
         FROM $table
         WHERE status = 'completed' AND completed_at IS NOT NULL
         GROUP BY DATE(completed_at)
         ORDER BY date ASC",
        ARRAY_A
    ) ?? [];

    return new WP_REST_Response( [
        'total_modules'          => $total_modules,
        'total_staff'            => $total_staff,
        'overall_completion_pct' => $total_possible > 0 ? (int) round( ( $total_completions / $total_possible ) * 100 ) : 0,
        'module_reports'         => $module_reports,
        'completion_over_time'   => array_map( fn( $r ) => [
            'date'      => $r['date'],
            'completed' => (int) $r['completed'],
        ], $completions_by_date ),
    ] );
}

function induction_get_overdue(): WP_REST_Response {
    global $wpdb;
    $assignments = $wpdb->prefix . 'induction_assignments';
    $progress    = $wpdb->prefix . 'induction_progress';
    $now         = current_time( 'mysql' );

    // Overdue = assignment past its due date and not completed by that user.
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.user_id, a.module_id, a.due_date
         FROM $assignments a
         LEFT JOIN $progress p
           ON p.user_id = a.user_id AND p.module_id = a.module_id
         WHERE a.due_date IS NOT NULL
           AND a.due_date < %s
           AND ( p.status IS NULL OR p.status <> 'completed' )
         ORDER BY a.due_date ASC",
        $now
    ), ARRAY_A ) ?? [];

    // Per-user count of assigned modules not yet completed (for the overdue table).
    $count_rows = $wpdb->get_results(
        "SELECT a.user_id, COUNT(*) AS cnt
         FROM $assignments a
         LEFT JOIN $progress p
           ON p.user_id = a.user_id AND p.module_id = a.module_id
         WHERE ( p.status IS NULL OR p.status <> 'completed' )
         GROUP BY a.user_id",
        ARRAY_A
    ) ?? [];
    $not_completed = [];
    foreach ( $count_rows as $cr ) {
        $not_completed[ (int) $cr['user_id'] ] = (int) $cr['cnt'];
    }

    $result = array_map( function ( $r ) use ( $not_completed ) {
        $user = get_userdata( (int) $r['user_id'] );
        return [
            'userId'            => (int) $r['user_id'],
            'userName'          => $user ? $user->display_name : 'Unknown',
            'moduleId'          => (int) $r['module_id'],
            'moduleTitle'       => get_the_title( (int) $r['module_id'] ) ?: '(Untitled)',
            'dueDate'           => $r['due_date'],
            'notCompletedCount' => $not_completed[ (int) $r['user_id'] ] ?? 0,
        ];
    }, $rows );

    return new WP_REST_Response( $result );
}

// ─── Quiz Callbacks ─────────────────────────────────────────────────────────

// Shared upsert for the quiz responses table. $is_correct = null leaves grading pending.
function induction_upsert_quiz_response(
    string $table, int $user_id, int $module_id, string $block_id, $answer, ?bool $is_correct
): void {
    global $wpdb;
    $data = [
        'answer'     => $answer,
        'is_correct' => $is_correct === null ? null : ( $is_correct ? 1 : 0 ),
        'created_at' => current_time( 'mysql' ),
    ];

    $existing = $wpdb->get_row(
        $wpdb->prepare( "SELECT id FROM $table WHERE user_id = %d AND module_id = %d AND block_id = %s", $user_id, $module_id, $block_id ),
        ARRAY_A
    );

    if ( $existing ) {
        $wpdb->update( $table, $data, [ 'id' => $existing['id'] ] );
    } else {
        $wpdb->insert( $table, array_merge(
            [ 'user_id' => $user_id, 'module_id' => $module_id, 'block_id' => $block_id ], $data
        ) );
    }
}

// Grades a single answer against a quiz block's stored correct answer.
function induction_grade_quiz_answer( array $quiz_block, $answer ): bool {
    if ( $quiz_block['type'] === 'multiple_choice' ) {
        return (int) $answer === (int) ( $quiz_block['data']['correctIndex'] ?? -1 );
    }
    if ( $quiz_block['type'] === 'true_false' ) {
        $correct_val = ! empty( $quiz_block['data']['correctAnswer'] );
        return ( $answer === 'true' ) === $correct_val;
    }
    if ( $quiz_block['type'] === 'short_answer' ) {
        // Case-insensitive, whitespace-trimmed exact match.
        $expected = trim( (string) ( $quiz_block['data']['correctAnswer'] ?? '' ) );
        return $expected !== '' && strcasecmp( trim( (string) $answer ), $expected ) === 0;
    }
    return false;
}

function induction_quiz_save( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_quiz_responses';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $block_id  = $request->get_param( 'block_id' );
    $answer    = $request->get_param( 'answer' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    // Upsert the answer without grading — is_correct stays NULL until checked/submitted.
    induction_upsert_quiz_response( $table, $user_id, $module_id, $block_id, $answer, null );

    return new WP_REST_Response( [ 'saved' => true ] );
}

// Returns true if $block_id belongs to the section flagged as the module-level
// quiz. Legacy flat-format modules (no sections) have no such concept.
function induction_is_module_quiz_block( string $blocks_json, string $block_id ): bool {
    $parsed = json_decode( $blocks_json, true ) ?: [];
    if ( empty( $parsed ) || ! array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        return false;
    }
    foreach ( $parsed as $section ) {
        if ( empty( $section['isModuleQuiz'] ) ) continue;
        foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
            if ( $b['id'] === $block_id ) return true;
        }
    }
    return false;
}

// Defense in depth alongside induction_strip_unpublished_content(): a student
// hitting the REST API directly (bypassing the SPA, which never renders an
// unpublished quiz) must still be blocked from checking or submitting it.
// Returns true only if $block_id's owning section has BOTH its content and
// its quiz published. Legacy flat-format modules predate per-section status
// and are always considered published.
function induction_is_quiz_block_published( string $blocks_json, string $block_id ): bool {
    $parsed = json_decode( $blocks_json, true ) ?: [];
    if ( empty( $parsed ) || ! array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        return true;
    }
    foreach ( $parsed as $section ) {
        foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
            if ( $b['id'] !== $block_id ) continue;
            return ( $section['status'] ?? 'publish' ) === 'publish'
                && ( $section['quizStatus'] ?? 'publish' ) === 'publish';
        }
    }
    return false;
}

// Same idea, scoped to the module-level quiz specifically (used by
// quiz/submit-for-review, which has no single block_id to check against).
function induction_has_published_module_quiz( string $blocks_json ): bool {
    $parsed = json_decode( $blocks_json, true ) ?: [];
    if ( empty( $parsed ) || ! array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        return false;
    }
    foreach ( $parsed as $section ) {
        if ( empty( $section['isModuleQuiz'] ) || empty( $section['quizBlocks'] ) ) continue;
        return ( $section['status'] ?? 'publish' ) === 'publish'
            && ( $section['quizStatus'] ?? 'publish' ) === 'publish';
    }
    return false;
}

// Grades one answer immediately — used by the "Check answer" button for
// section-level quiz questions only. Module-level quiz questions are graded
// by an admin (see quiz/submit-for-review + quiz/grade below), never
// auto-checked, so they're rejected here even if requested directly.
function induction_quiz_check( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_quiz_responses';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $block_id  = $request->get_param( 'block_id' );
    $answer    = $request->get_param( 'answer' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    $blocks_json = get_post_meta( $module_id, 'module_blocks', true ) ?: '[]';

    if ( induction_is_module_quiz_block( $blocks_json, $block_id ) ) {
        return new WP_REST_Response(
            [ 'message' => 'Module-level quiz answers are graded by an admin, not checked automatically.' ], 403
        );
    }

    if ( ! induction_is_quiz_block_published( $blocks_json, $block_id ) ) {
        return new WP_REST_Response( [ 'message' => 'Quiz question not found' ], 404 );
    }

    $quiz_blocks = induction_collect_quiz_blocks( $blocks_json, false );
    $quiz_block  = $quiz_blocks[ $block_id ] ?? null;

    if ( ! $quiz_block ) {
        return new WP_REST_Response( [ 'message' => 'Quiz question not found' ], 404 );
    }

    $is_correct = induction_grade_quiz_answer( $quiz_block, $answer );
    induction_upsert_quiz_response( $table, $user_id, $module_id, $block_id, $answer, $is_correct );

    return new WP_REST_Response( [
        'isCorrect'   => $is_correct,
        'explanation' => $quiz_block['data']['explanation'] ?? '',
    ] );
}

// Student submits their module-level quiz answers as-is, without grading.
// Resets any prior score/passed so a resubmission goes back to "pending".
function induction_quiz_submit_for_review( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_progress';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $now       = current_time( 'mysql' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    $blocks_json = get_post_meta( $module_id, 'module_blocks', true ) ?: '[]';
    if ( ! induction_has_published_module_quiz( $blocks_json ) ) {
        return new WP_REST_Response( [ 'message' => 'No published module-level quiz found' ], 404 );
    }

    $existing = $wpdb->get_row(
        $wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    );

    $data = [
        'quiz_submitted_at' => $now,
        'score'             => null,
        'passed'            => null,
        'updated_at'        => $now,
    ];

    if ( $existing ) {
        $wpdb->update( $table, $data, [ 'id' => $existing['id'] ] );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $existing['id'] ), ARRAY_A );
    } else {
        $wpdb->insert( $table, array_merge( [
            'user_id'    => $user_id,
            'module_id'  => $module_id,
            'status'     => 'in_progress',
            'started_at' => $now,
            'time_spent' => 0,
            'created_at' => $now,
        ], $data ) );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
    }

    return new WP_REST_Response( induction_format_progress_row( $row ) );
}

// Lists module-level quiz submissions awaiting admin grading.
function induction_quiz_pending_review(): WP_REST_Response {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_progress';

    $rows = $wpdb->get_results(
        "SELECT p.user_id, p.module_id, p.quiz_submitted_at, u.display_name AS user_name, po.post_title AS module_title
         FROM $table p
         INNER JOIN {$wpdb->users} u ON u.ID = p.user_id
         INNER JOIN {$wpdb->posts} po ON po.ID = p.module_id
         WHERE p.quiz_submitted_at IS NOT NULL AND p.passed IS NULL
         ORDER BY p.quiz_submitted_at ASC",
        ARRAY_A
    ) ?? [];

    return new WP_REST_Response( array_map( function ( $r ) {
        return [
            'userId'          => (int) $r['user_id'],
            'userName'        => $r['user_name'],
            'moduleId'        => (int) $r['module_id'],
            'moduleTitle'     => $r['module_title'],
            'quizSubmittedAt' => $r['quiz_submitted_at'],
        ];
    }, $rows ) );
}

// Returns one submission's module-level quiz questions (with correct answers)
// alongside the student's saved answers, for an admin to grade.
function induction_quiz_review_detail( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );

    $blocks_json = get_post_meta( $module_id, 'module_blocks', true ) ?: '[]';
    $quiz_blocks = induction_collect_quiz_blocks( $blocks_json, true );

    if ( empty( $quiz_blocks ) ) {
        return new WP_REST_Response( [ 'message' => 'No module-level quiz found' ], 404 );
    }

    $quiz_table = $wpdb->prefix . 'induction_quiz_responses';
    $responses  = $wpdb->get_results(
        $wpdb->prepare( "SELECT block_id, answer, is_correct FROM $quiz_table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    ) ?? [];

    $answers_by_block = [];
    foreach ( $responses as $r ) {
        $answers_by_block[ $r['block_id'] ] = $r;
    }

    $questions = [];
    foreach ( $quiz_blocks as $block_id => $block ) {
        $resp = $answers_by_block[ $block_id ] ?? null;
        $questions[] = [
            'blockId'       => $block_id,
            'type'          => $block['type'],
            'question'      => $block['data']['question'] ?? '',
            'options'       => $block['data']['options'] ?? null,
            'correctIndex'  => $block['data']['correctIndex'] ?? null,
            'correctAnswer' => $block['type'] === 'true_false' && array_key_exists( 'correctAnswer', $block['data'] ?? [] )
                ? (bool) $block['data']['correctAnswer']
                : null,
            'correctText'   => $block['type'] === 'short_answer' ? ( $block['data']['correctAnswer'] ?? '' ) : null,
            'explanation'   => $block['data']['explanation'] ?? '',
            'imageUrl'      => $block['data']['imageUrl'] ?? null,
            'userAnswer'    => $resp['answer'] ?? null,
            'isCorrect'     => ( $resp !== null && $resp['is_correct'] !== null ) ? (bool) $resp['is_correct'] : null,
        ];
    }

    $progress_table = $wpdb->prefix . 'induction_progress';
    $progress = $wpdb->get_row(
        $wpdb->prepare( "SELECT quiz_submitted_at FROM $progress_table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    );

    return new WP_REST_Response( [
        'questions'       => $questions,
        'quizSubmittedAt' => $progress['quiz_submitted_at'] ?? null,
    ] );
}

// Admin records per-question correctness and an overall pass/fail decision.
function induction_quiz_grade( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $results   = (array) $request->get_param( 'results' );
    $passed    = (bool) $request->get_param( 'passed' );
    $now       = current_time( 'mysql' );

    $quiz_table = $wpdb->prefix . 'induction_quiz_responses';
    foreach ( $results as $block_id => $is_correct ) {
        $wpdb->update(
            $quiz_table,
            [ 'is_correct' => $is_correct ? 1 : 0 ],
            [ 'user_id' => $user_id, 'module_id' => $module_id, 'block_id' => sanitize_text_field( (string) $block_id ) ]
        );
    }

    $total   = count( $results );
    $correct = count( array_filter( $results ) );
    $score   = $total > 0 ? round( ( $correct / $total ) * 100, 2 ) : null;

    $progress_table = $wpdb->prefix . 'induction_progress';
    $data = [
        'score'      => $score,
        'passed'     => $passed ? 1 : 0,
        'updated_at' => $now,
    ];

    if ( $passed ) {
        // Passing the quiz completes the module outright — the student
        // doesn't need to take any further action on their side.
        $data['status']       = 'completed';
        $data['completed_at'] = $now;
    } else {
        // Failing the quiz reverts a completed module back to in-progress so
        // the student can edit their answers and retake it.
        $data['status']       = 'in_progress';
        $data['completed_at'] = null;
    }

    $wpdb->update( $progress_table, $data, [ 'user_id' => $user_id, 'module_id' => $module_id ] );

    return new WP_REST_Response( [ 'score' => $score, 'passed' => $passed ] );
}

function induction_quiz_get_responses( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_quiz_responses';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    $rows = $wpdb->get_results(
        $wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    ) ?? [];

    return new WP_REST_Response( array_map( function( $row ) {
        return [
            'blockId'    => $row['block_id'],
            'answer'     => $row['answer'],
            'isCorrect'  => (bool) $row['is_correct'],
        ];
    }, $rows ) );
}

// ─── Hero image URL resolution ──────────────────────────────────────────────
// Resolves module_hero_image attachment ID to a usable URL on the response.

add_filter( 'rest_prepare_induction_module', 'induction_attach_hero_image_url', 10, 3 );

function induction_attach_hero_image_url( WP_REST_Response $response, WP_Post $post, WP_REST_Request $request ): WP_REST_Response {
    $data = $response->get_data();
    $id   = (int) ( $data['meta']['module_hero_image'] ?? 0 );
    $url  = $id ? wp_get_attachment_url( $id ) : '';
    $data['hero_image_url'] = $url ?: '';
    $response->set_data( $data );
    return $response;
}

// ─── Answer Stripping ───────────────────────────────────────────────────────
// Strip correct answers from module_blocks before sending to non-admin users.
// Handles both old flat Block[] and new Section[] (where quiz blocks live in
// each section's quizBlocks sub-array).

function induction_strip_answers_from_blocks_json( string $blocks_json ): string {
    $parsed = json_decode( $blocks_json, true );
    if ( ! is_array( $parsed ) || empty( $parsed ) ) {
        return $blocks_json;
    }

    if ( array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        // Section[] format
        foreach ( $parsed as &$section ) {
            foreach ( $section['quizBlocks'] as &$block ) {
                if ( ( $block['type'] ?? '' ) === 'multiple_choice' ) {
                    unset( $block['data']['correctIndex'] );
                } elseif ( in_array( $block['type'] ?? '', [ 'true_false', 'short_answer' ], true ) ) {
                    unset( $block['data']['correctAnswer'] );
                }
            }
            unset( $block );
        }
        unset( $section );
    } else {
        // Flat Block[] format (legacy)
        foreach ( $parsed as &$block ) {
            if ( ( $block['type'] ?? '' ) === 'multiple_choice' ) {
                unset( $block['data']['correctIndex'] );
            } elseif ( in_array( $block['type'] ?? '', [ 'true_false', 'short_answer' ], true ) ) {
                unset( $block['data']['correctAnswer'] );
            }
        }
        unset( $block );
    }

    // '[]' rather than the original on failure: showing staff nothing is a
    // display bug, handing them the un-stripped answers is a real one.
    return induction_encode_meta_json( $parsed ) ?? '[]';
}

// $module_quiz_only = true restricts collection to the section flagged as the
// module-level quiz (used for quiz/submit grading). false collects every
// section's quiz blocks (used for quiz/check, which grades any single question).
function induction_collect_quiz_blocks( string $blocks_json, bool $module_quiz_only = true ): array {
    $parsed      = json_decode( $blocks_json, true ) ?: [];
    $quiz_blocks = [];

    if ( ! empty( $parsed ) && array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        // Section[] format
        foreach ( $parsed as $section ) {
            if ( $module_quiz_only && empty( $section['isModuleQuiz'] ) ) continue;
            foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
                $quiz_blocks[ $b['id'] ] = $b;
            }
        }
    } else {
        // Flat Block[] format (legacy)
        foreach ( $parsed as $b ) {
            if ( in_array( $b['type'] ?? '', [ 'multiple_choice', 'true_false' ], true ) ) {
                $quiz_blocks[ $b['id'] ] = $b;
            }
        }
    }

    return $quiz_blocks;
}

add_filter( 'rest_prepare_induction_module', 'induction_strip_quiz_answers', 10, 3 );

function induction_strip_quiz_answers( WP_REST_Response $response, WP_Post $post, WP_REST_Request $request ): WP_REST_Response {
    if ( current_user_can( 'manage_induction' ) ) {
        return $response;
    }

    $data = $response->get_data();
    if ( ! isset( $data['meta']['module_blocks'] ) ) {
        return $response;
    }

    $data['meta']['module_blocks'] = induction_strip_answers_from_blocks_json( $data['meta']['module_blocks'] );
    $response->set_data( $data );

    return $response;
}

// Runs before induction_strip_quiz_answers (lower priority) so it operates on
// the full, unfiltered module_blocks. Draft sections are removed outright;
// sections with a draft quizStatus keep their content but lose their quiz —
// each is independent of the other and of the module's own post_status.
add_filter( 'rest_prepare_induction_module', 'induction_strip_unpublished_content', 9, 3 );

function induction_strip_unpublished_content( WP_REST_Response $response, WP_Post $post, WP_REST_Request $request ): WP_REST_Response {
    if ( current_user_can( 'manage_induction' ) ) {
        return $response;
    }

    $data = $response->get_data();
    if ( ! isset( $data['meta']['module_blocks'] ) ) {
        return $response;
    }

    $data['meta']['module_blocks'] = induction_strip_unpublished_sections_json( $data['meta']['module_blocks'] );
    $response->set_data( $data );

    return $response;
}

function induction_strip_unpublished_sections_json( string $blocks_json ): string {
    $parsed = json_decode( $blocks_json, true );
    if ( ! is_array( $parsed ) || empty( $parsed ) || ! array_key_exists( 'quizBlocks', $parsed[0] ) ) {
        return $blocks_json; // legacy flat format predates per-section status
    }

    $visible = [];
    foreach ( $parsed as $section ) {
        if ( ( $section['status'] ?? 'publish' ) !== 'publish' ) {
            continue; // drop draft sections entirely
        }
        if ( ( $section['quizStatus'] ?? 'publish' ) !== 'publish' ) {
            $section['quizBlocks'] = []; // keep the content, hide the quiz
        }
        $visible[] = $section;
    }

    // Same trade-off as above: on failure, show nothing rather than risk
    // leaking the draft sections this function exists to hide.
    return induction_encode_meta_json( $visible ) ?? '[]';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function induction_format_progress_row( array $row ): array {
    return [
        'id'          => (int) $row['id'],
        'user_id'     => (int) $row['user_id'],
        'module_id'   => (int) $row['module_id'],
        'status'      => $row['status'],
        'started_at'  => $row['started_at']   ?: null,
        'completed_at'=> $row['completed_at'] ?: null,
        'time_spent'  => (int) $row['time_spent'],
        'score'       => isset( $row['score'] ) ? (float) $row['score'] : null,
        'passed'      => isset( $row['passed'] ) ? (bool) $row['passed'] : null,
        'quiz_submitted_at' => $row['quiz_submitted_at'] ?? null,
    ];
}

// ─── Shortcode + asset enqueue ───────────────────────────────────────────────

/**
 * Usage: add [induction_portal] to any WordPress page.
 * WordPress will render the mount div; the enqueued script boots React into it.
 */
function induction_is_admin_user(): bool {
    $user = wp_get_current_user();
    return ! empty( array_intersect( [ 'administrator', 'induction_admin' ], (array) $user->roles ) );
}

function induction_block_portal_users_from_admin(): void {
    if ( defined( 'DOING_AJAX' ) && DOING_AJAX ) return;
    $user = wp_get_current_user();
    if ( array_intersect( [ 'staff', 'induction_admin' ], (array) $user->roles ) ) {
        wp_safe_redirect( home_url( '/' ) );
        exit;
    }
}

function induction_hide_admin_bar_for_portal_users( bool $show ): bool {
    $user = wp_get_current_user();
    if ( array_intersect( [ 'staff', 'induction_admin' ], (array) $user->roles ) ) {
        return false;
    }
    return $show;
}

function induction_format_staff_user( WP_User $user ): array {
    $team_photo_id = (int) get_user_meta( $user->ID, 'induction_team_photo', true );
    return [
        'id'             => $user->ID,
        'name'           => $user->display_name,
        'slug'           => $user->user_login,
        'email'          => $user->user_email,
        'roles'          => $user->roles,
        'avatar_urls'    => [
            '48' => get_avatar_url( $user->ID, [ 'size' => 48 ] ),
            '96' => get_avatar_url( $user->ID, [ 'size' => 96 ] ),
        ],
        'team_photo_url' => $team_photo_id ? ( wp_get_attachment_image_url( $team_photo_id, 'medium' ) ?: '' ) : '',
        'team_title'     => (string) get_user_meta( $user->ID, 'induction_team_title', true ),
        'team_region'    => (string) get_user_meta( $user->ID, 'induction_team_region', true ),
        'team_bio'       => (string) get_user_meta( $user->ID, 'induction_team_bio', true ),
        'team_visible'   => (bool) get_user_meta( $user->ID, 'induction_team_visible', true ),
        'team_is_owner'  => (bool) get_user_meta( $user->ID, 'induction_team_is_owner', true ),
    ];
}

// Allowlist, not a blocklist: only the two built-in roles plus roles this
// plugin itself created (tracked in the induction_custom_roles option) are
// ever offered as assignable. A blocklist-of-core-roles approach would leak
// in any custom role some unrelated theme/plugin happens to register.
function induction_assignable_roles(): array {
    $allowed = array_merge( [ 'staff', 'induction_admin' ], get_option( 'induction_custom_roles', [] ) );
    $names   = wp_roles()->get_names();
    return array_intersect_key( $names, array_flip( $allowed ) );
}

function induction_get_roles(): WP_REST_Response {
    $out = [];
    foreach ( induction_assignable_roles() as $slug => $label ) {
        $out[] = [ 'value' => $slug, 'label' => $label ];
    }
    return rest_ensure_response( $out );
}

// Staff roles ("Fishing Instructor", "Office Admin") are plain custom
// WordPress roles — the same mechanism as the built-in "staff"/
// "induction_admin" roles, so they automatically show up everywhere
// induction_assignable_roles() is already used (Add Staff, Change Role, the
// Module Edit screen's Assigned Roles picker) with no further wiring. The
// induction_custom_roles option is what lets induction_assignable_roles()
// tell "a role this plugin created" apart from any other role that happens
// to exist on the site.
function induction_create_staff_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $name = sanitize_text_field( (string) $request->get_param( 'name' ) );
    if ( $name === '' ) {
        return new WP_Error( 'invalid_name', 'Please enter a staff role name.', [ 'status' => 400 ] );
    }
    $slug = sanitize_key( $name );
    if ( $slug === '' ) {
        return new WP_Error( 'invalid_name', 'Please enter a valid staff role name.', [ 'status' => 400 ] );
    }
    if ( get_role( $slug ) ) {
        return new WP_Error( 'staff_role_exists', 'A staff role with that name already exists.', [ 'status' => 409 ] );
    }

    // A staff role is a staff-portal classification, not an access level —
    // grant the same baseline capabilities as the built-in "staff" role.
    add_role( $slug, $name, [ 'read' => true, 'read_private_posts' => true ] );

    $custom_roles   = get_option( 'induction_custom_roles', [] );
    $custom_roles[] = $slug;
    update_option( 'induction_custom_roles', array_values( array_unique( $custom_roles ) ) );

    return rest_ensure_response( [ 'value' => $slug, 'label' => $name ] );
}

function induction_delete_staff_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $slug = sanitize_key( (string) $request['slug'] );

    if ( in_array( $slug, [ 'staff', 'induction_admin' ], true ) ) {
        return new WP_Error(
            'protected_role',
            'This staff role is built into the plugin and cannot be deleted.',
            [ 'status' => 400 ]
        );
    }
    if ( ! get_role( $slug ) ) {
        return new WP_Error( 'not_found', 'Staff role not found.', [ 'status' => 404 ] );
    }
    $holders = get_users( [ 'role' => $slug, 'fields' => 'ID', 'number' => 1 ] );
    if ( ! empty( $holders ) ) {
        return new WP_Error(
            'staff_role_in_use',
            'This staff role is still assigned to one or more staff members — reassign them first.',
            [ 'status' => 409 ]
        );
    }

    remove_role( $slug );

    $custom_roles = get_option( 'induction_custom_roles', [] );
    update_option( 'induction_custom_roles', array_values( array_diff( $custom_roles, [ $slug ] ) ) );

    return rest_ensure_response( [ 'removed' => $slug ] );
}

function induction_get_staff_list(): WP_REST_Response {
    $roles = array_keys( induction_assignable_roles() );
    if ( empty( $roles ) ) {
        return rest_ensure_response( [] );
    }
    $users = get_users( [ 'role__in' => $roles, 'number' => 200 ] );
    return rest_ensure_response( array_map( 'induction_format_staff_user', $users ) );
}

function induction_create_staff( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $name     = sanitize_text_field( (string) $request->get_param( 'name' ) );
    $username = sanitize_user( (string) $request->get_param( 'username' ), true );
    $email    = sanitize_email( (string) $request->get_param( 'email' ) );
    $role     = sanitize_key( (string) $request->get_param( 'role' ) );
    $password = (string) $request->get_param( 'password' );

    if ( $username === '' ) {
        return new WP_Error( 'invalid_username', 'Please enter a valid username.', [ 'status' => 400 ] );
    }
    if ( username_exists( $username ) ) {
        return new WP_Error( 'username_exists', 'That username is already taken.', [ 'status' => 409 ] );
    }
    if ( ! is_email( $email ) ) {
        return new WP_Error( 'invalid_email', 'A valid email address is required.', [ 'status' => 400 ] );
    }
    if ( email_exists( $email ) ) {
        return new WP_Error( 'email_exists', 'That email address is already registered.', [ 'status' => 409 ] );
    }
    $assignable = induction_assignable_roles();
    if ( ! isset( $assignable[ $role ] ) ) {
        return new WP_Error( 'invalid_role', 'Please choose a valid role.', [ 'status' => 400 ] );
    }
    if ( strlen( $password ) < 8 ) {
        return new WP_Error( 'weak_password', 'Password must be at least 8 characters.', [ 'status' => 400 ] );
    }

    $user_id = wp_insert_user( [
        'user_login'   => $username,
        'user_email'   => $email,
        'user_pass'    => $password,
        'display_name' => $name !== '' ? $name : $username,
        'role'         => $role,
    ] );

    if ( is_wp_error( $user_id ) ) {
        return new WP_Error( 'create_failed', $user_id->get_error_message(), [ 'status' => 400 ] );
    }

    induction_sync_user_into_role( $user_id, $role );

    return rest_ensure_response( induction_format_staff_user( get_user_by( 'id', $user_id ) ) );
}

// Picks up any modules already targeted at $role for a single user — used
// when a new staff member is created, or when an existing member's role
// changes, so they don't have to wait for an admin to re-touch that
// module's assignments before their due-date tracking starts.
function induction_sync_user_into_role( int $user_id, string $role ): void {
    $now     = current_time( 'mysql' );
    $modules = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
    ] );
    foreach ( $modules as $module_id ) {
        $targets = get_post_meta( $module_id, 'module_role_targets', true ) ?: [];
        if ( in_array( $role, $targets, true ) ) {
            $due_date = induction_calculate_due_date( $module_id, null, $now );
            induction_ensure_assignment_row( $user_id, $module_id, $due_date, $now );
        }
    }
}

// After a user's role changes, drops their tracked assignment for any
// module that was only reachable via a role they no longer have — unless
// the new role also covers it, or they're individually targeted on it.
function induction_prune_stale_role_assignments( int $user_id, array $old_roles, string $new_role ): void {
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    $modules = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
    ] );
    foreach ( $modules as $module_id ) {
        $targets = get_post_meta( $module_id, 'module_role_targets', true ) ?: [];
        if ( ! array_intersect( $old_roles, $targets ) ) {
            continue;
        }
        $covered_by_new = in_array( $new_role, $targets, true );
        $has_user       = in_array( 'user:' . $user_id, $targets, true );
        if ( ! $covered_by_new && ! $has_user ) {
            $wpdb->delete( $assignments_table, [ 'module_id' => $module_id, 'user_id' => $user_id ] );
        }
    }
}

function induction_delete_staff( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    require_once ABSPATH . 'wp-admin/includes/user.php';
    global $wpdb;

    $ids = array_filter( array_map( 'intval', (array) $request->get_param( 'user_ids' ) ) );
    if ( empty( $ids ) ) {
        return new WP_Error( 'no_users', 'No staff members selected.', [ 'status' => 400 ] );
    }

    $current    = get_current_user_id();
    $assignable = array_keys( induction_assignable_roles() );
    $removed    = [];

    foreach ( $ids as $id ) {
        if ( $id === $current ) {
            continue;
        }
        $user = get_user_by( 'id', $id );
        if ( ! $user
            || in_array( 'administrator', (array) $user->roles, true )
            || ! array_intersect( $user->roles, $assignable ) ) {
            continue;
        }
        if ( wp_delete_user( $id, $current ) ) {
            foreach ( [ 'induction_progress', 'induction_quiz_responses', 'induction_assignments' ] as $table ) {
                $wpdb->delete( $wpdb->prefix . $table, [ 'user_id' => $id ] );
            }
            $removed[] = $id;
        }
    }

    return rest_ensure_response( [ 'removed' => $removed ] );
}

function induction_get_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $user = get_user_by( 'id', (int) $request['id'] );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }
    return rest_ensure_response( induction_format_staff_user( $user ) );
}

function induction_update_staff_role( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $role = sanitize_key( (string) $request->get_param( 'role' ) );

    $user = get_user_by( 'id', $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }
    if ( $id === get_current_user_id() ) {
        return new WP_Error( 'cannot_change_own_role', 'You cannot change your own role.', [ 'status' => 400 ] );
    }
    if ( in_array( 'administrator', (array) $user->roles, true ) ) {
        return new WP_Error( 'cannot_change_admin', 'Administrator roles cannot be changed here.', [ 'status' => 400 ] );
    }
    $assignable = induction_assignable_roles();
    if ( ! isset( $assignable[ $role ] ) ) {
        return new WP_Error( 'invalid_role', 'Please choose a valid role.', [ 'status' => 400 ] );
    }

    $old_roles = $user->roles;
    $user->set_role( $role );

    induction_sync_user_into_role( $id, $role );
    induction_prune_stale_role_assignments( $id, $old_roles, $role );

    return rest_ensure_response( induction_format_staff_user( get_user_by( 'id', $id ) ) );
}

function induction_update_team_profile( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $user = get_user_by( 'id', $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }

    $params = $request->get_json_params();

    // photo_media_id is nullable-by-omission: only touch it if the client
    // actually sent one (0 explicitly clears the photo; omitting the key
    // leaves whatever photo is already set untouched).
    if ( isset( $params['photo_media_id'] ) ) {
        update_user_meta( $id, 'induction_team_photo', (int) $params['photo_media_id'] );
    }
    if ( isset( $params['title'] ) ) {
        $title = sanitize_text_field( (string) $params['title'] );
        update_user_meta( $id, 'induction_team_title', induction_slash_meta( mb_substr( $title, 0, INDUCTION_TEAM_TITLE_MAX_LENGTH ) ) );
    }
    if ( isset( $params['region'] ) ) {
        $region = sanitize_text_field( (string) $params['region'] );
        update_user_meta( $id, 'induction_team_region', induction_slash_meta( mb_substr( $region, 0, INDUCTION_TEAM_REGION_MAX_LENGTH ) ) );
    }
    if ( isset( $params['bio'] ) ) {
        $bio = sanitize_textarea_field( (string) $params['bio'] );
        update_user_meta( $id, 'induction_team_bio', induction_slash_meta( mb_substr( $bio, 0, INDUCTION_TEAM_BIO_MAX_LENGTH ) ) );
    }
    if ( isset( $params['visible'] ) ) {
        update_user_meta( $id, 'induction_team_visible', $params['visible'] ? '1' : '' );
    }
    // Owner is a single slot, not a flag: promoting someone demotes whoever
    // held it, so the team page always has exactly zero or one owner.
    if ( isset( $params['is_owner'] ) ) {
        if ( $params['is_owner'] ) {
            foreach ( induction_team_owner_ids() as $previous_id ) {
                if ( $previous_id !== $id ) {
                    delete_user_meta( $previous_id, 'induction_team_is_owner' );
                }
            }
            update_user_meta( $id, 'induction_team_is_owner', '1' );
        } else {
            delete_user_meta( $id, 'induction_team_is_owner' );
        }
    }

    return rest_ensure_response( induction_format_staff_user( get_user_by( 'id', $id ) ) );
}

// Every user currently flagged as the owner. Normally zero or one, but the
// query copes with more so a hand-edited database still resolves cleanly.
function induction_team_owner_ids(): array {
    return array_map( 'intval', get_users( [
        'meta_key'   => 'induction_team_is_owner',
        'meta_value' => '1',
        'fields'     => 'ID',
        'number'     => 50,
    ] ) );
}

function induction_get_team(): WP_REST_Response {
    $wp_role_names = wp_roles()->get_names();
    $users = get_users( [
        'meta_key'   => 'induction_team_visible',
        'meta_value' => '1',
        'number'     => INDUCTION_TEAM_MAX_ENTRIES,
        'orderby'    => 'display_name',
        'order'      => 'ASC',
    ] );

    $result = array_map( function ( WP_User $user ) use ( $wp_role_names ) {
        $photo_id = (int) get_user_meta( $user->ID, 'induction_team_photo', true );

        // The job title is the label; the WP role is only a fallback so profiles
        // published before the title field existed don't lose their label.
        $title = trim( (string) get_user_meta( $user->ID, 'induction_team_title', true ) );
        if ( '' === $title ) {
            $role_labels = array_map( fn( $r ) => $wp_role_names[ $r ] ?? $r, (array) $user->roles );
            $title       = implode( ', ', $role_labels );
        }

        return [
            'id'        => $user->ID,
            'name'      => $user->display_name,
            'roleLabel' => $title,
            'region'    => (string) get_user_meta( $user->ID, 'induction_team_region', true ),
            'photoUrl'  => $photo_id ? ( wp_get_attachment_image_url( $photo_id, 'medium' ) ?: '' ) : '',
            'bio'       => (string) get_user_meta( $user->ID, 'induction_team_bio', true ),
            'isOwner'   => (bool) get_user_meta( $user->ID, 'induction_team_is_owner', true ),
        ];
    }, $users );

    return rest_ensure_response( $result );
}

// ─── Locations ──────────────────────────────────────────────────────────────

function induction_format_location( WP_Post $post ): array {
    $thumbnail_id = (int) get_post_meta( $post->ID, 'location_thumbnail_id', true );
    return [
        'id'            => $post->ID,
        'title'         => $post->post_title,
        'status'        => $post->post_status,
        'address'       => (string) get_post_meta( $post->ID, 'location_address', true ),
        'lat'           => (float) get_post_meta( $post->ID, 'location_lat', true ),
        'lng'           => (float) get_post_meta( $post->ID, 'location_lng', true ),
        'zoom'          => (int) get_post_meta( $post->ID, 'location_zoom', true ) ?: 17,
        'thumbnail_id'  => $thumbnail_id,
        // Resolved here so the SPA doesn't need a second round trip per image.
        'thumbnail_url' => $thumbnail_id ? ( wp_get_attachment_image_url( $thumbnail_id, 'medium' ) ?: '' ) : '',
        'notes'         => (string) get_post_meta( $post->ID, 'location_notes', true ),
        'markers'       => (string) ( get_post_meta( $post->ID, 'location_markers', true ) ?: '[]' ),
        'paths'         => (string) ( get_post_meta( $post->ID, 'location_paths', true ) ?: '[]' ),
    ];
}

// Writes only the fields actually present in the request, each through the same
// sanitizer its meta registration uses.
function induction_save_location_meta( int $id, array $params ): void {
    if ( isset( $params['address'] ) ) {
        update_post_meta( $id, 'location_address', induction_slash_meta( sanitize_text_field( (string) $params['address'] ) ) );
    }
    if ( isset( $params['lat'] ) ) {
        update_post_meta( $id, 'location_lat', max( -90, min( 90, (float) $params['lat'] ) ) );
    }
    if ( isset( $params['lng'] ) ) {
        update_post_meta( $id, 'location_lng', max( -180, min( 180, (float) $params['lng'] ) ) );
    }
    if ( isset( $params['zoom'] ) ) {
        update_post_meta( $id, 'location_zoom', max( 1, min( 22, (int) $params['zoom'] ) ) );
    }
    if ( isset( $params['thumbnail_id'] ) ) {
        update_post_meta( $id, 'location_thumbnail_id', (int) $params['thumbnail_id'] );
    }
    if ( isset( $params['notes'] ) ) {
        update_post_meta( $id, 'location_notes', induction_slash_meta( wp_kses_post( (string) $params['notes'] ) ) );
    }
    if ( isset( $params['markers'] ) ) {
        update_post_meta( $id, 'location_markers', induction_slash_meta( induction_sanitize_markers_json( (string) $params['markers'] ) ) );
    }
    if ( isset( $params['paths'] ) ) {
        update_post_meta( $id, 'location_paths', induction_slash_meta( induction_sanitize_paths_json( (string) $params['paths'] ) ) );
    }
}

function induction_get_locations( WP_REST_Request $request ): WP_REST_Response {
    // Only an admin sees drafts; staff get the published set regardless of what
    // they ask for.
    $wants_all = 'any' === $request->get_param( 'status' ) && induction_is_admin_user();

    $posts = get_posts( [
        'post_type'      => 'induction_location',
        'post_status'    => $wants_all ? [ 'publish', 'draft' ] : 'publish',
        'posts_per_page' => 200,
        'orderby'        => 'title',
        'order'          => 'ASC',
    ] );

    return rest_ensure_response( array_map( 'induction_format_location', $posts ) );
}

function induction_get_location( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $post = get_post( (int) $request['id'] );
    if ( ! $post || 'induction_location' !== $post->post_type ) {
        return new WP_Error( 'not_found', 'Location not found.', [ 'status' => 404 ] );
    }
    if ( 'publish' !== $post->post_status && ! induction_is_admin_user() ) {
        return new WP_Error( 'not_found', 'Location not found.', [ 'status' => 404 ] );
    }
    return rest_ensure_response( induction_format_location( $post ) );
}

function induction_create_location( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $params = $request->get_json_params() ?: [];

    $id = wp_insert_post( [
        'post_type'   => 'induction_location',
        'post_title'  => sanitize_text_field( (string) ( $params['title'] ?? '' ) ),
        'post_status' => 'publish' === ( $params['status'] ?? 'draft' ) ? 'publish' : 'draft',
    ], true );

    if ( is_wp_error( $id ) ) {
        return $id;
    }

    induction_save_location_meta( (int) $id, $params );
    return rest_ensure_response( induction_format_location( get_post( $id ) ) );
}

function induction_update_location( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $post = get_post( $id );
    if ( ! $post || 'induction_location' !== $post->post_type ) {
        return new WP_Error( 'not_found', 'Location not found.', [ 'status' => 404 ] );
    }

    $params  = $request->get_json_params() ?: [];
    $updates = [ 'ID' => $id ];
    if ( isset( $params['title'] ) ) {
        $updates['post_title'] = sanitize_text_field( (string) $params['title'] );
    }
    if ( isset( $params['status'] ) ) {
        $updates['post_status'] = 'publish' === $params['status'] ? 'publish' : 'draft';
    }
    if ( count( $updates ) > 1 ) {
        $result = wp_update_post( $updates, true );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
    }

    induction_save_location_meta( $id, $params );
    return rest_ensure_response( induction_format_location( get_post( $id ) ) );
}

function induction_delete_location( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $post = get_post( $id );
    if ( ! $post || 'induction_location' !== $post->post_type ) {
        return new WP_Error( 'not_found', 'Location not found.', [ 'status' => 404 ] );
    }
    if ( ! wp_delete_post( $id, true ) ) {
        return new WP_Error( 'delete_failed', 'Could not delete the location.', [ 'status' => 500 ] );
    }
    return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
}

// ─── Training Reminders ─────────────────────────────────────────────────────

// A staff member's assigned-but-not-completed modules, soonest due date first
// and undated ones last. Reads the assignments table rather than the reports
// summary because reports only cover users in the `staff` role.
function induction_outstanding_assignments( int $user_id ): array {
    global $wpdb;
    $assignments = $wpdb->prefix . 'induction_assignments';
    $progress    = $wpdb->prefix . 'induction_progress';

    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT a.module_id, a.due_date
         FROM $assignments a
         LEFT JOIN $progress p
           ON p.user_id = a.user_id AND p.module_id = a.module_id
         WHERE a.user_id = %d
           AND ( p.status IS NULL OR p.status <> 'completed' )
         ORDER BY a.due_date IS NULL ASC, a.due_date ASC",
        $user_id
    ), ARRAY_A ) ?? [];

    // Compared as MySQL datetime strings, the same way induction_get_overdue()
    // does it in SQL — strtotime() against a WP-local datetime would reintroduce
    // the usual site-timezone-vs-PHP-timezone mismatch.
    $now = current_time( 'mysql' );

    $modules = array_map( function ( $row ) use ( $now ) {
        $module_id = (int) $row['module_id'];
        // An assignment row outlives the module it points at, so skip anything
        // that has since been deleted or unpublished.
        if ( get_post_status( $module_id ) !== 'publish' ) {
            return null;
        }
        return [
            'module_id'  => $module_id,
            'title'      => get_the_title( $module_id ) ?: '(Untitled)',
            'due_date'   => $row['due_date'],
            'is_overdue' => $row['due_date'] && $row['due_date'] < $now,
        ];
    }, $rows );

    return array_values( array_filter( $modules ) );
}

// Where the SPA actually lives: the first published post embedding the
// [induction_portal] shortcode. There's no stored setting for it, and a
// reminder without a link to act on is close to useless, so find it.
function induction_portal_page_url(): string {
    global $wpdb;
    $like    = '%' . $wpdb->esc_like( '[induction_portal]' ) . '%';
    $page_id = (int) $wpdb->get_var( $wpdb->prepare(
        "SELECT ID FROM $wpdb->posts
         WHERE post_status = 'publish' AND post_content LIKE %s
         ORDER BY ID ASC LIMIT 1",
        $like
    ) );

    return $page_id ? (string) get_permalink( $page_id ) : home_url( '/' );
}

// Everything the SPA needs to compose a reminder for this staff member. The
// email itself is drafted in the browser (see util/reminderEmail.ts) so the
// admin can edit it before sending — this endpoint supplies the facts, not
// the wording. Due dates are pre-formatted with the site's own date_format so
// the draft matches dates shown everywhere else.
function induction_get_reminder_context( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $user = get_user_by( 'id', $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }

    $outstanding = induction_outstanding_assignments( $id );
    $date_format = get_option( 'date_format' );

    return rest_ensure_response( [
        'name'          => $user->display_name,
        'email'         => is_email( $user->user_email ) ? $user->user_email : '',
        'site_name'     => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
        'portal_url'    => induction_portal_page_url(),
        'overdue_count' => count( array_filter( $outstanding, fn( $m ) => $m['is_overdue'] ) ),
        'modules'       => array_map( fn( $m ) => [
            'module_id'  => $m['module_id'],
            'title'      => $m['title'],
            'due_date'   => $m['due_date'],
            'due_label'  => $m['due_date'] ? mysql2date( $date_format, $m['due_date'] ) : '',
            'is_overdue' => $m['is_overdue'],
        ], $outstanding ),
    ] );
}

// Sends the subject and body the admin composed and edited in the SPA. This
// endpoint deliberately does not compose anything: whatever the admin approved
// in the dialog is what goes out.
function induction_send_training_reminder( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $user = get_user_by( 'id', $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }
    if ( ! is_email( $user->user_email ) ) {
        return new WP_Error(
            'no_email',
            sprintf( '%s has no email address on file.', $user->display_name ),
            [ 'status' => 400 ]
        );
    }

    $params  = $request->get_json_params();
    $subject = trim( sanitize_text_field( (string) ( $params['subject'] ?? '' ) ) );

    // The body arrives as rich-text HTML from the compose dialog. wp_kses_post()
    // is the gate on it: an induction_admin isn't a full administrator and has
    // no business mailing scripts or arbitrary markup out under the site's name.
    $body = trim( wp_kses_post( (string) ( $params['body'] ?? '' ) ) );

    if ( '' === $subject || '' === trim( wp_strip_all_tags( $body ) ) ) {
        return new WP_Error(
            'empty_email',
            'A subject and a message are both required.',
            [ 'status' => 400 ]
        );
    }

    $sent = wp_mail(
        $user->user_email,
        mb_substr( $subject, 0, INDUCTION_REMINDER_SUBJECT_MAX_LENGTH ),
        $body,
        [ 'Content-Type: text/html; charset=UTF-8' ]
    );

    if ( ! $sent ) {
        return new WP_Error(
            'send_failed',
            'WordPress could not send the email. Check the site\'s mail configuration.',
            [ 'status' => 500 ]
        );
    }

    return rest_ensure_response( [
        'sent'  => true,
        'email' => $user->user_email,
    ] );
}

function induction_format_module( WP_Post $post ): array {
    $blocks_json = get_post_meta( $post->ID, 'module_blocks', true ) ?: '[]';
    if ( ! current_user_can( 'manage_induction' ) ) {
        $blocks_json = induction_strip_answers_from_blocks_json( $blocks_json );
    }
    return [
        'id'       => $post->ID,
        'title'    => [ 'raw' => $post->post_title,   'rendered' => $post->post_title ],
        'content'  => [ 'raw' => $post->post_content, 'rendered' => $post->post_content ],
        'excerpt'  => [ 'raw' => $post->post_excerpt, 'rendered' => $post->post_excerpt ],
        'status'   => $post->post_status,
        'date'     => $post->post_date,
        'modified' => $post->post_modified,
        'meta'     => [
            'module_role_targets'      => get_post_meta( $post->ID, 'module_role_targets', true ) ?: [],
            'module_estimated_minutes' => (int) get_post_meta( $post->ID, 'module_estimated_minutes', true ),
            'module_order'             => (int) get_post_meta( $post->ID, 'module_order', true ),
            'module_duration_days'     => (int) get_post_meta( $post->ID, 'module_duration_days', true ),
            'module_blocks'            => $blocks_json,
            'module_icon'              => get_post_meta( $post->ID, 'module_icon', true ) ?: '',
            'module_hero_image'        => (int) get_post_meta( $post->ID, 'module_hero_image', true ),
        ],
    ];
}

function induction_save_module_meta( int $id, array $meta ): true|WP_Error {
    // Validate module_blocks before writing anything: a malformed/truncated
    // payload must never be allowed to silently overwrite the sections that
    // are already saved on the post.
    $decoded_blocks = null;
    if ( isset( $meta['module_blocks'] ) ) {
        $decoded_blocks = json_decode( (string) $meta['module_blocks'], true );
        if ( ! is_array( $decoded_blocks ) || json_last_error() !== JSON_ERROR_NONE ) {
            return new WP_Error(
                'induction_invalid_module_blocks',
                'Module content was not saved because the submitted section data was not valid JSON.',
                [ 'status' => 400 ]
            );
        }
    }

    if ( isset( $meta['module_role_targets'] ) ) {
        update_post_meta( $id, 'module_role_targets', (array) $meta['module_role_targets'] );
    }
    if ( isset( $meta['module_estimated_minutes'] ) ) {
        update_post_meta( $id, 'module_estimated_minutes', (int) $meta['module_estimated_minutes'] );
    }
    if ( isset( $meta['module_order'] ) ) {
        update_post_meta( $id, 'module_order', (int) $meta['module_order'] );
    }
    if ( isset( $meta['module_duration_days'] ) ) {
        update_post_meta( $id, 'module_duration_days', (int) $meta['module_duration_days'] );
    }
    if ( $decoded_blocks !== null ) {
        // Belt-and-suspenders against silent wipes: something upstream of
        // this function (observed in practice: Wordfence's WAF stripping
        // attribute="value"-looking content — e.g. the style="..." attributes
        // any pasted-from-Office/OneNote rich text is full of — from POST
        // bodies hitting this custom REST namespace, while leaving the
        // request otherwise looking like a normal 200) can turn a legitimate
        // edit into an empty array before it ever reaches PHP validation. A
        // save that would drop an existing module from having sections to
        // having none is far more likely to be corruption than intent — a
        // real "delete everything" is done section-by-section, not via a
        // single whole-module save.
        $existing_raw     = get_post_meta( $id, 'module_blocks', true );
        $existing_decoded = $existing_raw ? json_decode( $existing_raw, true ) : [];
        $existing_count   = is_array( $existing_decoded ) ? count( $existing_decoded ) : 0;
        if ( $existing_count > 0 && count( $decoded_blocks ) === 0 ) {
            return new WP_Error(
                'induction_blocks_wipe_rejected',
                'Module content was not saved: the submitted section data was empty even though this module currently has saved sections. This looks like the request was corrupted in transit rather than an intentional edit. If you really want to remove every section, delete them one at a time instead.',
                [ 'status' => 409 ]
            );
        }
        // Encode BEFORE writing, and refuse the save if it can't be encoded at
        // all: storing the result unchecked is what turned a failed encode into
        // an emptied module.
        $encoded_blocks = induction_encode_meta_json( $decoded_blocks );
        if ( null === $encoded_blocks ) {
            return new WP_Error(
                'induction_blocks_encode_failed',
                'Module content was not saved: the submitted section data could not be encoded for storage. Nothing was changed.',
                [ 'status' => 500 ]
            );
        }
        update_post_meta( $id, 'module_blocks', induction_slash_meta( $encoded_blocks ) );
    }
    if ( isset( $meta['module_icon'] ) ) {
        update_post_meta( $id, 'module_icon', induction_slash_meta( sanitize_text_field( (string) $meta['module_icon'] ) ) );
    }
    if ( isset( $meta['module_hero_image'] ) ) {
        update_post_meta( $id, 'module_hero_image', (int) $meta['module_hero_image'] );
    }
    return true;
}

function induction_get_modules(): WP_REST_Response {
    $posts = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => [ 'publish', 'draft' ],
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'module_order',
        'order'          => 'ASC',
    ] );
    return rest_ensure_response( array_map( 'induction_format_module', $posts ) );
}

function induction_get_module( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $post = get_post( (int) $request['id'] );
    if ( ! $post || $post->post_type !== 'induction_module' ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }
    return rest_ensure_response( induction_format_module( $post ) );
}

function induction_create_module( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $params = $request->get_json_params();
    $id     = wp_insert_post( [
        'post_type'    => 'induction_module',
        'post_title'   => sanitize_text_field( $params['title'] ?? '' ),
        'post_content' => wp_kses_post( $params['content'] ?? '' ),
        'post_excerpt' => sanitize_text_field( $params['excerpt'] ?? '' ),
        'post_status'  => in_array( $params['status'] ?? '', [ 'publish', 'draft' ], true ) ? $params['status'] : 'draft',
        'post_author'  => get_current_user_id(),
    ], true );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    $meta_result = induction_save_module_meta( $id, $params['meta'] ?? [] );
    if ( is_wp_error( $meta_result ) ) {
        return $meta_result;
    }
    return rest_ensure_response( induction_format_module( get_post( $id ) ) );
}

function induction_update_module( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $post = get_post( $id );
    if ( ! $post || $post->post_type !== 'induction_module' ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }
    $params = $request->get_json_params();
    $update = [ 'ID' => $id ];
    if ( isset( $params['title'] ) )   { $update['post_title']   = sanitize_text_field( $params['title'] ); }
    if ( isset( $params['content'] ) ) { $update['post_content'] = wp_kses_post( $params['content'] ); }
    if ( isset( $params['excerpt'] ) ) { $update['post_excerpt'] = sanitize_text_field( $params['excerpt'] ); }
    if ( isset( $params['status'] ) && in_array( $params['status'], [ 'publish', 'draft' ], true ) ) {
        $update['post_status'] = $params['status'];
    }
    $result = wp_update_post( $update, true );
    if ( is_wp_error( $result ) ) {
        return $result;
    }
    if ( isset( $params['meta'] ) ) {
        $meta_result = induction_save_module_meta( $id, $params['meta'] );
        if ( is_wp_error( $meta_result ) ) {
            return $meta_result;
        }
    }
    return rest_ensure_response( induction_format_module( get_post( $id ) ) );
}

function induction_delete_module( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $post = get_post( $id );
    if ( ! $post || $post->post_type !== 'induction_module' ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }
    $deleted = wp_delete_post( $id, true );
    if ( ! $deleted ) {
        return new WP_Error( 'delete_failed', 'Could not delete module.', [ 'status' => 500 ] );
    }
    return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
}

function induction_portal_shortcode(): string {
    if ( ! is_user_logged_in() ) {
        $login_url = wp_login_url( get_permalink() );
        return '<p>Please <a href="' . esc_url( $login_url ) . '">log in</a> to access the platform.</p>';
    }

    return '<div id="induction-app-root" style="min-height:100vh"></div>';
}

function induction_is_portal_page(): bool {
    if ( ! is_singular() ) {
        return false;
    }
    $post = get_post();
    return $post && has_shortcode( $post->post_content, 'induction_portal' );
}

// This page bypasses the theme entirely for the SPA (see portal-page.php),
// so wp_head() still pulls in third-party CSS/JS meant for the theme's own
// pages — none of which this page has any use for. Buffer wp_head() and
// strip the two known offenders out of this page only, rather than
// disabling them site-wide:
//   - MailerLite's universal.js: injected as raw markup (not via
//     wp_enqueue_script, so there's no handle to dequeue) and conflicts
//     with the SPA's own scripts.
//   - Elementor's global Kit CSS: a site-wide default stylesheet
//     (input[type=...], select, textarea { border / padding / width... })
//     that WordPress enqueues on every front-end page regardless of
//     whether that page has any Elementor content. It overrides the SPA's
//     MUI-styled inputs because a plain `input[type=text]` selector has
//     higher specificity than a single MUI class.
function induction_portal_render_head(): void {
    ob_start();
    wp_head();
    $head_output = ob_get_clean();
    $head_output = preg_replace_callback(
        '#<script\b[^>]*>.*?</script>#is',
        fn( $matches ) => ( stripos( $matches[0], 'mailerlite' ) !== false ) ? '' : $matches[0],
        $head_output
    );
    $head_output = preg_replace( '#<link\b[^>]*href=["\'][^"\']*elementor[^"\']*["\'][^>]*/?>#i', '', $head_output );
    $head_output = preg_replace_callback(
        '#<style\b[^>]*id=["\'][^"\']*elementor[^"\']*["\'][^>]*>.*?</style>#is',
        fn() => '',
        $head_output
    );
    echo $head_output;
}

function induction_portal_template( string $template ): string {
    if ( ! induction_is_portal_page() ) {
        return $template;
    }
    return INDUCTION_DIR . 'templates/portal-page.php';
}

function induction_maybe_enqueue_portal(): void {
    // No is_user_logged_in() gate here: the SPA authenticates with its own
    // JWT flow, not a WordPress session, so an anonymous visitor must still
    // get the bundle in order to see the SPA's own login screen. Gating on
    // a WP session (as this used to) sent them to wp-login.php instead —
    // the wrong login form for a JWT-only app.
    if ( ! induction_is_portal_page() ) {
        return;
    }

    $js_path  = INDUCTION_DIR . 'assets/app/app.js';
    $css_path = INDUCTION_DIR . 'assets/app/app.css';

    if ( ! file_exists( $js_path ) ) {
        return;
    }

    wp_enqueue_script( 'induction-app', INDUCTION_URL . 'assets/app/app.js', [], filemtime( $js_path ), true );

    if ( file_exists( $css_path ) ) {
        wp_enqueue_style( 'induction-app', INDUCTION_URL . 'assets/app/app.css', [], filemtime( $css_path ) );
    }

    wp_localize_script( 'induction-app', 'InductionApp', [
        'restUrl' => esc_url_raw( rest_url() ),
    ] );
}
