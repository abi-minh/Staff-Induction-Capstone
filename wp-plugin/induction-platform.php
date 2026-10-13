<?php
/**
 * Plugin Name: Induction Platform
 * Description: Staff induction portal — registers custom post types, REST endpoints, and embeds the React portal via shortcode.
 * Version:     1.25.0
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
define( 'INDUCTION_VERSION', '1.25.0' );

// "Meet Our Team" limits. These are enforced server-side as well as in the admin
// UI, so a direct REST call cannot store text the team page can't lay out.
define( 'INDUCTION_TEAM_TITLE_MAX_LENGTH',  60 );
define( 'INDUCTION_TEAM_REGION_MAX_LENGTH', 60 );
define( 'INDUCTION_TEAM_BIO_MAX_LENGTH',    280 );
define( 'INDUCTION_TEAM_MAX_ENTRIES',       200 );

// Reminder emails are composed in the SPA, so the subject arrives as free text.
define( 'INDUCTION_REMINDER_SUBJECT_MAX_LENGTH', 200 );

// Ceiling on one bulk reminder send. High enough for a whole roster, low
// enough that a single request can't sit there firing wp_mail() indefinitely
// and time out halfway through with no record of who was reached.
define( 'INDUCTION_REMINDER_BULK_MAX', 200 );

// Ceiling on how many graders one quiz submission mails. A site with more
// induction admins than this has a bigger problem than an unnotified grader,
// and a student clicking Submit must never sit through an unbounded mail loop.
define( 'INDUCTION_QUIZ_REVIEW_NOTIFY_MAX', 25 );

// Resource categories. One bucket ships with the plugin and cannot be deleted,
// so the library is never in a state where an upload has nowhere to go. The
// ceiling exists because these render as a filter strip, not a search box —
// past a few dozen, filtering by category stops being faster than searching.
define( 'INDUCTION_RESOURCE_CATEGORY_DEFAULT',       'module-resources' );
define( 'INDUCTION_RESOURCE_CATEGORY_DEFAULT_LABEL', 'Module Resources' );
define( 'INDUCTION_RESOURCE_CATEGORY_LABEL_MAX_LENGTH', 60 );
define( 'INDUCTION_RESOURCE_CATEGORY_MAX', 40 );

// Staff profiles. The photo is uploaded through our own endpoint rather than
// wp/v2/media because the staff role deliberately has no upload_files
// capability — see induction_upload_profile_photo().
define( 'INDUCTION_PROFILE_PHOTO_MAX_BYTES',   4 * 1024 * 1024 );
define( 'INDUCTION_PROFILE_NAME_MAX_LENGTH',   60 );
define( 'INDUCTION_PROFILE_SUBURB_MAX_LENGTH', 80 );
define( 'INDUCTION_PROFILE_ADDRESS_MAX_LENGTH', 200 );
define( 'INDUCTION_CONTACT_PHONE_MAX_LENGTH',    40 );

// How many content snapshots to keep per module. Deep enough to undo a bad
// session's work, shallow enough that a large module's history stays bounded.
define( 'INDUCTION_MODULE_VERSION_LIMIT', 30 );

// Backup / migration. Bump the format version when the shape of content.json changes.
define( 'INDUCTION_EXPORT_FORMAT',                'induction-platform-export' );
define( 'INDUCTION_EXPORT_FORMAT_VERSION',        2 );
// Long enough to cover a download that is interrupted and resumed more than
// once. Ten minutes was shorter than a single attempt at a large export, so a
// resume arrived after the link had already expired. Refreshed on every
// partial delivery, so the window follows an active download rather than the
// moment the link was issued.
define( 'INDUCTION_EXPORT_LINK_TTL',              2 * HOUR_IN_SECONDS );
define( 'INDUCTION_EXPORT_REPORT_EVERY',          8 * 1024 * 1024 );
define( 'INDUCTION_TRANSFER_DISK_MARGIN',         256 * 1024 * 1024 );
define( 'INDUCTION_IMPORT_STEP_SECONDS',          5 );
define( 'INDUCTION_IMPORT_URL_TIMEOUT',           30 );
define( 'INDUCTION_IMPORT_KEEP_UNFINISHED_DAYS',  30 );
define( 'INDUCTION_IMPORT_ARCHIVE',               'archive.zip' );
define( 'INDUCTION_MEDIA_ID_KEYS',                [ 'mediaId', 'imageMediaId', 'heroImage', 'heroImageMediaId' ] );

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
add_action( 'init',            'induction_migrate_legacy_modules', 20 );
add_action( 'init',            'induction_migrate_resource_categories', 21 );
add_action( 'init',            'induction_register_user_meta' );
add_action( 'admin_init',      'induction_migrate_profile_photos' );
add_action( 'rest_api_init',   'induction_migrate_profile_photos' );
add_action( 'rest_api_init',   'induction_register_routes' );
add_action( 'wp_enqueue_scripts', 'induction_maybe_enqueue_portal' );
add_action( 'wp_enqueue_scripts', 'induction_portal_dequeue_third_party', 100 );
add_action( 'plugins_loaded',  'induction_create_tables' );
add_filter( 'template_include', 'induction_portal_template' );
add_shortcode( 'induction_portal', 'induction_portal_shortcode' );
// A document's category is the writable surface; the category stamped on its
// file is what the library filters on. Hooked on the meta write rather than on
// save_post because the REST posts controller writes meta *after* save_post
// fires, which would leave the mirror reading the previous value.
add_action( 'added_post_meta',   'induction_mirror_document_category', 10, 3 );
add_action( 'updated_post_meta', 'induction_mirror_document_category', 10, 3 );
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
        // map_meta_cap is false by default, and with capability_type 'post'
        // that leaves cap->edit_post as the literal primitive 'edit_post' -
        // singular, which no WordPress role holds; roles carry the plural
        // 'edit_posts'. Every custom-field write goes through
        // map_meta_cap('edit_post_meta'), which resolves 'edit_post' first, so
        // without this every meta update returned "Sorry, you are not allowed
        // to edit the <key> custom field" for everyone, administrators
        // included. That was the location_lat 403, and the same 403 on
        // document_category / document_file_id / document_role_targets.
        'map_meta_cap' => true,
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
        // map_meta_cap is false by default, and with capability_type 'post'
        // that leaves cap->edit_post as the literal primitive 'edit_post' -
        // singular, which no WordPress role holds; roles carry the plural
        // 'edit_posts'. Every custom-field write goes through
        // map_meta_cap('edit_post_meta'), which resolves 'edit_post' first, so
        // without this every meta update returned "Sorry, you are not allowed
        // to edit the <key> custom field" for everyone, administrators
        // included. That was the location_lat 403, and the same 403 on
        // document_category / document_file_id / document_role_targets.
        'map_meta_cap' => true,
    ] );

    register_post_meta( 'induction_document', 'document_category',     [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '',  'sanitize_callback' => 'sanitize_key', 'auth_callback' => $induction_auth ] );
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
        // map_meta_cap is false by default, and with capability_type 'post'
        // that leaves cap->edit_post as the literal primitive 'edit_post' -
        // singular, which no WordPress role holds; roles carry the plural
        // 'edit_posts'. Every custom-field write goes through
        // map_meta_cap('edit_post_meta'), which resolves 'edit_post' first, so
        // without this every meta update returned "Sorry, you are not allowed
        // to edit the <key> custom field" for everyone, administrators
        // included. That was the location_lat 403, and the same 403 on
        // document_category / document_file_id / document_role_targets.
        'map_meta_cap' => true,
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

    // One photo per person, used by the account settings page, the staff list
    // avatar and the Meet Our Team card alike. Replaces induction_team_photo,
    // whose values are migrated across once by
    // induction_migrate_profile_photos() — a separate "team photo" was two
    // sources of truth for the same face.
    register_meta( 'user', 'induction_profile_photo', [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0,  'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_dob',           [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '', 'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_suburb',        [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '', 'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_address',       [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '', 'auth_callback' => $induction_auth ] );

    // Public contact details for the featured owner's team card. Deliberately
    // separate from the account email: that one is a login credential, and the
    // address customers should use is usually a different, business one.
    // Admin-maintained, and only ever rendered on the owner's card.
    register_meta( 'user', 'induction_team_contact_email', [ 'type' => 'string', 'single' => true, 'show_in_rest' => true, 'default' => '', 'auth_callback' => $induction_auth ] );
    register_meta( 'user', 'induction_team_contact_phone', [ 'type' => 'string', 'single' => true, 'show_in_rest' => true, 'default' => '', 'auth_callback' => $induction_auth ] );
}

// Moves any existing Meet Our Team photo to the unified profile photo field.
// Runs once; guarded by an option so a plugin update doesn't redo it and
// clobber a photo someone has since changed.
function induction_migrate_profile_photos(): void {
    if ( get_option( 'induction_profile_photos_migrated' ) ) {
        return;
    }

    foreach ( get_users( [ 'meta_key' => 'induction_team_photo', 'fields' => 'ID', 'number' => 500 ] ) as $user_id ) {
        $existing = (int) get_user_meta( (int) $user_id, 'induction_profile_photo', true );
        $legacy   = (int) get_user_meta( (int) $user_id, 'induction_team_photo', true );
        if ( ! $existing && $legacy ) {
            update_user_meta( (int) $user_id, 'induction_profile_photo', $legacy );
        }
    }

    update_option( 'induction_profile_photos_migrated', 1 );
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
        // Required once map_meta_cap is on: editing or deleting a post that is
        // already published resolves through these, not through edit_posts.
        // Everything this plugin creates is published immediately, so without
        // them an admin could create a module and then not edit it.
        'edit_published_posts',
        'delete_published_posts',
        'edit_private_posts',
        'delete_private_posts',
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
            completed_sections LONGTEXT NULL,
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

    // Section completion used to live in each browser's localStorage, so it
    // was lost on a new device, shared between two people on one device, and
    // invisible to reporting. It belongs on the progress row rather than in a
    // table of its own: there is already exactly one row per user and module,
    // which is the grain this is recorded at.
    if ( ! in_array( 'completed_sections', $cols, true ) ) {
        $wpdb->query( "ALTER TABLE $progress_table ADD COLUMN completed_sections LONGTEXT NULL AFTER passed" );
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

    // Module content history — one row per distinct saved state of a module's
    // sections. Append-only: restoring writes forward rather than deleting, so
    // history can't be lost by using it. Its own table rather than post meta
    // because blocks_json is large and wp_postmeta is on far hotter paths.
    $versions_table = $wpdb->prefix . 'induction_module_versions';
    if ( $wpdb->get_var( "SHOW TABLES LIKE '$versions_table'" ) !== $versions_table ) {
        dbDelta( "CREATE TABLE $versions_table (
            id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            module_id     BIGINT UNSIGNED NOT NULL,
            version       INT UNSIGNED NOT NULL,
            blocks_json   LONGTEXT NOT NULL,
            blocks_hash   CHAR(40) NOT NULL,
            section_count INT UNSIGNED NOT NULL DEFAULT 0,
            author_id     BIGINT UNSIGNED NULL,
            created_at    DATETIME NOT NULL,
            UNIQUE KEY module_version (module_id, version),
            KEY idx_module_id (module_id)
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
            due_overridden TINYINT(1) NOT NULL DEFAULT 0,
            assigned_by  BIGINT UNSIGNED NULL,
            UNIQUE KEY user_module (user_id, module_id),
            KEY idx_user_id (user_id),
            KEY idx_module_id (module_id)
        ) $charset;" );
    }

    // due_overridden marks a picked date. Older rows count as picked unless they match assigned_at + duration.
    $cols = $wpdb->get_col( "DESCRIBE $assignments_table", 0 );
    if ( ! in_array( 'due_overridden', $cols, true ) ) {
        $wpdb->query( "ALTER TABLE $assignments_table ADD COLUMN due_overridden TINYINT(1) NOT NULL DEFAULT 0 AFTER due_date" );
        $wpdb->query(
            "UPDATE $assignments_table a
             LEFT JOIN {$wpdb->postmeta} d ON d.post_id = a.module_id AND d.meta_key = 'module_duration_days'
             SET a.due_overridden = 1
             WHERE a.due_date IS NOT NULL
               AND ( COALESCE( CAST( d.meta_value AS UNSIGNED ), 0 ) = 0
                     OR a.due_date <> DATE_ADD( a.assigned_at, INTERVAL CAST( d.meta_value AS UNSIGNED ) DAY ) )"
        );
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

    // POST /progress/sections — which sections a staff member has worked
    // through. Separate from the progress upsert so that recording a section
    // never has to restate status or time spent, and cannot accidentally
    // reopen a completed module.
    register_rest_route( $ns, '/progress/sections', [
        'methods'             => 'POST',
        'callback'            => 'induction_set_completed_sections',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'     => [ 'type' => 'integer', 'required' => true ],
            'module_id'   => [ 'type' => 'integer', 'required' => true ],
            'section_ids' => [ 'type' => 'array', 'required' => true, 'items' => [ 'type' => 'string' ] ],
        ],
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

    // POST /modules/order — set the order staff see modules in.
    register_rest_route( $ns, '/modules/order', [
        'methods'             => 'POST',
        'callback'            => 'induction_reorder_modules',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
        'args'                => [
            'ids' => [ 'type' => 'array', 'required' => true, 'items' => [ 'type' => 'integer' ] ],
        ],
    ] );

    // POST /assignments/due-date — move one person's deadline for one module.
    // Separate from the assign call on purpose: assigning is a bulk action
    // across many people, while a deadline is almost always moved for one
    // person who had a reason.
    register_rest_route( $ns, '/assignments/due-date', [
        'methods'             => 'POST',
        'callback'            => 'induction_set_assignment_due_date',
        'permission_callback' => fn() => current_user_can( 'manage_induction' ),
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
            'due_date'  => [ 'type' => 'string',  'required' => true ],
        ],
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

    register_rest_route( $ns, '/media', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_media',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/media/(?P<id>\d+)', [
        'methods'             => 'DELETE',
        'callback'            => 'induction_delete_media',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    register_rest_route( $ns, '/media/section-images', [
        'methods'             => 'GET',
        'callback'            => 'induction_count_linked_section_images',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/media/section-images/copy', [
        'methods'             => 'POST',
        'callback'            => 'induction_copy_linked_section_images',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // POST /media/{id}/category — file the attachment under a category
    register_rest_route( $ns, '/media/(?P<id>\d+)/category', [
        'methods'             => 'POST',
        'callback'            => 'induction_update_media_category',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    // Resource categories. Readable by any signed-in user, because the staff
    // portal renders the same filter strip the admin library does; only an
    // admin may change the list itself.
    register_rest_route( $ns, '/resource-categories', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_resource_categories',
            'permission_callback' => 'is_user_logged_in',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_create_resource_category',
            'permission_callback' => 'induction_is_admin_user',
        ],
    ] );

    register_rest_route( $ns, '/resource-categories/(?P<slug>[a-z0-9_-]+)/visibility', [
        'methods'             => 'POST',
        'callback'            => 'induction_set_resource_category_visibility',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/resource-categories/(?P<slug>[a-z0-9_-]+)', [
        [
            'methods'             => 'POST',
            'callback'            => 'induction_rename_resource_category',
            'permission_callback' => 'induction_is_admin_user',
        ],
        [
            'methods'             => 'DELETE',
            'callback'            => 'induction_delete_resource_category',
            'permission_callback' => 'induction_is_admin_user',
        ],
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

    // Backup / migration.
    register_rest_route( $ns, '/transfer/export/preflight', [
        'methods'             => 'GET',
        'callback'            => 'induction_export_preflight',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/export/prepare', [
        'methods'             => 'POST',
        'callback'            => 'induction_export_prepare',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/export', [
        'methods'             => 'GET',
        'callback'            => 'induction_export_site',
        'permission_callback' => 'induction_export_permission',
    ] );

    register_rest_route( $ns, '/transfer/export/status', [
        'methods'             => 'GET',
        'callback'            => 'induction_export_status',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/export/discard', [
        'methods'             => 'POST',
        'callback'            => 'induction_export_discard',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/chunk', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_chunk',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/begin', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_begin',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/select', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_select',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/step', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_step',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/status', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_status',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import/undo', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_undo',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    register_rest_route( $ns, '/transfer/import', [
        'methods'             => 'POST',
        'callback'            => 'induction_import_site',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // Module content history.
    register_rest_route( $ns, '/modules/(?P<id>\d+)/versions', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_module_versions',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
    ] );

    register_rest_route( $ns, '/modules/(?P<id>\d+)/versions/(?P<version>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_module_version',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [
            'id'      => [ 'type' => 'integer', 'required' => true ],
            'version' => [ 'type' => 'integer', 'required' => true ],
        ],
    ] );

    register_rest_route( $ns, '/modules/(?P<id>\d+)/versions/(?P<version>\d+)/restore', [
        'methods'             => 'POST',
        'callback'            => 'induction_restore_module_version',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [
            'id'      => [ 'type' => 'integer', 'required' => true ],
            'version' => [ 'type' => 'integer', 'required' => true ],
        ],
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

    // A staff member's own profile — the account settings page.
    register_rest_route( $ns, '/me/profile', [
        [
            'methods'             => 'GET',
            'callback'            => 'induction_get_my_profile',
            'permission_callback' => 'is_user_logged_in',
        ],
        [
            'methods'             => 'POST',
            'callback'            => 'induction_update_my_profile',
            'permission_callback' => 'is_user_logged_in',
        ],
    ] );

    register_rest_route( $ns, '/me/profile/photo', [
        'methods'             => 'POST',
        'callback'            => 'induction_upload_profile_photo',
        'permission_callback' => 'is_user_logged_in',
    ] );

    // GET  /staff/reminders/context — contexts for several staff at once
    register_rest_route( $ns, '/staff/reminders/context', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_reminder_contexts',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // POST /staff/reminders — send a batch of composed reminders
    register_rest_route( $ns, '/staff/reminders', [
        'methods'             => 'POST',
        'callback'            => 'induction_send_bulk_reminders',
        'permission_callback' => 'induction_is_admin_user',
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

/**
 * Record which sections of a module this person has worked through.
 *
 * Replaces the whole list rather than appending one id: the client holds the
 * set it is showing, and sending it whole means an unmark needs no second
 * endpoint and a lost response cannot leave the two out of step.
 *
 * Creates the progress row if there is not one yet — opening a module and
 * moving through it is itself the start of progress.
 */
function induction_set_completed_sections( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    global $wpdb;

    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );

    // Same rule the quiz endpoints use: your own progress, or an admin's.
    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_Error( 'rest_forbidden', 'That is not your progress to change.', [ 'status' => 403 ] );
    }

    $ids = array_values( array_unique( array_filter(
        array_map( 'strval', (array) $request->get_param( 'section_ids' ) ),
        static fn( $id ) => '' !== $id
    ) ) );

    $table = $wpdb->prefix . 'induction_progress';
    $now   = current_time( 'mysql' );
    $json  = wp_json_encode( $ids );

    $existing = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $table WHERE user_id = %d AND module_id = %d",
        $user_id,
        $module_id
    ), ARRAY_A );

    if ( $existing ) {
        $data = [ 'completed_sections' => $json, 'updated_at' => $now ];
        // Working through a section is progress, but a module already marked
        // completed stays completed — re-reading it must not reopen it.
        if ( 'not_started' === $existing['status'] ) {
            $data['status']     = 'in_progress';
            $data['started_at'] = $existing['started_at'] ?: $now;
        }
        $wpdb->update( $table, $data, [ 'id' => (int) $existing['id'] ] );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", (int) $existing['id'] ), ARRAY_A );
    } else {
        $wpdb->insert( $table, [
            'user_id'            => $user_id,
            'module_id'          => $module_id,
            'status'             => 'in_progress',
            'started_at'         => $now,
            'completed_sections' => $json,
            'created_at'         => $now,
            'updated_at'         => $now,
        ] );
        $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $wpdb->insert_id ), ARRAY_A );
    }

    return new WP_REST_Response( induction_format_progress_row( $row ) );
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

    $modules = induction_sort_modules_by_order( get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ] ) );

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
    $valid_roles = array_keys( induction_member_roles() );
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

// Re-syncing never moves an existing deadline, or overdue staff would drop off the report.
function induction_ensure_assignment_row( int $user_id, int $module_id, ?string $due_date, string $now, bool $explicit_due = false ): void {
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    $existing = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $assignments_table WHERE user_id = %d AND module_id = %d",
        $user_id, $module_id
    ) );
    if ( $existing ) {
        if ( $explicit_due && $due_date !== null ) {
            $wpdb->update( $assignments_table, [ 'due_date' => $due_date, 'due_overridden' => 1 ], [ 'id' => (int) $existing ] );
        }
    } else {
        $wpdb->insert( $assignments_table, [
            'user_id'        => $user_id,
            'module_id'      => $module_id,
            'assigned_at'    => $now,
            'due_date'       => $due_date,
            'due_overridden' => $explicit_due && $due_date !== null ? 1 : 0,
            'assigned_by'    => get_current_user_id(),
        ] );
    }
}

// Durations count from each person's assigned date. Picked dates stay put.
add_action( 'added_post_meta', 'induction_refresh_due_dates', 10, 4 );
add_action( 'updated_post_meta', 'induction_refresh_due_dates', 10, 4 );
add_action( 'deleted_post_meta', 'induction_refresh_due_dates', 10, 4 );

function induction_refresh_due_dates( $meta_id, $module_id, $meta_key, $meta_value ): void {
    if ( 'module_duration_days' !== $meta_key || 'induction_module' !== get_post_type( (int) $module_id ) ) {
        return;
    }
    global $wpdb;
    $table = $wpdb->prefix . 'induction_assignments';
    $days  = doing_action( 'deleted_post_meta' ) ? 0 : (int) $meta_value;
    if ( $days > 0 ) {
        $wpdb->query( $wpdb->prepare(
            "UPDATE $table SET due_date = DATE_ADD( assigned_at, INTERVAL %d DAY ) WHERE module_id = %d AND due_overridden = 0",
            $days,
            (int) $module_id
        ) );
    } else {
        $wpdb->query( $wpdb->prepare( "UPDATE $table SET due_date = NULL WHERE module_id = %d AND due_overridden = 0", (int) $module_id ) );
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
        induction_ensure_assignment_row( (int) $uid, $module_id, $due_date, $now, (bool) $explicit_due );
    }
}

/**
 * Move the due date on one person's assignment.
 *
 * Only ever touches the assignment row, never module_duration_days: the module
 * still says "14 days" for everyone else, and one person's extension does not
 * quietly become the new rule.
 *
 * An empty string clears the date, which is how an admin removes a deadline
 * that should not have been there.
 */
function induction_set_assignment_due_date( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    global $wpdb;

    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $raw       = trim( (string) $request->get_param( 'due_date' ) );

    $table = $wpdb->prefix . 'induction_assignments';
    $row   = $wpdb->get_var( $wpdb->prepare(
        "SELECT id FROM $table WHERE user_id = %d AND module_id = %d",
        $user_id,
        $module_id
    ) );

    if ( ! $row ) {
        return new WP_Error(
            'assignment_not_found',
            'That module is not assigned to this staff member, so it has no due date to move.',
            [ 'status' => 404 ]
        );
    }

    $due_date = null;
    if ( '' !== $raw ) {
        // The picker sends Y-m-d. Stored at the end of that day so a module due
        // "on the 15th" is not reported overdue at one minute past midnight on
        // the 15th — the overdue report compares due_date against now.
        if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m ) ) {
            return new WP_Error( 'invalid_due_date', 'Give the due date as YYYY-MM-DD.', [ 'status' => 400 ] );
        }
        if ( ! checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ) {
            return new WP_Error( 'invalid_due_date', 'That is not a real date.', [ 'status' => 400 ] );
        }
        $due_date = $raw . ' 23:59:59';
    }

    // due_overridden is set either way, including when the date is cleared.
    // Everything this endpoint does is a deliberate human decision, and
    // induction_refresh_due_dates() only recomputes rows that are not marked —
    // without this, editing the module's duration later would quietly undo an
    // extension, or resurrect a deadline an admin had removed on purpose.
    $wpdb->update(
        $table,
        [ 'due_date' => $due_date, 'due_overridden' => 1 ],
        [ 'id' => (int) $row ]
    );

    return new WP_REST_Response( [
        'user_id'   => $user_id,
        'module_id' => $module_id,
        'due_date'  => $due_date,
    ] );
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
        induction_ensure_assignment_row( $uid, $module_id, $due_date, $now, (bool) $request->get_param( 'due_date' ) );
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
    $targetable = induction_member_roles();
    if ( ! isset( $targetable[ $role ] ) ) {
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
    $modules = induction_sort_modules_by_order( get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ] ) );

    // Staff members that can be assigned modules
    $staff = get_users( [ 'role__in' => array_keys( induction_member_roles() ), 'number' => 500 ] );

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

    $total_staff       = count( $staff );
    $total_modules     = count( $modules );
    $total_completions = 0;
    $total_assignments = 0;

    $module_reports = [];

    foreach ( $modules as $module ) {
        $mid       = $module->ID;
        $targets   = get_post_meta( $mid, 'module_role_targets', true ) ?: [];
        $mod_prog  = $progress_index[ $mid ] ?? [];
        $completed = 0;
        $breakdown = [];

        foreach ( $staff as $user ) {
            $uid = (int) $user->ID;
            $is_assigned = in_array( 'user:' . $uid, $targets, true )
                || (bool) array_intersect( (array) $user->roles, $targets );
            if ( ! $is_assigned ) {
                continue;
            }
            $prog   = $mod_prog[ $uid ] ?? null;
            $status = $prog ? $prog['status'] : 'not_started';
            if ( $status === 'completed' ) {
                $completed++;
                $total_completions++;
            }
            $breakdown[] = [
                'user_id'      => $uid,
                'name'         => $user->display_name,
                'roles'        => array_values( (array) $user->roles ),
                'status'       => $status,
                'completed_at' => $prog ? ( $prog['completed_at'] ?: null ) : null,
            ];
        }

        $assigned_count     = count( $breakdown );
        $total_assignments += $assigned_count;

        $module_reports[] = [
            'module_id'       => $mid,
            'module_title'    => get_the_title( $mid ),
            'total_assigned'  => $assigned_count,
            'total_completed' => $completed,
            'completion_pct'  => $assigned_count > 0 ? (int) round( ( $completed / $assigned_count ) * 100 ) : 0,
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
        'overall_completion_pct' => $total_assignments > 0 ? (int) round( ( $total_completions / $total_assignments ) * 100 ) : 0,
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
    // short_answer is deliberately absent: a written answer is not something a
    // string comparison can judge. It is self-marked against guidance now, and
    // induction_quiz_check() returns before reaching here.
    return false;
}

/**
 * What a complete answer to a short-answer question should cover.
 *
 * Reads the new field, falling back to the old correctAnswer for questions
 * written while these were auto-marked — the text an author typed as "the
 * correct answer" is exactly the guidance a learner needs, so old content
 * keeps working without migrating any stored JSON.
 */
function induction_short_answer_guidance( array $quiz_block ): string {
    $data = $quiz_block['data'] ?? [];
    $guidance = trim( (string) ( $data['answerGuidance'] ?? '' ) );
    return '' !== $guidance ? $guidance : trim( (string) ( $data['correctAnswer'] ?? '' ) );
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
    $parsed = (array) ( json_decode( $blocks_json, true ) ?: [] );
    if ( empty( $parsed ) || ! induction_is_sections_format( $parsed ) ) {
        return false;
    }
    foreach ( $parsed as $section ) {
        if ( empty( $section['isModuleQuiz'] ) ) continue;
        foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
            if ( ( $b['id'] ?? null ) === $block_id ) return true;
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
    $parsed = (array) ( json_decode( $blocks_json, true ) ?: [] );
    if ( empty( $parsed ) || ! induction_is_sections_format( $parsed ) ) {
        return true;
    }
    foreach ( $parsed as $section ) {
        foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
            if ( ( $b['id'] ?? null ) !== $block_id ) continue;
            return ( $section['status'] ?? 'publish' ) === 'publish'
                && ( $section['quizStatus'] ?? 'publish' ) === 'publish';
        }
    }
    return false;
}

// Same idea, scoped to the module-level quiz specifically (used by
// quiz/submit-for-review, which has no single block_id to check against).
function induction_has_published_module_quiz( string $blocks_json ): bool {
    $parsed = (array) ( json_decode( $blocks_json, true ) ?: [] );
    if ( empty( $parsed ) || ! induction_is_sections_format( $parsed ) ) {
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

    // A short answer is recorded but not judged: is_correct stays NULL, which
    // this table already uses to mean "not graded". The learner gets the
    // guidance back and marks themselves against it.
    if ( ( $quiz_block['type'] ?? '' ) === 'short_answer' ) {
        induction_upsert_quiz_response( $table, $user_id, $module_id, $block_id, $answer, null );

        return new WP_REST_Response( [
            'isCorrect'   => null,
            'guidance'    => induction_short_answer_guidance( $quiz_block ),
            'explanation' => $quiz_block['data']['explanation'] ?? '',
        ] );
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

    // A submission already sitting in the grading queue has already been
    // mailed out. Re-submitting before anyone grades it — which the portal
    // allows, since the student can still edit their answers — must not mail
    // every grader a second time.
    $already_pending = $existing
        && null !== $existing['quiz_submitted_at']
        && null === $existing['passed'];

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

    // Mail is best-effort: the submission is recorded either way, and the
    // response reports how many graders were reached so a misconfigured
    // mailer shows up as a zero rather than as a lost submission.
    $student  = get_user_by( 'id', $user_id );
    $notified = ( ! $already_pending && $student )
        ? induction_send_quiz_review_notification( $student, $module_id )
        : 0;

    $response                      = induction_format_progress_row( $row );
    $response['reviewersNotified'] = $notified;

    return new WP_REST_Response( $response );
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
        $block['type'] = (string) ( $block['type'] ?? '' );
        $block['data'] = is_array( $block['data'] ?? null ) ? $block['data'] : [];
        $resp          = $answers_by_block[ $block_id ] ?? null;
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

// ─── Responsive image sources ───────────────────────────────────────────────
// Staff read modules on phones, and every image block stores WordPress's
// full-size URL — so a 4MB photo is downloaded to be displayed in a 375px
// column. This attaches the srcset WordPress already generated at upload time,
// letting the browser fetch a variant that fits. The full-size file is still
// what the image viewer opens, which is the one place it is wanted.
//
// Deliberately a sidecar map keyed by attachment ID rather than a srcset
// injected into each block: module_blocks is the field that has twice been
// emptied by a read/write round trip through this plugin, and nothing is worth
// deserialising and re-serialising it on the read path for. The client matches
// entries up by the mediaId the block already carries.
//
// wp_get_attachment_image_srcset() rather than assembling URLs by hand: it is
// filtered, so CDN and media-offload plugins rewrite it correctly, and it emits
// only the sizes that were actually generated.

add_filter( 'rest_prepare_induction_module', 'induction_attach_image_sources', 10, 3 );

function induction_attach_image_sources( WP_REST_Response $response, WP_Post $post, WP_REST_Request $request ): WP_REST_Response {
    $data = $response->get_data();

    // Read the blocks off the response, not the database: by the time this
    // runs, unpublished sections have already been stripped for staff, and
    // there is no reason to advertise sources for content they cannot see.
    $blocks = json_decode( (string) ( $data['meta']['module_blocks'] ?? '[]' ), true );
    $ids    = [];

    if ( is_array( $blocks ) ) {
        // One walk over the whole section tree. It picks up every key in
        // INDUCTION_MEDIA_ID_KEYS - content images, quiz images and section
        // heroes alike - and resolves upload URLs embedded in text back to
        // attachment ids, which the block-by-block version it replaced did not.
        induction_media_ids_in_value( $blocks, $ids, 'induction_attachment_id_from_url' );
    }

    $sources = [];
    foreach ( array_unique( array_filter( $ids ) ) as $id ) {
        $srcset = wp_get_attachment_image_srcset( (int) $id, 'large' );
        if ( ! $srcset ) {
            // One generated size, or none: the plain src is already the best
            // available and an entry here would say nothing.
            continue;
        }
        $sources[ (string) $id ] = [
            'srcset' => $srcset,
            'sizes'  => wp_get_attachment_image_sizes( (int) $id, 'large' ) ?: '100vw',
        ];
    }

    $data['image_sources'] = (object) $sources;
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
    induction_strip_answer_keys( $parsed );

    // '[]' rather than the original on failure: showing staff nothing is a
    // display bug, handing them the un-stripped answers is a real one.
    return induction_encode_meta_json( $parsed ) ?? '[]';
}

// Strips answer keys at any depth, whatever the shape, so malformed data can't leak them.
function induction_strip_answer_keys( array &$node ): void {
    // answerGuidance joins the answer keys: it is meant to be revealed after an
    // attempt, by the check endpoint, not sitting in the page source beforehand.
    unset( $node['correctIndex'], $node['correctAnswer'], $node['answerGuidance'] );
    foreach ( $node as &$child ) {
        if ( is_array( $child ) ) {
            induction_strip_answer_keys( $child );
        }
    }
    unset( $child );
}

// Judged by the first array element, so a junk first entry can't pass sections off as legacy.
function induction_is_sections_format( array $parsed ): bool {
    foreach ( $parsed as $item ) {
        if ( is_array( $item ) ) {
            return array_key_exists( 'quizBlocks', $item );
        }
    }
    return false;
}

// $module_quiz_only = true restricts collection to the section flagged as the
// module-level quiz (used for quiz/submit grading). false collects every
// section's quiz blocks (used for quiz/check, which grades any single question).
function induction_collect_quiz_blocks( string $blocks_json, bool $module_quiz_only = true ): array {
    $parsed      = (array) ( json_decode( $blocks_json, true ) ?: [] );
    $quiz_blocks = [];

    if ( ! empty( $parsed ) && induction_is_sections_format( $parsed ) ) {
        // Section[] format
        foreach ( $parsed as $section ) {
            if ( $module_quiz_only && empty( $section['isModuleQuiz'] ) ) continue;
            foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $b ) {
                // First occurrence, like induction_is_quiz_block_published().
                if ( is_array( $b ) && isset( $b['id'] ) && ! isset( $quiz_blocks[ $b['id'] ] ) ) {
                    $quiz_blocks[ $b['id'] ] = $b;
                }
            }
        }
    } else {
        // Flat Block[] format (legacy)
        foreach ( $parsed as $b ) {
            if ( is_array( $b ) && isset( $b['id'] ) && ! isset( $quiz_blocks[ $b['id'] ] ) && in_array( $b['type'] ?? '', [ 'multiple_choice', 'true_false' ], true ) ) {
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
    if ( ! is_array( $parsed ) || empty( $parsed ) ) {
        return $blocks_json;
    }

    // Per element, so a draft section among legacy blocks is still dropped.
    $visible = [];
    foreach ( $parsed as $section ) {
        if ( ! is_array( $section ) ) {
            continue;
        }
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

add_filter( 'rest_induction_document_query', 'induction_filter_portal_documents', 10, 2 );

function induction_filter_portal_documents( array $args, WP_REST_Request $request ): array {
    $admin = current_user_can( 'manage_induction' );

    // Managing, not reading. The Documents screen asks for context=edit and
    // has to see everything — including what is hidden, which is the whole
    // point of being able to unhide it. The staff portal asks for the default
    // view context, and an admin previewing the portal asks for exactly the
    // same thing, so the two are told apart by what they asked for rather
    // than by who is asking.
    if ( $admin && 'edit' === $request->get_param( 'context' ) ) {
        return $args;
    }

    // Visible only where an admin has said who it is for. The two clauses
    // that used to sit here — no meta at all, and an empty array — made the
    // absence of a decision mean "show everyone", so a document uploaded
    // outside this app, or saved before the field existed, was published to
    // all staff by default. Everyone is still a choice an admin can make; it
    // just has to be made.

    // Whose eyes to use. A staff member gets their own roles. An admin
    // previewing the portal gets the staff roles instead of their own —
    // filtering on "administrator" would show a library no staff member has,
    // and a preview that does not match what staff see is worse than no
    // preview, because it is believed.
    //
    // The staff set, not one chosen role: an admin checking the portal should
    // see anything at least one staff member can reach, so a document aimed
    // at a single custom role is still previewable. It does mean the preview
    // is the union rather than any one person's view — a role picker is what
    // that would need.
    $roles = $admin
        ? array_values( array_diff( array_keys( induction_assignable_roles() ), [ 'induction_admin' ] ) )
        : (array) wp_get_current_user()->roles;

    $clauses = [
        'relation' => 'OR',
        [ 'key' => 'document_role_targets', 'value' => '"all"', 'compare' => 'LIKE' ],
    ];
    foreach ( $roles as $role ) {
        $clauses[] = [ 'key' => 'document_role_targets', 'value' => '"' . $role . '"', 'compare' => 'LIKE' ];
    }
    $filters = [ $clauses ];

    // A hidden category takes its documents with it, whatever each one's own
    // audience says — and unlike audience, that is not relative to the
    // viewer, so it applies to an admin previewing the portal too. Without
    // this the preview showed shelves that had been taken down.
    //
    // NOT IN alone would also drop any document with no
    // category meta at all, because the row never joins — so the absence of a
    // category has to be spelled out as its own match.
    $hidden = induction_hidden_resource_categories();
    if ( $hidden ) {
        $filters[] = [
            'relation' => 'OR',
            [ 'key' => 'document_category', 'compare' => 'NOT EXISTS' ],
            [ 'key' => 'document_category', 'value' => '', 'compare' => '=' ],
            [ 'key' => 'document_category', 'value' => $hidden, 'compare' => 'NOT IN' ],
        ];
    }

    $existing = empty( $args['meta_query'] ) ? [] : [ $args['meta_query'] ];
    $args['meta_query'] = array_merge( [ 'relation' => 'AND' ], $existing, $filters );
    return $args;
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
        'completed_sections' => induction_decode_completed_sections( $row['completed_sections'] ?? null ),
    ];
}

/**
 * The section ids a staff member has worked through, as a list of strings.
 *
 * Tolerant on read: the column is JSON written by this plugin, but a row
 * predating the column, a half-written value, or anything that is not a list
 * of strings should read as "nothing completed" rather than break the portal
 * for that person.
 */
function induction_decode_completed_sections( $raw ): array {
    if ( ! is_string( $raw ) || '' === $raw ) {
        return [];
    }
    $decoded = json_decode( $raw, true );
    if ( ! is_array( $decoded ) ) {
        return [];
    }
    return array_values( array_filter( $decoded, 'is_string' ) );
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

// The user's own photo, or 0. Reads the unified field and falls back to the
// legacy team photo so a site that hasn't run the migration yet still shows a
// face rather than a placeholder.
function induction_profile_photo_id( int $user_id ): int {
    $id = (int) get_user_meta( $user_id, 'induction_profile_photo', true );
    return $id ?: (int) get_user_meta( $user_id, 'induction_team_photo', true );
}

function induction_profile_photo_url( int $user_id, string $size = 'medium' ): string {
    $id = induction_profile_photo_id( $user_id );
    return $id ? ( wp_get_attachment_image_url( $id, $size ) ?: '' ) : '';
}

function induction_format_staff_user( WP_User $user ): array {
    $photo_url = induction_profile_photo_url( $user->ID );
    return [
        'id'             => $user->ID,
        'name'           => $user->display_name,
        'slug'           => $user->user_login,
        'email'          => $user->user_email,
        'roles'          => $user->roles,
        // An uploaded photo wins over the Gravatar fallback everywhere the
        // staff list, detail page and portal show a face.
        'avatar_urls'    => [
            '48' => $photo_url ?: get_avatar_url( $user->ID, [ 'size' => 48 ] ),
            '96' => $photo_url ?: get_avatar_url( $user->ID, [ 'size' => 96 ] ),
        ],
        'first_name'     => (string) get_user_meta( $user->ID, 'first_name', true ),
        'last_name'      => (string) get_user_meta( $user->ID, 'last_name', true ),
        'dob'            => (string) get_user_meta( $user->ID, 'induction_dob', true ),
        'suburb'         => (string) get_user_meta( $user->ID, 'induction_suburb', true ),
        'address'        => (string) get_user_meta( $user->ID, 'induction_address', true ),
        'profile_photo_url' => $photo_url,
        'team_photo_url' => $photo_url,
        'team_title'     => (string) get_user_meta( $user->ID, 'induction_team_title', true ),
        'team_region'    => (string) get_user_meta( $user->ID, 'induction_team_region', true ),
        'team_bio'       => (string) get_user_meta( $user->ID, 'induction_team_bio', true ),
        'team_visible'   => (bool) get_user_meta( $user->ID, 'induction_team_visible', true ),
        'team_is_owner'  => (bool) get_user_meta( $user->ID, 'induction_team_is_owner', true ),
        'team_contact_email' => (string) get_user_meta( $user->ID, 'induction_team_contact_email', true ),
        'team_contact_phone' => (string) get_user_meta( $user->ID, 'induction_team_contact_phone', true ),
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

// Everyone the induction system treats as one of its own people: the
// assignable roles plus `administrator`. A WordPress admin is an induction
// admin by default — they already hold manage_induction (see
// induction_register_roles()), so they belong in the staff list, in the
// reports aggregate, and in the pool a module can be targeted at.
//
// Deliberately a separate list from induction_assignable_roles():
// `administrator` is a role this app recognises, never one it hands out.
// Keeping the two apart is what stops an induction_admin — who is not a full
// administrator — from minting one through Add Staff or Change Role.
function induction_member_roles(): array {
    $roles = induction_assignable_roles();
    $names = wp_roles()->get_names();
    if ( isset( $names['administrator'] ) ) {
        $roles['administrator'] = $names['administrator'];
    }
    return $roles;
}

function induction_get_roles(): WP_REST_Response {
    $assignable = induction_assignable_roles();
    $out        = [];
    foreach ( induction_member_roles() as $slug => $label ) {
        $out[] = [
            'value' => $slug,
            'label' => $label,
            // The pickers that *grant* a role (Add Staff, Change Role) filter
            // on this; the ones that merely *target* a role (a module's
            // Assigned Roles, a document's visibility) show every member role.
            'assignable' => isset( $assignable[ $slug ] ),
        ];
    }
    return rest_ensure_response( $out );
}

// Staff roles ("Fishing Instructor", "Office Admin") are plain custom
// WordPress roles — the same mechanism as the built-in "staff"/
// "induction_admin" roles, so they automatically show up everywhere
// induction_assignable_roles() is already used (Add Staff, Change Role) and
// everywhere induction_member_roles() builds on it (the Module Edit screen's
// Assigned Roles picker, the staff list, reporting) with no further wiring. The
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
    $roles = array_keys( induction_member_roles() );
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

    // Notifying is the default; an admin creating a placeholder account can
    // opt out. A failed send must not fail the request — the account exists,
    // and the response says whether the email went so the UI can say so too.
    $notify   = null === $request->get_param( 'notify' ) ? true : (bool) $request->get_param( 'notify' );
    $notified = $notify && induction_send_account_setup_email( get_user_by( 'id', $user_id ) );

    $response             = induction_format_staff_user( get_user_by( 'id', $user_id ) );
    $response['notified'] = $notified;

    return rest_ensure_response( $response );
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

    $current = get_current_user_id();
    $members = array_keys( induction_member_roles() );
    $removed = [];

    foreach ( $ids as $id ) {
        if ( $id === $current ) {
            continue;
        }
        $user = get_user_by( 'id', $id );
        if ( ! $user
            || in_array( 'administrator', (array) $user->roles, true )
            || ! array_intersect( $user->roles, $members ) ) {
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

function induction_media_type( string $mime ): string {
    if ( str_starts_with( $mime, 'image/' ) ) return 'image';
    if ( str_starts_with( $mime, 'video/' ) ) return 'video';
    if ( $mime === 'application/pdf' )         return 'pdf';
    return 'other';
}

function induction_collect_block_media( array $block, array $entry, callable $add ): void {
    $type = $block['type'] ?? '';
    if ( $type === 'image' || $type === 'video' ) {
        $add( $block['data']['mediaId'] ?? 0, $entry );
    } elseif ( $type === 'row' ) {
        foreach ( (array) ( $block['data']['children'] ?? [] ) as $child ) {
            if ( isset( $child['block'] ) && is_array( $child['block'] ) ) {
                induction_collect_block_media( $child['block'], $entry, $add );
            }
        }
    }
}

function induction_normalize_sections( $decoded ): array {
    if ( ! is_array( $decoded ) || empty( $decoded ) ) return [];
    if ( isset( $decoded[0]['blocks'] ) ) return $decoded;
    $quiz_types = [ 'multiple_choice', 'true_false', 'short_answer' ];
    $blocks = [];
    $quiz   = [];
    foreach ( $decoded as $b ) {
        if ( ! is_array( $b ) ) continue;
        if ( in_array( $b['type'] ?? '', $quiz_types, true ) ) $quiz[] = $b;
        else $blocks[] = $b;
    }
    return [ [ 'blocks' => $blocks, 'quizBlocks' => $quiz ] ];
}

function induction_media_ids_in_sections( array $sections ): array {
    $sections = induction_normalize_sections( $sections );
    $ids = [];
    $collect = function ( $block ) use ( &$ids, &$collect ): void {
        $type = $block['type'] ?? '';
        if ( $type === 'image' || $type === 'video' ) {
            $ids[] = (int) ( $block['data']['mediaId'] ?? 0 );
        } elseif ( $type === 'row' ) {
            foreach ( (array) ( $block['data']['children'] ?? [] ) as $child ) {
                if ( isset( $child['block'] ) && is_array( $child['block'] ) ) $collect( $child['block'] );
            }
        }
    };
    foreach ( $sections as $section ) {
        foreach ( (array) ( $section['blocks'] ?? [] ) as $b ) {
            if ( is_array( $b ) ) $collect( $b );
        }
        foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $qb ) {
            if ( ( $qb['type'] ?? '' ) === 'multiple_choice' ) $ids[] = (int) ( $qb['data']['imageMediaId'] ?? 0 );
        }
        $ids[] = (int) ( $section['heroImageMediaId'] ?? 0 );
    }
    return array_values( array_unique( array_filter( $ids, fn( $v ) => $v > 0 ) ) );
}

function induction_tag_media( array $ids ): void {
    foreach ( $ids as $id ) {
        $id = (int) $id;
        if ( $id > 0 && get_post_type( $id ) === 'attachment' ) {
            update_post_meta( $id, '_induction_media', 1 );
        }
    }
}

function induction_media_ids_in_html( string $html ): array {
    if ( '' === trim( $html ) ) return [];
    $ids = [];
    if ( preg_match_all( '/(?:src|href)=["\']([^"\']+)["\']/i', $html, $m ) ) {
        foreach ( $m[1] as $url ) {
            if ( strpos( $url, '/wp-content/uploads/' ) === false ) continue;
            $id = attachment_url_to_postid( $url );
            if ( $id ) $ids[] = (int) $id;
        }
    }
    return array_values( array_unique( $ids ) );
}

function induction_migrate_legacy_modules(): void {
    if ( get_option( 'induction_legacy_modules_migrated' ) ) {
        return;
    }
    $modules = get_posts( [ 'post_type' => 'induction_module', 'post_status' => 'any', 'posts_per_page' => -1 ] );
    foreach ( $modules as $m ) {
        $raw = get_post_meta( $m->ID, 'module_blocks', true );
        if ( ! $raw ) continue;
        $decoded = json_decode( $raw, true );
        if ( ! is_array( $decoded ) || empty( $decoded ) ) continue;

        $changed = false;

        if ( ! isset( $decoded[0]['blocks'] ) ) {
            $quiz_types = [ 'multiple_choice', 'true_false', 'short_answer' ];
            $blocks = [];
            $quiz   = [];
            foreach ( $decoded as $b ) {
                if ( ! is_array( $b ) ) continue;
                if ( in_array( $b['type'] ?? '', $quiz_types, true ) ) $quiz[] = $b;
                else $blocks[] = $b;
            }
            $decoded = [ [
                'id'                => 'section-' . wp_generate_uuid4(),
                'heroImage'         => '',
                'title'             => '',
                'description'       => '',
                'blocks'            => $blocks,
                'quizTitle'         => '',
                'passingPercentage' => 80,
                'quizBlocks'        => $quiz,
                'isModuleQuiz'      => true,
            ] ];
            $changed = true;
        }

        foreach ( $decoded as &$section ) {
            if ( ( $section['id'] ?? '' ) === 'section-legacy-migrated' ) {
                $section['id'] = 'section-' . wp_generate_uuid4();
                $changed = true;
            }
        }
        unset( $section );

        if ( $changed ) {
            update_post_meta( $m->ID, 'module_blocks', wp_json_encode( $decoded ) );
        }
    }
    update_option( 'induction_legacy_modules_migrated', 1 );
}

/**
 * Media referenced only by a module's saved history, as media id => module ids.
 *
 * Restoring a version rewrites a module back to content that points at these
 * files, so a file the current content no longer uses is still load-bearing.
 * Without this the library reported it as "Not used", an admin deleted it in
 * good faith, and the breakage only appeared later when someone restored.
 *
 * Cached against a fingerprint of the table rather than recomputed per
 * request: history is append-only and the JSON is large, so a site with a
 * long edit history would otherwise pay to parse all of it every time the
 * media screen loads. A new version changes the count and the highest id, so
 * the key changes with it.
 */
function induction_media_ids_in_versions(): array {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_module_versions';

    $shape = $wpdb->get_row( "SELECT COUNT(*) AS rows_n, COALESCE(MAX(id),0) AS last_id FROM $table", ARRAY_A );
    $key   = 'induction_version_media_' . md5( (string) ( $shape['rows_n'] ?? 0 ) . ':' . (string) ( $shape['last_id'] ?? 0 ) );

    $cached = get_transient( $key );
    if ( is_array( $cached ) ) {
        return $cached;
    }

    $found = [];
    $rows  = $wpdb->get_results( "SELECT module_id, blocks_json FROM $table", ARRAY_A ) ?: [];
    foreach ( $rows as $row ) {
        $module_id = (int) $row['module_id'];
        $sections  = induction_normalize_sections( json_decode( (string) $row['blocks_json'], true ) );
        if ( ! $sections ) {
            continue;
        }
        $note = static function ( $mid ) use ( &$found, $module_id ): void {
            $mid = (int) $mid;
            if ( $mid > 0 ) {
                $found[ $mid ][ $module_id ] = true;
            }
        };
        foreach ( $sections as $section ) {
            foreach ( (array) ( $section['blocks'] ?? [] ) as $block ) {
                if ( is_array( $block ) ) {
                    induction_collect_block_media( $block, [], static function ( $mid, $entry = [] ) use ( $note ): void {
                        unset( $entry );
                        $note( $mid );
                    } );
                }
            }
            foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $qb ) {
                if ( ( $qb['type'] ?? '' ) === 'multiple_choice' ) {
                    $note( $qb['data']['imageMediaId'] ?? 0 );
                }
            }
            if ( ! empty( $section['heroImage'] ) ) {
                $note( (int) ( $section['heroImageMediaId'] ?? 0 ) ?: attachment_url_to_postid( (string) $section['heroImage'] ) );
            }
        }
    }

    set_transient( $key, $found, DAY_IN_SECONDS );
    return $found;
}

function induction_get_media(): WP_REST_Response {
    $usage = [];
    $add = function ( $mid, array $entry ) use ( &$usage ): void {
        $mid = (int) $mid;
        if ( $mid <= 0 ) return;
        foreach ( $usage[ $mid ] ?? [] as $e ) {
            if ( $e['kind'] === $entry['kind']
                && $e['id'] === $entry['id']
                && ( $e['where'] ?? '' ) === ( $entry['where'] ?? '' ) ) {
                return;
            }
        }
        $usage[ $mid ][] = $entry;
    };

    $modules = get_posts( [ 'post_type' => 'induction_module', 'post_status' => 'any', 'posts_per_page' => -1 ] );
    foreach ( $modules as $m ) {
        $entry = [ 'kind' => 'module', 'id' => $m->ID, 'title' => get_the_title( $m->ID ) ?: '(Untitled module)' ];
        $hero  = (int) get_post_meta( $m->ID, 'module_hero_image', true );
        if ( $hero ) $add( $hero, array_merge( $entry, [ 'where' => 'hero image' ] ) );
        $blocks_json = get_post_meta( $m->ID, 'module_blocks', true );
        $sections    = induction_normalize_sections( $blocks_json ? json_decode( $blocks_json, true ) : null );
        if ( $sections ) {
            foreach ( $sections as $section ) {
                foreach ( (array) ( $section['blocks'] ?? [] ) as $block ) {
                    if ( is_array( $block ) ) induction_collect_block_media( $block, array_merge( $entry, [ 'where' => 'section content' ] ), $add );
                }
                foreach ( (array) ( $section['quizBlocks'] ?? [] ) as $qb ) {
                    if ( ( $qb['type'] ?? '' ) === 'multiple_choice' ) {
                        $add( $qb['data']['imageMediaId'] ?? 0, array_merge( $entry, [ 'where' => 'quiz' ] ) );
                    }
                }
                if ( ! empty( $section['heroImage'] ) ) {
                    $hero_id = (int) ( $section['heroImageMediaId'] ?? 0 ) ?: attachment_url_to_postid( (string) $section['heroImage'] );
                    $add( $hero_id, array_merge( $entry, [ 'where' => 'section image' ] ) );
                }
            }
        }
        foreach ( induction_media_ids_in_html( $m->post_content ) as $mid ) {
            $add( $mid, array_merge( $entry, [ 'where' => 'overview' ] ) );
        }
    }

    $docs = get_posts( [ 'post_type' => 'induction_document', 'post_status' => 'any', 'posts_per_page' => -1 ] );
    foreach ( $docs as $d ) {
        $fid = (int) get_post_meta( $d->ID, 'document_file_id', true );
        if ( $fid ) $add( $fid, [ 'kind' => 'document', 'id' => $d->ID, 'title' => get_the_title( $d->ID ) ?: '(Untitled document)', 'where' => 'attached file' ] );
    }

    // History counts. A file only an old version points at is still needed.
    foreach ( induction_media_ids_in_versions() as $mid => $module_ids ) {
        foreach ( array_keys( $module_ids ) as $module_id ) {
            $add( $mid, [
                'kind'  => 'module',
                'id'    => (int) $module_id,
                'title' => get_the_title( (int) $module_id ) ?: '(Untitled module)',
                'where' => 'version history',
            ] );
        }
    }

    $referenced = array_map( 'intval', array_keys( $usage ) );
    induction_tag_media( $referenced );
    $tagged     = get_posts( [
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'meta_key'       => '_induction_media',
    ] );
    $allowed = array_values( array_unique( array_merge( $referenced, array_map( 'intval', $tagged ) ) ) );

    $out = [];
    foreach ( $allowed as $att_id ) {
        $att = get_post( $att_id );
        if ( ! $att || $att->post_type !== 'attachment' ) continue;
        $mime = get_post_mime_type( $att_id ) ?: '';
        $file = get_attached_file( $att_id );
        $category = induction_media_category( $att_id );
        $out[] = [
            'id'            => $att_id,
            'filename'      => $file ? wp_basename( $file ) : ( get_the_title( $att_id ) ?: 'file' ),
            'url'           => wp_get_attachment_url( $att_id ),
            'mime'          => $mime,
            'type'          => induction_media_type( $mime ),
            'size'          => ( $file && file_exists( $file ) ) ? (int) filesize( $file ) : 0,
            'uploadedAt'    => get_the_date( 'c', $att_id ),
            'usage'         => $usage[ $att_id ] ?? [],
            'category'      => $category,
            'categoryLabel' => induction_resource_category_label( $category ),
        ];
    }

    usort( $out, fn( $a, $b ) => strcmp( $b['uploadedAt'], $a['uploadedAt'] ) );

    return rest_ensure_response( $out );
}

function induction_delete_media( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id  = (int) $request['id'];
    $att = get_post( $id );
    if ( ! $att || $att->post_type !== 'attachment' ) {
        return new WP_Error( 'not_found', 'File not found.', [ 'status' => 404 ] );
    }
    if ( ! get_post_meta( $id, '_induction_media', true ) ) {
        return new WP_Error( 'not_induction_media', 'That file is not an induction file and cannot be deleted here.', [ 'status' => 403 ] );
    }
    // Documents that pointed at this file are unhooked rather than removed.
    // The record is someone's title, category and audience, and only the file
    // has gone — so it is left for an admin to repoint or delete, and the
    // staff portal leaves a document with no file out of the list rather than
    // offering a card with nothing behind it.
    $orphaned = get_posts( [
        'post_type'      => 'induction_document',
        'post_status'    => 'any',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'meta_key'       => 'document_file_id',
        'meta_value'     => $id,
    ] );

    if ( ! wp_delete_attachment( $id, true ) ) {
        return new WP_Error( 'delete_failed', 'Could not delete the file.', [ 'status' => 500 ] );
    }

    foreach ( $orphaned as $doc_id ) {
        update_post_meta( (int) $doc_id, 'document_file_id', 0 );
    }

    return rest_ensure_response( [
        'deleted'           => $id,
        'documentsUnlinked' => count( $orphaned ),
    ] );
}

// ─── Resource categories ─────────────────────────────────────────────────────
// Uploaded files are grouped into admin-defined categories. The category is
// stored as a slug on the attachment itself (`_induction_media_category`), so
// every file in the library can carry one — not just the ones that happen to
// have an induction_document record in front of them. A document's own
// document_category meta is kept in step with its file's, in both directions,
// so the admin library and the staff portal can never disagree about where a
// file lives.

// The category list, slug => label. The default bucket is always present even
// if the option has never been written, so nothing has to special-case a fresh
// install or an option someone deleted by hand.
function induction_resource_categories(): array {
    $stored = get_option( 'induction_resource_categories', [] );

    $out = [];
    foreach ( (array) $stored as $slug => $label ) {
        $slug = sanitize_key( (string) $slug );
        if ( '' !== $slug ) {
            $out[ $slug ] = (string) $label;
        }
    }

    if ( ! isset( $out[ INDUCTION_RESOURCE_CATEGORY_DEFAULT ] ) ) {
        $out = [ INDUCTION_RESOURCE_CATEGORY_DEFAULT => INDUCTION_RESOURCE_CATEGORY_DEFAULT_LABEL ] + $out;
    }

    return $out;
}

function induction_save_resource_categories( array $categories ): void {
    update_option( 'induction_resource_categories', $categories );
}

// Falls back to a readable rendering of the slug rather than an empty string:
// an import can land a file in a category whose label has not arrived yet, and
// a blank chip is worse than an approximate one.
function induction_resource_category_label( string $slug ): string {
    if ( '' === $slug ) {
        return '';
    }
    $categories = induction_resource_categories();
    return $categories[ $slug ] ?? ucwords( str_replace( [ '-', '_' ], ' ', $slug ) );
}

function induction_media_category( int $attachment_id ): string {
    return sanitize_key( (string) get_post_meta( $attachment_id, '_induction_media_category', true ) );
}

function induction_set_media_category( int $attachment_id, string $slug ): void {
    if ( $attachment_id <= 0 || get_post_type( $attachment_id ) !== 'attachment' ) {
        return;
    }
    $slug = sanitize_key( $slug );
    if ( '' === $slug ) {
        delete_post_meta( $attachment_id, '_induction_media_category' );
    } else {
        update_post_meta( $attachment_id, '_induction_media_category', $slug );
    }
}

// How many files sit in each category. Drives the counts in the manage dialog
// and the "still in use" guard on deletion, so both read the same number.
function induction_resource_category_counts(): array {
    $counts = array_fill_keys( array_keys( induction_resource_categories() ), 0 );

    $files = get_posts( [
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'meta_key'       => '_induction_media_category',
    ] );

    foreach ( $files as $id ) {
        $slug = induction_media_category( (int) $id );
        if ( '' !== $slug ) {
            $counts[ $slug ] = ( $counts[ $slug ] ?? 0 ) + 1;
        }
    }

    return $counts;
}

// Document meta changed → stamp its file. Either meta key can arrive first
// (the REST controller writes them in payload order), so this re-reads the
// pair rather than trusting the value it was handed.
function induction_mirror_document_category( $meta_id, $object_id, $meta_key ): void {
    if ( ! in_array( $meta_key, [ 'document_category', 'document_file_id' ], true ) ) {
        return;
    }
    if ( get_post_type( $object_id ) !== 'induction_document' ) {
        return;
    }
    $file = (int) get_post_meta( $object_id, 'document_file_id', true );
    if ( $file ) {
        induction_set_media_category( $file, (string) get_post_meta( $object_id, 'document_category', true ) );
    }
}

// Documents pointing at one file. Used when the category is changed from the
// library side, so the document record follows its file.
function induction_documents_for_file( int $attachment_id ): array {
    if ( $attachment_id <= 0 ) {
        return [];
    }
    return array_map( 'intval', get_posts( [
        'post_type'      => 'induction_document',
        'post_status'    => 'any',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'meta_key'       => 'document_file_id',
        'meta_value'     => $attachment_id,
    ] ) );
}

// One-off: everything already in the library becomes "Module Resources".
// Categories did not exist before this version — document_category was free
// text nobody was ever offered a list for — so there is no vocabulary worth
// preserving, and one honest starting bucket beats forty spellings of "misc".
function induction_migrate_resource_categories(): void {
    if ( get_option( 'induction_resource_categories_migrated' ) ) {
        return;
    }

    induction_save_resource_categories( induction_resource_categories() );
    $default = INDUCTION_RESOURCE_CATEGORY_DEFAULT;

    // Documents first: each write mirrors onto the file behind it.
    foreach ( get_posts( [
        'post_type'      => 'induction_document',
        'post_status'    => 'any',
        'posts_per_page' => -1,
        'fields'         => 'ids',
    ] ) as $doc_id ) {
        update_post_meta( (int) $doc_id, 'document_category', $default );
    }

    // Then every file the library shows. Tagged attachments cover anything a
    // previous /media call has already seen; the module sweep catches the
    // rest, so a site that upgrades and opens its library finds it sorted
    // rather than half sorted.
    $file_ids = array_map( 'intval', get_posts( [
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'meta_key'       => '_induction_media',
    ] ) );

    foreach ( get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'any',
        'posts_per_page' => -1,
    ] ) as $module ) {
        $hero = (int) get_post_meta( $module->ID, 'module_hero_image', true );
        if ( $hero ) {
            $file_ids[] = $hero;
        }
        $blocks_json = (string) ( get_post_meta( $module->ID, 'module_blocks', true ) ?: '[]' );
        $sections    = induction_normalize_sections( json_decode( $blocks_json, true ) );
        $file_ids    = array_merge(
            $file_ids,
            induction_media_ids_in_sections( $sections ),
            induction_media_ids_in_html( $module->post_content )
        );
    }

    foreach ( array_unique( array_filter( $file_ids ) ) as $file_id ) {
        induction_set_media_category( (int) $file_id, $default );
    }

    update_option( 'induction_resource_categories_migrated', 1 );
}

/**
 * Categories whose documents are kept out of the staff portal.
 *
 * Its own option rather than a field on the category list, which is a flat
 * slug => label map that several things read and the backup carries verbatim.
 * A list of slugs can be added and removed without changing that shape.
 *
 * Hiding a category hides its documents outright: it is a shelf being taken
 * off the wall, not a change to who each document is for, so the per-document
 * audience is left exactly as it was and comes back untouched when the
 * category is shown again.
 */
function induction_hidden_resource_categories(): array {
    $stored = get_option( 'induction_hidden_resource_categories', [] );
    if ( ! is_array( $stored ) ) {
        return [];
    }
    return array_values( array_unique( array_filter( array_map( 'sanitize_key', $stored ) ) ) );
}

function induction_set_resource_category_visibility( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $slug = sanitize_key( (string) $request->get_param( 'slug' ) );
    if ( '' === $slug || ! array_key_exists( $slug, induction_resource_categories() ) ) {
        return new WP_Error( 'not_found', 'That category does not exist.', [ 'status' => 404 ] );
    }

    $hidden  = induction_hidden_resource_categories();
    $wanted  = (bool) $request->get_param( 'hidden' );
    $hidden  = array_values( array_diff( $hidden, [ $slug ] ) );
    if ( $wanted ) {
        $hidden[] = $slug;
    }
    update_option( 'induction_hidden_resource_categories', $hidden, false );

    return rest_ensure_response( [ 'value' => $slug, 'hidden' => $wanted ] );
}

function induction_get_resource_categories(): WP_REST_Response {
    $counts = induction_resource_category_counts();
    $hidden = induction_hidden_resource_categories();

    $out = [];
    foreach ( induction_resource_categories() as $slug => $label ) {
        $out[] = [
            'value'     => $slug,
            'label'     => $label,
            'count'     => (int) ( $counts[ $slug ] ?? 0 ),
            'hidden'    => in_array( $slug, $hidden, true ),
            // The default bucket is where an upload lands when the admin picks
            // nothing, so the UI protects it the way the server already does.
            'protected' => $slug === INDUCTION_RESOURCE_CATEGORY_DEFAULT,
        ];
    }

    return rest_ensure_response( $out );
}

function induction_create_resource_category( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $name = trim( sanitize_text_field( (string) $request->get_param( 'name' ) ) );
    if ( '' === $name ) {
        return new WP_Error( 'invalid_name', 'Please enter a category name.', [ 'status' => 400 ] );
    }
    $name = mb_substr( $name, 0, INDUCTION_RESOURCE_CATEGORY_LABEL_MAX_LENGTH );

    // sanitize_title, not sanitize_key: a two-word name should slug as
    // "site-safety" rather than collapse into "sitesafety".
    $slug = sanitize_key( sanitize_title( $name ) );
    if ( '' === $slug ) {
        return new WP_Error( 'invalid_name', 'Please use letters or numbers in the category name.', [ 'status' => 400 ] );
    }

    $categories = induction_resource_categories();
    if ( isset( $categories[ $slug ] ) ) {
        return new WP_Error( 'category_exists', 'A category with that name already exists.', [ 'status' => 409 ] );
    }
    if ( count( $categories ) >= INDUCTION_RESOURCE_CATEGORY_MAX ) {
        return new WP_Error(
            'too_many_categories',
            sprintf( 'You can have at most %d categories.', INDUCTION_RESOURCE_CATEGORY_MAX ),
            [ 'status' => 400 ]
        );
    }

    $categories[ $slug ] = $name;
    induction_save_resource_categories( $categories );

    return rest_ensure_response( [ 'value' => $slug, 'label' => $name, 'count' => 0, 'protected' => false ] );
}

// Renaming changes the label only. The slug is what every file stores, so
// leaving it alone is what makes a rename free rather than a re-stamp of the
// whole library.
function induction_rename_resource_category( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $slug = sanitize_key( (string) $request['slug'] );
    $name = trim( sanitize_text_field( (string) $request->get_param( 'name' ) ) );

    $categories = induction_resource_categories();
    if ( ! isset( $categories[ $slug ] ) ) {
        return new WP_Error( 'not_found', 'Category not found.', [ 'status' => 404 ] );
    }
    if ( '' === $name ) {
        return new WP_Error( 'invalid_name', 'Please enter a category name.', [ 'status' => 400 ] );
    }

    $categories[ $slug ] = mb_substr( $name, 0, INDUCTION_RESOURCE_CATEGORY_LABEL_MAX_LENGTH );
    induction_save_resource_categories( $categories );

    $counts = induction_resource_category_counts();
    return rest_ensure_response( [
        'value'     => $slug,
        'label'     => $categories[ $slug ],
        'count'     => (int) ( $counts[ $slug ] ?? 0 ),
        'protected' => $slug === INDUCTION_RESOURCE_CATEGORY_DEFAULT,
    ] );
}

function induction_delete_resource_category( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $slug = sanitize_key( (string) $request['slug'] );

    if ( $slug === INDUCTION_RESOURCE_CATEGORY_DEFAULT ) {
        return new WP_Error(
            'protected_category',
            'This category is built into the plugin and cannot be deleted.',
            [ 'status' => 400 ]
        );
    }

    $categories = induction_resource_categories();
    if ( ! isset( $categories[ $slug ] ) ) {
        return new WP_Error( 'not_found', 'Category not found.', [ 'status' => 404 ] );
    }

    $counts = induction_resource_category_counts();
    if ( ! empty( $counts[ $slug ] ) ) {
        return new WP_Error(
            'category_in_use',
            'This category still has files in it — move them somewhere else first.',
            [ 'status' => 409 ]
        );
    }

    unset( $categories[ $slug ] );
    induction_save_resource_categories( $categories );

    return rest_ensure_response( [ 'removed' => $slug ] );
}

// Moves one file between categories. An empty category means "uncategorised",
// which is a real state: a file can outlive the category it was filed under.
function induction_update_media_category( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $slug = sanitize_key( (string) $request->get_param( 'category' ) );

    if ( get_post_type( $id ) !== 'attachment' ) {
        return new WP_Error( 'not_found', 'File not found.', [ 'status' => 404 ] );
    }
    if ( '' !== $slug && ! isset( induction_resource_categories()[ $slug ] ) ) {
        return new WP_Error( 'unknown_category', 'That category does not exist.', [ 'status' => 400 ] );
    }

    induction_set_media_category( $id, $slug );

    // Any document record in front of this file follows it, so the staff
    // portal never shows a category the library has moved on from. The mirror
    // hook turns this back around harmlessly: it writes the slug the file
    // already has.
    foreach ( induction_documents_for_file( $id ) as $doc_id ) {
        update_post_meta( $doc_id, 'document_category', $slug );
    }

    return rest_ensure_response( [
        'id'            => $id,
        'category'      => $slug,
        'categoryLabel' => induction_resource_category_label( $slug ),
    ] );
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

// Writes whatever profile fields are present in $params. Shared by the admin
// staff editor and a staff member's own account settings page, so the two can
// never drift apart on validation or on what a field means.
//
// $allow_admin_fields gates the two decisions that are not the staff member's
// to make: whether they appear on Meet Our Team at all, and who is the owner.
// Everything else — their name, contact details and the wording of their own
// card — they own.
function induction_save_profile_fields( int $user_id, array $params, bool $allow_admin_fields ): ?WP_Error {
    $user_update = [ 'ID' => $user_id ];

    if ( isset( $params['first_name'] ) || isset( $params['last_name'] ) ) {
        $first = isset( $params['first_name'] )
            ? mb_substr( sanitize_text_field( (string) $params['first_name'] ), 0, INDUCTION_PROFILE_NAME_MAX_LENGTH )
            : (string) get_user_meta( $user_id, 'first_name', true );
        $last = isset( $params['last_name'] )
            ? mb_substr( sanitize_text_field( (string) $params['last_name'] ), 0, INDUCTION_PROFILE_NAME_MAX_LENGTH )
            : (string) get_user_meta( $user_id, 'last_name', true );

        $user_update['first_name'] = $first;
        $user_update['last_name']  = $last;

        // display_name is what the portal, staff list and team card all show,
        // so it follows the name rather than being edited separately.
        $full = trim( $first . ' ' . $last );
        if ( '' !== $full ) {
            $user_update['display_name'] = $full;
        }
    }

    if ( isset( $params['email'] ) ) {
        $email = sanitize_email( (string) $params['email'] );
        if ( ! is_email( $email ) ) {
            return new WP_Error( 'invalid_email', 'That email address is not valid.', [ 'status' => 400 ] );
        }
        $owner = email_exists( $email );
        if ( $owner && (int) $owner !== $user_id ) {
            return new WP_Error( 'email_taken', 'Another account already uses that email address.', [ 'status' => 409 ] );
        }
        $user_update['user_email'] = $email;
    }

    if ( count( $user_update ) > 1 ) {
        $result = wp_update_user( $user_update );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
    }

    if ( isset( $params['dob'] ) ) {
        $dob = trim( (string) $params['dob'] );
        // Empty clears it; otherwise it must be a real calendar date, so a
        // typo can't be stored as a date nothing can render.
        if ( '' !== $dob ) {
            [ $y, $m, $d ] = array_pad( array_map( 'intval', explode( '-', $dob ) ), 3, 0 );
            if ( ! checkdate( $m, $d, $y ) ) {
                return new WP_Error( 'invalid_dob', 'Enter the date of birth as YYYY-MM-DD.', [ 'status' => 400 ] );
            }
            $dob = sprintf( '%04d-%02d-%02d', $y, $m, $d );
        }
        update_user_meta( $user_id, 'induction_dob', $dob );
    }

    if ( isset( $params['suburb'] ) ) {
        $suburb = sanitize_text_field( (string) $params['suburb'] );
        update_user_meta( $user_id, 'induction_suburb', mb_substr( $suburb, 0, INDUCTION_PROFILE_SUBURB_MAX_LENGTH ) );
    }

    if ( isset( $params['address'] ) ) {
        $address = sanitize_text_field( (string) $params['address'] );
        update_user_meta( $user_id, 'induction_address', mb_substr( $address, 0, INDUCTION_PROFILE_ADDRESS_MAX_LENGTH ) );
    }

    // Staff-card wording: the person's own to edit.
    if ( isset( $params['title'] ) ) {
        $title = sanitize_text_field( (string) $params['title'] );
        update_user_meta( $user_id, 'induction_team_title', mb_substr( $title, 0, INDUCTION_TEAM_TITLE_MAX_LENGTH ) );
    }
    if ( isset( $params['region'] ) ) {
        $region = sanitize_text_field( (string) $params['region'] );
        update_user_meta( $user_id, 'induction_team_region', mb_substr( $region, 0, INDUCTION_TEAM_REGION_MAX_LENGTH ) );
    }
    if ( isset( $params['bio'] ) ) {
        $bio = sanitize_textarea_field( (string) $params['bio'] );
        update_user_meta( $user_id, 'induction_team_bio', mb_substr( $bio, 0, INDUCTION_TEAM_BIO_MAX_LENGTH ) );
    }

    // 0 clears the photo; omitting the key leaves it alone.
    if ( isset( $params['profile_photo_media_id'] ) ) {
        update_user_meta( $user_id, 'induction_profile_photo', (int) $params['profile_photo_media_id'] );
    }

    if ( ! $allow_admin_fields ) {
        return null;
    }

    // Contact details sit here rather than with the other card fields: they are
    // the business's public details, not the individual's, so they stay
    // admin-maintained even though they render on one person's card.
    if ( isset( $params['contact_email'] ) ) {
        $contact = trim( (string) $params['contact_email'] );
        if ( '' !== $contact ) {
            $contact = sanitize_email( $contact );
            if ( ! is_email( $contact ) ) {
                return new WP_Error( 'invalid_contact_email', 'That contact email address is not valid.', [ 'status' => 400 ] );
            }
        }
        update_user_meta( $user_id, 'induction_team_contact_email', $contact );
    }
    if ( isset( $params['contact_phone'] ) ) {
        $phone = sanitize_text_field( (string) $params['contact_phone'] );
        update_user_meta( $user_id, 'induction_team_contact_phone', mb_substr( $phone, 0, INDUCTION_CONTACT_PHONE_MAX_LENGTH ) );
    }

    if ( isset( $params['visible'] ) ) {
        update_user_meta( $user_id, 'induction_team_visible', $params['visible'] ? '1' : '' );
    }
    if ( isset( $params['is_owner'] ) ) {
        if ( $params['is_owner'] ) {
            foreach ( induction_team_owner_ids() as $previous_id ) {
                if ( $previous_id !== $user_id ) {
                    delete_user_meta( $previous_id, 'induction_team_is_owner' );
                }
            }
            update_user_meta( $user_id, 'induction_team_is_owner', '1' );
        } else {
            delete_user_meta( $user_id, 'induction_team_is_owner' );
        }
    }

    return null;
}

// ─── A staff member's own profile ───────────────────────────────────────────

function induction_get_my_profile(): WP_REST_Response|WP_Error {
    $user = wp_get_current_user();
    if ( ! $user || ! $user->ID ) {
        return new WP_Error( 'not_logged_in', 'You are not signed in.', [ 'status' => 401 ] );
    }
    return rest_ensure_response( induction_format_staff_user( $user ) );
}

function induction_update_my_profile( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'not_logged_in', 'You are not signed in.', [ 'status' => 401 ] );
    }

    $error = induction_save_profile_fields( $user_id, (array) $request->get_json_params(), false );
    if ( $error ) {
        return $error;
    }

    return rest_ensure_response( induction_format_staff_user( get_user_by( 'id', $user_id ) ) );
}

// Staff upload their own photo here rather than through wp/v2/media, because
// the staff role has no upload_files capability and granting it would let them
// put anything into the shared media library. This accepts one image, checks
// it really is an image, and caps the size.
function induction_upload_profile_photo( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'not_logged_in', 'You are not signed in.', [ 'status' => 401 ] );
    }

    // An admin may upload on someone else's behalf from the staff editor.
    $target = (int) ( $request->get_param( 'user_id' ) ?: $user_id );
    if ( $target !== $user_id && ! induction_is_admin_user() ) {
        return new WP_Error( 'forbidden', 'You can only change your own photo.', [ 'status' => 403 ] );
    }

    $files = $request->get_file_params();
    $file  = $files['file'] ?? null;
    if ( ! $file || empty( $file['tmp_name'] ) ) {
        return new WP_Error( 'no_file', 'No image was uploaded.', [ 'status' => 400 ] );
    }
    if ( (int) $file['size'] > INDUCTION_PROFILE_PHOTO_MAX_BYTES ) {
        return new WP_Error(
            'file_too_large',
            sprintf( 'Photos must be %dMB or smaller.', INDUCTION_PROFILE_PHOTO_MAX_BYTES / 1024 / 1024 ),
            [ 'status' => 400 ]
        );
    }

    // Trust the file's actual contents, not the name or the declared type.
    $check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
    if ( empty( $check['type'] ) || ! str_starts_with( (string) $check['type'], 'image/' ) ) {
        return new WP_Error( 'not_an_image', 'That file is not an image.', [ 'status' => 400 ] );
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $upload = wp_handle_upload( $file, [ 'test_form' => false ] );
    if ( ! empty( $upload['error'] ) ) {
        return new WP_Error( 'upload_failed', (string) $upload['error'], [ 'status' => 500 ] );
    }

    $attachment_id = wp_insert_attachment( [
        'post_mime_type' => $upload['type'],
        'post_title'     => sanitize_file_name( $file['name'] ),
        'post_status'    => 'inherit',
    ], $upload['file'] );

    if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
        return new WP_Error( 'attachment_failed', 'The image could not be saved.', [ 'status' => 500 ] );
    }

    wp_update_attachment_metadata(
        $attachment_id,
        wp_generate_attachment_metadata( $attachment_id, $upload['file'] )
    );
    update_user_meta( $target, 'induction_profile_photo', (int) $attachment_id );

    return rest_ensure_response( [
        'media_id' => (int) $attachment_id,
        'url'      => induction_profile_photo_url( $target ),
    ] );
}

function induction_update_team_profile( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id   = (int) $request['id'];
    $user = get_user_by( 'id', $id );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }

    $params = (array) $request->get_json_params();

    // Legacy key: earlier builds sent the photo as photo_media_id.
    if ( isset( $params['photo_media_id'] ) && ! isset( $params['profile_photo_media_id'] ) ) {
        $params['profile_photo_media_id'] = $params['photo_media_id'];
    }

    $error = induction_save_profile_fields( $id, $params, true );
    if ( $error ) {
        return $error;
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
        $is_owner = (bool) get_user_meta( $user->ID, 'induction_team_is_owner', true );

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
            // The same photo the staff member set on their account page.
            'photoUrl'  => induction_profile_photo_url( $user->ID ),
            'bio'       => (string) get_user_meta( $user->ID, 'induction_team_bio', true ),
            'isOwner'   => $is_owner,
            // Only the owner's card renders these, and /team is readable by any
            // signed-in account — so they are not sent for anybody else.
            'contactEmail' => $is_owner ? (string) get_user_meta( $user->ID, 'induction_team_contact_email', true ) : '',
            'contactPhone' => $is_owner ? (string) get_user_meta( $user->ID, 'induction_team_contact_phone', true ) : '',
        ];
    }, $users );

    return rest_ensure_response( $result );
}

// ─── Backup / Migration ─────────────────────────────────────────────────────
//
// Export is one zip: content.json plus the media it references. Records carry a
// login/email user reference and are matched to existing users on import.

// ── Scratch storage ─────────────────────────────────────────────────────────

// Not the system temp dir: PHP can't list anything under C:\Windows\TEMP, and shared hosts
// often give /tmp a small partition. Outside the web root where possible (personal data).
function induction_transfer_dir(): string {
    static $dir = null;
    if ( null !== $dir ) {
        return $dir;
    }
    if ( defined( 'INDUCTION_TRANSFER_DIR' ) ) {
        $dir = trailingslashit( (string) INDUCTION_TRANSFER_DIR );
    } else {
        $saved = (string) get_option( 'induction_transfer_dir', '' );
        $dir   = ( '' !== $saved && @is_dir( $saved ) ) ? $saved : induction_transfer_dir_choose();
        if ( $dir !== $saved ) {
            update_option( 'induction_transfer_dir', $dir, false );
        }
    }
    if ( ! @is_dir( $dir ) ) {
        wp_mkdir_p( $dir );
    }
    if ( ! file_exists( $dir . 'index.php' ) ) {
        @file_put_contents( $dir . 'index.php', "<?php\n// Silence is golden.\n" );
        @file_put_contents( $dir . '.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n" );
        @file_put_contents( $dir . 'web.config', '<?xml version="1.0"?><configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>' );
    }
    return $dir;
}

function induction_transfer_dir_choose(): string {
    $docroot = isset( $_SERVER['DOCUMENT_ROOT'] ) ? trailingslashit( wp_normalize_path( (string) $_SERVER['DOCUMENT_ROOT'] ) ) : '';
    $outside = trailingslashit( wp_normalize_path( dirname( untrailingslashit( ABSPATH ) ) ) ) . 'induction-transfer/';

    // Not when WordPress sits in a subfolder of the web root.
    $is_outside = '' !== $docroot && 0 !== strpos( $outside, $docroot );
    if ( $is_outside && ( @is_dir( $outside ) || @wp_mkdir_p( $outside ) ) && @wp_is_writable( $outside ) ) {
        return $outside;
    }
    return trailingslashit( wp_upload_dir( null, false )['basedir'] ) . 'induction-transfer/';
}

function induction_transfer_disk_shortfall( int $bytes ): string {
    if ( ! function_exists( 'disk_free_space' ) ) {
        return '';
    }
    $free = @disk_free_space( induction_transfer_dir() );
    if ( false === $free ) {
        return '';
    }
    $needed = $bytes + INDUCTION_TRANSFER_DISK_MARGIN;
    if ( $free >= $needed ) {
        return '';
    }
    return sprintf(
        'Not enough free disk space on the server: this needs about %s, and %s is free.',
        size_format( $needed ),
        size_format( $free )
    );
}

function induction_transfer_no_time_limit(): void {
    if ( function_exists( 'set_time_limit' ) ) {
        set_time_limit( 0 );
    }
}

// '' for a path that climbs out of its folder (zip-slip).
function induction_transfer_safe_rel( string $path ): string {
    $rel = ltrim( str_replace( '\\', '/', $path ), '/' );
    if ( false !== strpos( $rel, '..' ) || preg_match( '#^[a-zA-Z]:#', $rel ) ) {
        return '';
    }
    return $rel;
}

// Warnings suppressed: in a REST callback they would print into the JSON body.
function induction_rrmdir( string $dir ): void {
    if ( '' === $dir || ! is_dir( $dir ) ) {
        return;
    }
    try {
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ( $items as $item ) {
            $item->isDir() ? @rmdir( $item->getPathname() ) : @unlink( $item->getPathname() );
        }
    } catch ( \Throwable $e ) {
    }
    @rmdir( $dir );
}

// ── Export ──────────────────────────────────────────────────────────────────

function induction_export_collect_media( int $attachment_id, array &$media, array &$budget ): void {
    if ( ! $attachment_id || isset( $media[ $attachment_id ] ) ) {
        return;
    }
    $post = get_post( $attachment_id );
    if ( ! $post || 'attachment' !== $post->post_type ) {
        return;
    }

    $path  = get_attached_file( $attachment_id );
    $entry = [
        'filename' => $path ? basename( $path ) : (string) $post->post_name,
        'mime'     => (string) get_post_mime_type( $attachment_id ),
        'title'    => $post->post_title,
        'url'      => (string) wp_get_attachment_url( $attachment_id ),
        'size'     => ( $path && file_exists( $path ) ) ? (int) filesize( $path ) : 0,
    ];

    if ( ! $path || ! is_readable( $path ) ) {
        $budget['skipped'][]     = $entry['filename']; // exported by URL only
        $media[ $attachment_id ] = $entry;
        return;
    }

    // Left out on purpose, by the same route as a file that cannot be read:
    // the entry still travels with its URL, so an import knows the attachment
    // existed and where it came from. A large induction video is often the
    // difference between an archive a host will build and one it will not.
    $limit = (int) ( $budget['max_file_bytes'] ?? 0 );
    if ( empty( $budget['include_media'] ) || ( $limit > 0 && $entry['size'] > $limit ) ) {
        $budget['skipped'][]     = $entry['filename'];
        $media[ $attachment_id ] = $entry;
        return;
    }

    $ext             = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) ?: 'bin';
    $entry['file']   = "media/{$attachment_id}.{$ext}";
    $entry['path']   = $path;
    $budget['used'] += $entry['size'];

    // Thumbnails travel too, so import can restore them instead of regenerating them.
    $meta = wp_get_attachment_metadata( $attachment_id );
    if ( is_array( $meta ) && ! empty( $meta['width'] ) ) {
        $entry['width']  = (int) $meta['width'];
        $entry['height'] = (int) ( $meta['height'] ?? 0 );
        $entry['sizes']  = [];
        foreach ( (array) ( $meta['sizes'] ?? [] ) as $name => $info ) {
            $thumb = dirname( $path ) . '/' . ( $info['file'] ?? '' );
            if ( empty( $info['file'] ) || ! is_readable( $thumb ) ) {
                continue;
            }
            $entry['sizes'][ $name ] = [
                'file'   => "media/{$attachment_id}/" . $info['file'],
                'width'  => (int) ( $info['width'] ?? 0 ),
                'height' => (int) ( $info['height'] ?? 0 ),
                'path'   => $thumb,
            ];
            $budget['used'] += (int) filesize( $thumb );
        }
    }
    $media[ $attachment_id ] = $entry;
}

// Attachment ids a module's content uses: id fields, plus upload URLs in any text.
function induction_media_ids_in_value( $value, array &$ids, callable $url_to_id ): void {
    if ( is_string( $value ) ) {
        foreach ( induction_upload_urls_in( $value ) as $url ) {
            $ids[] = (int) $url_to_id( $url );
        }
        return;
    }
    if ( ! is_array( $value ) ) {
        return;
    }
    foreach ( $value as $key => $child ) {
        if ( in_array( $key, INDUCTION_MEDIA_ID_KEYS, true ) && is_numeric( $child ) ) {
            $ids[] = (int) $child;
        } else {
            induction_media_ids_in_value( $child, $ids, $url_to_id );
        }
    }
}

function induction_upload_urls_in( string $text ): array {
    if ( false === strpos( $text, '/uploads/' ) ) {
        return [];
    }
    preg_match_all( '#https?://[^\s"\'<>(),]+/uploads/[^\s"\'<>(),]+#i', $text, $matches );
    return array_unique( $matches[0] );
}

// Thumbnail and "-scaled" URLs resolve to their original attachment.
function induction_attachment_id_from_url( string $url ): int {
    static $cache = [];
    $url = strtok( $url, '?#' );
    if ( ! isset( $cache[ $url ] ) ) {
        $full          = preg_replace( '/-\d+x\d+(?=\.[a-z0-9]+$)/i', '', $url );
        $cache[ $url ] = attachment_url_to_postid( $full ) ?: attachment_url_to_postid( preg_replace( '/(\.[a-z0-9]+)$/i', '-scaled$1', $full ) );
    }
    return (int) $cache[ $url ];
}

// induction_attachment_id_from_url() with one query for every path instead of one per URL.
function induction_export_url_to_id( string $url ): int {
    static $by_file = null;
    static $base    = '';
    if ( null === $by_file ) {
        global $wpdb;
        $by_file = [];
        foreach ( $wpdb->get_results( "SELECT post_id, meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file'" ) as $row ) {
            $by_file[ $row->meta_value ] = (int) $row->post_id;
        }
        $base = preg_replace( '#^https?:#i', '', wp_get_upload_dir()['baseurl'] ) . '/';
    }
    $url = preg_replace( '#^https?:#i', '', (string) strtok( $url, '?#' ) );
    if ( 0 !== strpos( $url, $base ) ) {
        return 0;
    }
    $file = preg_replace( '/-\d+x\d+(?=\.[a-z0-9]+$)/i', '', substr( $url, strlen( $base ) ) );
    return $by_file[ $file ] ?? $by_file[ preg_replace( '/(\.[a-z0-9]+)$/i', '-scaled$1', $file ) ] ?? 0;
}

function induction_export_posts( string $type ): array {
    return get_posts( [
        'post_type'      => $type,
        'post_status'    => [ 'publish', 'draft' ],
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ] );
}

// Returns [ modules, refs by post id ].
function induction_export_modules( array &$media_ids ): array {
    $modules = [];
    $refs    = [];
    foreach ( induction_export_posts( 'induction_module' ) as $post ) {
        $refs[ $post->ID ] = 'module-' . $post->ID;

        $blocks = json_decode( (string) ( get_post_meta( $post->ID, 'module_blocks', true ) ?: '[]' ), true );
        $blocks = is_array( $blocks ) ? $blocks : [];
        $hero   = (int) get_post_meta( $post->ID, 'module_hero_image', true );

        $media_ids[] = $hero;
        induction_media_ids_in_value( [ $blocks, $post->post_content ], $media_ids, 'induction_export_url_to_id' );

        $modules[] = [
            'ref'     => $refs[ $post->ID ],
            'title'   => $post->post_title,
            'content' => $post->post_content,
            'excerpt' => $post->post_excerpt,
            'status'  => $post->post_status,
            'meta'    => [
                'module_role_targets'      => (array) ( get_post_meta( $post->ID, 'module_role_targets', true ) ?: [] ),
                'module_estimated_minutes' => (int) get_post_meta( $post->ID, 'module_estimated_minutes', true ),
                'module_order'             => (int) get_post_meta( $post->ID, 'module_order', true ),
                'module_duration_days'     => (int) get_post_meta( $post->ID, 'module_duration_days', true ),
                'module_icon'              => (string) get_post_meta( $post->ID, 'module_icon', true ),
                'module_hero_image'        => $hero,
                'quiz_pass_threshold'      => (int) get_post_meta( $post->ID, 'quiz_pass_threshold', true ),
            ],
            'blocks'  => $blocks,
        ];
    }
    return [ $modules, $refs ];
}

function induction_export_locations( array &$media_ids ): array {
    $locations = [];
    foreach ( induction_export_posts( 'induction_location' ) as $post ) {
        $thumb       = (int) get_post_meta( $post->ID, 'location_thumbnail_id', true );
        $media_ids[] = $thumb;
        $locations[] = [
            'title'        => $post->post_title,
            'status'       => $post->post_status,
            'address'      => (string) get_post_meta( $post->ID, 'location_address', true ),
            'lat'          => (float) get_post_meta( $post->ID, 'location_lat', true ),
            'lng'          => (float) get_post_meta( $post->ID, 'location_lng', true ),
            'zoom'         => (int) get_post_meta( $post->ID, 'location_zoom', true ),
            'thumbnail_id' => $thumb,
            'notes'        => (string) get_post_meta( $post->ID, 'location_notes', true ),
            'markers'      => (string) ( get_post_meta( $post->ID, 'location_markers', true ) ?: '[]' ),
            'paths'        => (string) ( get_post_meta( $post->ID, 'location_paths', true ) ?: '[]' ),
        ];
    }
    return $locations;
}

function induction_export_documents( array &$media_ids ): array {
    $documents = [];
    foreach ( induction_export_posts( 'induction_document' ) as $post ) {
        $file_id     = (int) get_post_meta( $post->ID, 'document_file_id', true );
        $media_ids[] = $file_id;
        $documents[] = [
            'title'                 => $post->post_title,
            'status'                => $post->post_status,
            'document_category'     => (string) get_post_meta( $post->ID, 'document_category', true ),
            'document_file_id'      => $file_id,
            'document_role_targets' => (array) ( get_post_meta( $post->ID, 'document_role_targets', true ) ?: [] ),
        ];
    }
    return $documents;
}

function induction_export_user_ref( int $user_id ): ?array {
    $user = get_userdata( $user_id );
    return $user ? [ 'login' => $user->user_login, 'email' => $user->user_email ] : null;
}

// Keyed by module ref and user login/email instead of ids; orphaned rows are left out.
function induction_export_rows( string $table, array $module_refs, array $drop = [] ): array {
    global $wpdb;
    $rows = [];
    foreach ( $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}induction_{$table}", ARRAY_A ) ?? [] as $row ) {
        $ref  = $module_refs[ (int) $row['module_id'] ] ?? null;
        $user = induction_export_user_ref( (int) $row['user_id'] );
        if ( ! $ref || ! $user ) {
            continue;
        }
        foreach ( array_merge( [ 'id', 'user_id', 'module_id' ], $drop ) as $column ) {
            unset( $row[ $column ] );
        }
        $rows[] = array_merge( [ 'module_ref' => $ref, 'user' => $user ], $row );
    }
    return $rows;
}

/**
 * Gather everything an export contains.
 *
 * $options accepts 'include_media' (false leaves every file out, keeping only
 * its URL) and 'max_file_bytes' (0 for no limit). Both go through the same
 * path as a file that is missing from disk, so an import handles a
 * deliberately omitted file exactly as it already handles an absent one.
 */
function induction_export_collect( array $options = [] ): array {
    $media_ids = [];
    [ $modules, $module_refs ] = induction_export_modules( $media_ids );
    $locations = induction_export_locations( $media_ids );
    $documents = induction_export_documents( $media_ids );

    $media_ids = array_values( array_unique( array_filter( array_map( 'intval', $media_ids ) ) ) );
    _prime_post_caches( $media_ids, false, true );
    $media  = [];
    $budget = [
        'used'           => 0,
        'skipped'        => [],
        'include_media'  => (bool) ( $options['include_media'] ?? true ),
        'max_file_bytes' => max( 0, (int) ( $options['max_file_bytes'] ?? 0 ) ),
    ];
    foreach ( $media_ids as $id ) {
        induction_export_collect_media( $id, $media, $budget );
    }

    // Never leak absolute server paths into the archive.
    $manifest = [];
    foreach ( $media as $id => $entry ) {
        unset( $entry['path'] );
        foreach ( array_keys( $entry['sizes'] ?? [] ) as $name ) {
            unset( $entry['sizes'][ $name ]['path'] );
        }
        $manifest[ $id ] = $entry;
    }

    $envelope = [
        'format'              => INDUCTION_EXPORT_FORMAT,
        'format_version'      => INDUCTION_EXPORT_FORMAT_VERSION,
        'exported_at'         => current_time( 'mysql' ),
        'site'                => [
            'name' => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
            'url'  => home_url( '/' ),
        ],
        'modules'             => $modules,
        'locations'           => $locations,
        'documents'           => $documents,
        'resource_categories' => induction_resource_categories(),
        'media'               => $manifest,
        'records'             => [
            'progress'       => induction_export_rows( 'progress', $module_refs ),
            'assignments'    => induction_export_rows( 'assignments', $module_refs, [ 'assigned_by' ] ),
            'quiz_responses' => induction_export_rows( 'quiz_responses', $module_refs ),
        ],
        'notes'               => [
            'media_bytes_included' => $budget['used'],
            'media_not_included'   => $budget['skipped'],
        ],
    ];

    return [
        'content' => wp_json_encode( $envelope ) ?: '',
        'media'   => array_values( array_filter( $media, static fn( $entry ) => isset( $entry['path'] ) ) ),
        'skipped' => count( $budget['skipped'] ),
        'bytes'   => $budget['used'],
    ];
}

// The token stands in for the auth header, so the browser can download the zip itself.
function induction_export_prepare( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    induction_transfer_no_time_limit();
    if ( ! class_exists( 'ZipArchive' ) ) {
        return new WP_Error( 'induction_no_zip', 'The server is missing the Zip extension needed to build an export.', [ 'status' => 500 ] );
    }
    $job = induction_import_id( $request->get_param( 'job' ) ) ?: str_replace( '-', '', wp_generate_uuid4() );
    induction_export_set_status( $job, [ 'phase' => 'collecting' ] );

    $export = induction_export_collect( induction_export_options( $request ) );
    if ( '' === $export['content'] ) {
        return induction_export_fail( $job, new WP_Error( 'induction_export_encode', 'The site content could not be encoded for export.', [ 'status' => 500 ] ) );
    }
    $shortfall = induction_transfer_disk_shortfall( $export['bytes'] );
    if ( $shortfall ) {
        return induction_export_fail( $job, new WP_Error( 'induction_disk_full', $shortfall, [ 'status' => 507 ] ) );
    }
    $size = induction_export_build_zip( $job, $export );
    if ( is_wp_error( $size ) ) {
        return induction_export_fail( $job, $size );
    }

    $token = bin2hex( random_bytes( 32 ) );
    set_transient( 'induction_export_' . hash( 'sha256', $token ), [ 'user' => get_current_user_id(), 'job' => $job ], INDUCTION_EXPORT_LINK_TTL );
    induction_export_set_status( $job, [ 'phase' => 'ready', 'size' => $size ] );

    return rest_ensure_response( [
        'token'        => $token,
        'job'          => $job,
        'files'        => count( $export['media'] ),
        'bytes'        => $export['bytes'],
        'size'         => $size,
        'skippedMedia' => $export['skipped'],
        // Where the archive sits on the server, so an admin can collect it
        // over FTP or a file manager instead of through the browser. On a host
        // that mangles a large download, fetching the file directly is the only
        // route that touches neither PHP nor the web server's response
        // handling. Admin-only endpoint, and a path is what makes the file
        // findable, so there is nothing to withhold here.
        'path'         => induction_export_path( $job, 'zip' ),
    ] );
}

/** Media choices sent with an export request, defaulting to "everything". */
function induction_export_options( WP_REST_Request $request ): array {
    $body = $request->get_json_params();
    $body = is_array( $body ) ? $body : [];
    return [
        'include_media'  => ! array_key_exists( 'includeMedia', $body ) || (bool) $body['includeMedia'],
        'max_file_bytes' => max( 0, (int) ( $body['maxFileMb'] ?? 0 ) ) * 1024 * 1024,
    ];
}

/**
 * What an export would contain, without building it.
 *
 * Runs the same collection the export runs, so the numbers are the real ones
 * rather than an estimate — a site whose archive will not build wants to find
 * that out before waiting for the build, and wants to be told which files are
 * responsible rather than just how big the total is.
 */
function induction_export_preflight( WP_REST_Request $request ): WP_REST_Response {
    induction_transfer_no_time_limit();
    $export = induction_export_collect();

    $largest = [];
    foreach ( $export['media'] as $entry ) {
        $largest[] = [ 'name' => (string) $entry['filename'], 'bytes' => (int) ( $entry['size'] ?? 0 ) ];
    }
    usort( $largest, static fn( array $a, array $b ): int => $b['bytes'] <=> $a['bytes'] );

    $content_bytes = strlen( $export['content'] );
    $free          = function_exists( 'disk_free_space' ) ? @disk_free_space( induction_transfer_dir() ) : false;

    return rest_ensure_response( [
        'mediaCount'    => count( $export['media'] ),
        'mediaBytes'    => (int) $export['bytes'],
        'contentBytes'  => $content_bytes,
        // Media is stored rather than deflated, so the archive lands close to
        // the sum of its parts.
        'estimatedBytes' => (int) $export['bytes'] + $content_bytes,
        'missing'       => (int) $export['skipped'],
        'largest'       => array_slice( $largest, 0, 10 ),
        // Whole-filesystem free space on shared hosting, which can be far more
        // than the account is actually allowed. Reported, not trusted.
        'freeBytes'     => false === $free ? null : (int) $free,
    ] );
}

function induction_export_fail( string $job, WP_Error $error ): WP_Error {
    induction_export_set_status( $job, [ 'phase' => 'failed', 'message' => $error->get_error_message() ] );
    return $error;
}

function induction_export_build_zip( string $job, array $export ): int|WP_Error {
    $path = induction_export_path( $job, 'zip' );
    $zip  = new ZipArchive();
    if ( true !== $zip->open( $path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
        return new WP_Error( 'induction_zip_failed', 'Could not create the export archive.', [ 'status' => 500 ] );
    }
    $zip->addFromString( 'content.json', $export['content'] );
    foreach ( $export['media'] as $entry ) {
        foreach ( array_merge( [ $entry ], $entry['sizes'] ?? [] ) as $file ) {
            $zip->addFile( $file['path'], $file['file'] );
            // Stored, not deflated: media is already compressed.
            $zip->setCompressionName( $file['file'], ZipArchive::CM_STORE );
        }
    }
    // close() does the copying, so that is what gets reported.
    induction_export_set_status( $job, [ 'phase' => 'zipping', 'progress' => 0 ] );
    if ( method_exists( $zip, 'registerProgressCallback' ) ) {
        $zip->registerProgressCallback( 0.01, static function ( float $progress ) use ( $job ): void {
            induction_export_set_status( $job, [ 'phase' => 'zipping', 'progress' => $progress ] );
        } );
    }
    if ( ! $zip->close() ) {
        @unlink( $path );
        return new WP_Error( 'induction_zip_failed', 'Could not write the export archive (the server may be out of disk space).', [ 'status' => 500 ] );
    }
    return (int) filesize( $path );
}

function induction_export_path( string $job, string $ext ): string {
    return induction_transfer_dir() . "induction-export-{$job}.{$ext}";
}

function induction_export_set_status( string $job, array $status ): void {
    @file_put_contents( induction_export_path( $job, 'json' ), wp_json_encode( $status ), LOCK_EX );
}

function induction_export_status( WP_REST_Request $request ): WP_REST_Response {
    $job    = induction_import_id( $request->get_param( 'job' ) );
    $raw    = '' !== $job ? @file_get_contents( induction_export_path( $job, 'json' ) ) : false;
    $status = $raw ? json_decode( $raw, true ) : null;
    return rest_ensure_response( is_array( $status ) ? $status : [ 'phase' => 'unknown' ] );
}

function induction_export_discard( WP_REST_Request $request ): WP_REST_Response {
    $job = induction_import_id( $request->get_param( 'job' ) );
    if ( '' !== $job ) {
        @unlink( induction_export_path( $job, 'zip' ) );
        @unlink( induction_export_path( $job, 'json' ) );
    }
    return rest_ensure_response( [ 'discarded' => true ] );
}

function induction_export_permission( WP_REST_Request $request ): bool {
    if ( induction_is_admin_user() ) {
        return true;
    }
    $token = (string) $request->get_param( 'token' );
    if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
        return false;
    }
    $key   = 'induction_export_' . hash( 'sha256', $token );
    $grant = get_transient( $key );
    if ( ! is_array( $grant ) ) {
        return false;
    }
    // Not single-use any more. A resumed download repeats the same URL, so
    // burning the token on the first request made resuming impossible — and an
    // interrupted export had to be rebuilt from scratch, which is the slow
    // part. The link is still short-lived, and the handler revokes it the
    // moment the last byte has been delivered, so it stops working as soon as
    // it is no longer needed rather than as soon as it has been used once.
    $request->set_param( 'grant_key', $key );
    wp_set_current_user( (int) $grant['user'] );
    $request->set_param( 'job', (string) $grant['job'] );
    return induction_is_admin_user();
}

/**
 * Serve a prepared export, resuming where an earlier attempt stopped.
 *
 * Large exports do not survive a single HTTP response on shared hosting: the
 * web server kills the worker after its own fixed processing time, which a
 * script cannot raise from the inside, and the browser is left holding a
 * truncated zip with no end-of-archive record. A 675MB export cut at five
 * minutes is not a rare case — it is the normal case once a site has enough
 * media.
 *
 * So the response supports Range. An interrupted download resumes from the
 * byte it reached instead of starting again, and each attempt only has to
 * survive long enough to move the file forward.
 *
 * Two rules make that work, and both were previously the other way round:
 * the zip is kept unless the final byte has actually been delivered, and the
 * one-time link is revoked at the same moment rather than on first use.
 */
function induction_export_site( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    induction_transfer_no_time_limit();
    $job  = induction_import_id( $request->get_param( 'job' ) );
    $path = '' !== $job ? induction_export_path( $job, 'zip' ) : '';
    $in   = '' !== $path && is_file( $path ) ? @fopen( $path, 'rb' ) : false;
    if ( ! $in ) {
        return new WP_Error( 'induction_export_missing', 'This export has already been downloaded or has expired. Export again.', [ 'status' => 404 ] );
    }
    $size  = (int) filesize( $path );
    $mtime = (int) filemtime( $path );
    // A validator the client can send back with If-Range, so a resume against a
    // rebuilt export is detected and restarted rather than stitching two
    // different archives together into something that looks whole and is not.
    $etag = '"' . md5( $job . ':' . $size . ':' . $mtime ) . '"';

    // Keep going after a disconnect so the final status still gets written.
    ignore_user_abort( true );
    while ( ob_get_level() > 0 ) {
        ob_end_clean();
    }
    nocache_headers();

    $start   = 0;
    $end     = $size - 1;
    $partial = false;

    $range    = isset( $_SERVER['HTTP_RANGE'] ) ? trim( (string) $_SERVER['HTTP_RANGE'] ) : '';
    $if_range = isset( $_SERVER['HTTP_IF_RANGE'] ) ? trim( (string) $_SERVER['HTTP_IF_RANGE'] ) : '';

    // An If-Range that does not match means the file changed under the client,
    // so the range is ignored and the whole file sent instead.
    if ( '' !== $range && ( '' === $if_range || $if_range === $etag ) ) {
        if ( preg_match( '/^bytes=(\d*)-(\d*)$/', $range, $m ) ) {
            if ( '' === $m[1] && '' !== $m[2] ) {
                // bytes=-N — the last N bytes.
                $start = max( 0, $size - (int) $m[2] );
            } else {
                $start = (int) $m[1];
                if ( '' !== $m[2] ) {
                    $end = (int) $m[2];
                }
            }
            if ( $end >= $size ) {
                $end = $size - 1;
            }
            if ( $start > $end || $start >= $size ) {
                header( 'Content-Range: bytes */' . $size );
                status_header( 416 );
                fclose( $in );
                exit;
            }
            $partial = true;
        }
    }

    $length = $end - $start + 1;

    header( 'Content-Type: application/zip' );
    header( 'Content-Disposition: attachment; filename="induction-export-' . gmdate( 'Y-m-d' ) . '.zip"' );
    header( 'Content-Length: ' . $length );
    // Without these the browser has no way to offer Resume on a failed download.
    header( 'Accept-Ranges: bytes' );
    header( 'ETag: ' . $etag );
    header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', $mtime ) . ' GMT' );
    // Otherwise nginx buffers the file and "sent" runs ahead of the browser.
    header( 'X-Accel-Buffering: no' );

    if ( $partial ) {
        status_header( 206 );
        header( 'Content-Range: bytes ' . $start . '-' . $end . '/' . $size );
        fseek( $in, $start );
    }

    $sent     = 0;
    $reported = 0;
    induction_export_set_status( $job, [ 'phase' => 'sending', 'sent' => $start, 'size' => $size ] );
    while ( $sent < $length && ! connection_aborted() ) {
        $chunk = fread( $in, (int) min( 1024 * 1024, $length - $sent ) );
        if ( false === $chunk || '' === $chunk ) {
            break;
        }
        echo $chunk;
        flush();
        $sent += strlen( $chunk );
        if ( $sent - $reported >= INDUCTION_EXPORT_REPORT_EVERY ) {
            induction_export_set_status( $job, [ 'phase' => 'sending', 'sent' => $start + $sent, 'size' => $size ] );
            $reported = $sent;
        }
    }
    fclose( $in );

    $delivered = $start + $sent;
    $complete  = $delivered >= $size;

    induction_export_set_status( $job, [
        // "paused", not "cancelled": the bytes so far are still good and the
        // rest can be fetched. Only a discard throws the work away.
        'phase' => $complete ? 'done' : 'paused',
        'sent'  => $delivered,
        'size'  => $size,
    ] );

    $grant_key = (string) $request->get_param( 'grant_key' );
    if ( $complete ) {
        if ( '' !== $grant_key ) {
            delete_transient( $grant_key );
        }
        @unlink( $path );
    } elseif ( '' !== $grant_key ) {
        // Slide the link's window forward so a download that keeps making
        // progress does not expire part way through.
        $grant = get_transient( $grant_key );
        if ( is_array( $grant ) ) {
            set_transient( $grant_key, $grant, INDUCTION_EXPORT_LINK_TTL );
        }
    }
    exit;
}

// ── Import: upload ──────────────────────────────────────────────────────────

function induction_import_id( $raw ): string {
    return substr( (string) preg_replace( '/[^a-zA-Z0-9\-]/', '', (string) $raw ), 0, 64 );
}

function induction_import_request_id( WP_REST_Request $request, string $param ): string|WP_Error {
    $id = induction_import_id( $request->get_param( $param ) );
    if ( '' === $id ) {
        return new WP_Error( 'induction_bad_' . ( 'uploadId' === $param ? 'upload_id' : 'session' ), "Missing or invalid {$param}.", [ 'status' => 400 ] );
    }
    return $id;
}

function induction_import_part_path( string $upload_id ): string {
    return induction_transfer_dir() . 'induction-upload-' . $upload_id . '.zip.part';
}

// Removes abandoned scratch data: bulky files after a day, an unfinished session (the
// undo record) after a month, and a lock only once its session is gone.
function induction_import_sweep_stale(): void {
    $dir         = induction_transfer_dir();
    $day_ago     = time() - DAY_IN_SECONDS;
    $unfinished  = time() - INDUCTION_IMPORT_KEEP_UNFINISHED_DAYS * DAY_IN_SECONDS;
    $older_than  = static fn( string $path, int $cutoff ): bool => (int) @filemtime( $path ) < $cutoff;

    foreach ( [ 'induction-upload-*.zip.part', 'induction-session-*.tmp', 'induction-export-*.zip', 'induction-export-*.json' ] as $pattern ) {
        foreach ( glob( $dir . $pattern ) ?: [] as $path ) {
            if ( $older_than( $path, $day_ago ) ) {
                @unlink( $path );
            }
        }
    }
    foreach ( glob( $dir . 'induction-session-*.json' ) ?: [] as $path ) {
        $session = json_decode( (string) @file_get_contents( $path ), true );
        $done    = is_array( $session ) && 'done' === ( $session['phase'] ?? '' );
        if ( $older_than( $path, $done ? $day_ago : $unfinished ) ) {
            @unlink( $path );
        }
    }
    foreach ( glob( $dir . 'induction-import-*', GLOB_ONLYDIR ) ?: [] as $path ) {
        $session = induction_import_session_path( substr( basename( $path ), strlen( 'induction-import-' ) ) );
        if ( $older_than( file_exists( $session ) ? $session : $path, $day_ago ) ) {
            induction_rrmdir( $path );
        }
    }
    foreach ( glob( $dir . 'induction-session-*.lock' ) ?: [] as $path ) {
        $has_session = file_exists( substr( $path, 0, -strlen( '.lock' ) ) . '.json' );
        if ( ! $has_session && $older_than( $path, $day_ago ) ) {
            @unlink( $path );
        }
    }
}

function induction_import_chunk( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $upload_id = induction_import_request_id( $request, 'uploadId' );
    if ( is_wp_error( $upload_id ) ) {
        return $upload_id;
    }

    $index  = (int) $request->get_param( 'index' );
    $offset = null === $request->get_param( 'offset' ) ? null : (int) $request->get_param( 'offset' );
    $body   = $request->get_body();
    if ( '' === $body ) {
        $body = (string) file_get_contents( 'php://input' );
    }
    if ( '' === $body ) {
        return new WP_Error( 'induction_empty_chunk', 'Empty chunk.', [ 'status' => 400 ] );
    }

    if ( 0 === $index ) {
        induction_import_sweep_stale();
        // Peak disk use is the .part file plus its extracted copy.
        $shortfall = induction_transfer_disk_shortfall( 2 * (int) $request->get_param( 'total' ) );
        if ( $shortfall ) {
            return new WP_Error( 'induction_disk_full', $shortfall, [ 'status' => 507 ] );
        }
    }

    $part = induction_import_part_path( $upload_id );
    if ( 0 !== $index && ! file_exists( $part ) ) {
        return new WP_Error( 'induction_chunk_out_of_order', 'Upload session not found; start the import again.', [ 'status' => 409 ] );
    }

    $fh = fopen( $part, 'cb' );
    if ( ! $fh || ! flock( $fh, LOCK_EX ) ) {
        return new WP_Error( 'induction_chunk_write', 'Could not buffer the upload.', [ 'status' => 500 ] );
    }
    if ( 0 === $index ) {
        ftruncate( $fh, 0 );
    }
    $current = (int) fstat( $fh )['size'];

    // Offsets make chunks idempotent: a resent chunk is acknowledged, a gap rejected.
    $result = null;
    if ( null !== $offset && 0 !== $index ) {
        if ( $current === $offset + strlen( $body ) ) {
            $result = rest_ensure_response( [ 'received' => $index + 1, 'duplicate' => true ] );
        } elseif ( $current !== $offset ) {
            $result = new WP_Error( 'induction_chunk_gap', 'Part of the upload went missing; start the import again.', [ 'status' => 409 ] );
        }
    }
    if ( null === $result ) {
        fseek( $fh, $current );
        fwrite( $fh, $body );
        fflush( $fh );
        $result = rest_ensure_response( [ 'received' => $index + 1 ] );
    }
    flock( $fh, LOCK_UN );
    fclose( $fh );
    return $result;
}

// Streams each entry: unzip_file() loads whole entries into memory and fatals on big videos.
function induction_unzip_streaming( string $zip_path, string $dest_dir ): bool|WP_Error {
    if ( ! class_exists( 'ZipArchive' ) ) {
        return new WP_Error( 'induction_no_zip', 'The server is missing the Zip extension needed to read an export.', [ 'status' => 500 ] );
    }
    $zip = new ZipArchive();
    if ( true !== $zip->open( $zip_path ) ) {
        return new WP_Error( 'induction_bad_zip', 'That file could not be read as a zip archive.', [ 'status' => 400 ] );
    }
    if ( ! wp_mkdir_p( $dest_dir ) ) {
        $zip->close();
        return new WP_Error( 'induction_extract_dir', 'Could not create a working directory for the import.', [ 'status' => 500 ] );
    }

    for ( $i = 0; $i < $zip->numFiles; $i++ ) {
        $name = (string) $zip->getNameIndex( $i );
        $rel  = induction_transfer_safe_rel( $name );
        if ( '' === $rel ) {
            continue;
        }
        $target = rtrim( $dest_dir, '/\\' ) . '/' . $rel;
        if ( '/' === substr( $name, -1 ) ) {
            wp_mkdir_p( $target );
            continue;
        }
        wp_mkdir_p( dirname( $target ) );
        $in = $zip->getStream( $name );
        if ( ! $in ) {
            continue;
        }
        $out = fopen( $target, 'wb' );
        if ( ! $out ) {
            fclose( $in );
            $zip->close();
            return new WP_Error( 'induction_extract_write', 'Could not write an extracted file.', [ 'status' => 500 ] );
        }
        stream_copy_to_stream( $in, $out );
        fclose( $in );
        fclose( $out );
    }
    $zip->close();
    return true;
}

// Not realpath(): it returns false under Windows temp dirs and rejected every file.
function induction_import_safe_extracted_path( string $extract_dir, string $rel ): string {
    $rel = induction_transfer_safe_rel( $rel );
    if ( '' === $rel ) {
        return '';
    }
    $path = rtrim( $extract_dir, '/\\' ) . '/' . $rel;
    return is_file( $path ) || induction_import_extract_entry( $extract_dir, $rel, $path ) ? $path : '';
}

// Held open for the request: reopening rereads the whole file list.
function induction_import_archive( string $extract_dir, bool $close = false ): ?ZipArchive {
    static $open = [];
    $key = rtrim( $extract_dir, '/\\' );
    if ( $close ) {
        if ( ! empty( $open[ $key ] ) ) {
            $open[ $key ]->close();
        }
        unset( $open[ $key ] );
        return null;
    }
    if ( ! array_key_exists( $key, $open ) ) {
        $zip          = class_exists( 'ZipArchive' ) ? new ZipArchive() : null;
        $archive      = $key . '/' . INDUCTION_IMPORT_ARCHIVE;
        $open[ $key ] = $zip && is_file( $archive ) && true === $zip->open( $archive ) ? $zip : null;
    }
    return $open[ $key ];
}

function induction_import_extract_media( string $extract_dir, $entry ): void {
    if ( ! is_array( $entry ) ) {
        return;
    }
    $files = array_merge( [ $entry['file'] ?? '' ], array_column( array_filter( (array) ( $entry['sizes'] ?? [] ), 'is_array' ), 'file' ) );
    foreach ( array_filter( $files, 'is_string' ) as $rel ) {
        if ( '' !== $rel ) {
            induction_import_safe_extracted_path( $extract_dir, $rel );
        }
    }
}

// Via .part, so a copy cut short by a killed worker never looks complete.
function induction_import_extract_entry( string $extract_dir, string $rel, string $target ): bool {
    $zip = induction_import_archive( $extract_dir );
    $in  = $zip && false !== $zip->locateName( $rel ) ? $zip->getStream( $rel ) : false;
    if ( ! $in ) {
        return false;
    }
    wp_mkdir_p( dirname( $target ) );
    $out = @fopen( $target . '.part', 'wb' );
    $ok  = $out && false !== stream_copy_to_stream( $in, $out );
    fclose( $in );
    if ( $out ) {
        fclose( $out );
    }
    if ( $ok && @rename( $target . '.part', $target ) ) {
        return true;
    }
    @unlink( $target . '.part' );
    return false;
}

function induction_import_read_payload( string $extract_dir ): ?array {
    $path    = trailingslashit( $extract_dir ) . 'content.json';
    $payload = file_exists( $path ) ? json_decode( (string) file_get_contents( $path ), true ) : null;
    return is_array( $payload ) ? $payload : null;
}

function induction_import_check_format( ?array $payload ): ?WP_Error {
    if ( null === $payload || ( $payload['format'] ?? '' ) !== INDUCTION_EXPORT_FORMAT ) {
        return new WP_Error( 'induction_bad_export', 'That archive is not an induction platform export.', [ 'status' => 400 ] );
    }
    if ( (int) ( $payload['format_version'] ?? 0 ) > INDUCTION_EXPORT_FORMAT_VERSION ) {
        return new WP_Error( 'induction_export_too_new', 'That export was made by a newer version of the plugin than this site is running.', [ 'status' => 400 ] );
    }
    return null;
}

// ── Import: session store ───────────────────────────────────────────────────

final class Induction_Session_Save_Error extends RuntimeException {}

function induction_import_session_path( string $id ): string {
    return induction_transfer_dir() . 'induction-session-' . $id . '.json';
}

function induction_import_lock_path( string $id ): string {
    return induction_transfer_dir() . 'induction-session-' . $id . '.lock';
}

function induction_import_session_load( string $id ): ?array {
    $path = induction_import_session_path( $id );
    if ( ! file_exists( $path ) ) {
        return null;
    }
    $data = json_decode( (string) file_get_contents( $path ), true );
    return is_array( $data ) ? $data : null;
}

// Temp file + rename, so a killed worker never leaves a truncated session.
function induction_import_session_save( string $id, array $session ): bool {
    $path = induction_import_session_path( $id );
    $tmp  = $path . '.tmp';
    $json = wp_json_encode( $session );
    if ( ! $json || false === file_put_contents( $tmp, $json ) ) {
        return false;
    }
    if ( @rename( $tmp, $path ) ) {
        return true;
    }
    $copied = @copy( $tmp, $path );
    @unlink( $tmp );
    return $copied;
}

function induction_import_session_delete( string $id ): void {
    @unlink( induction_import_session_path( $id ) );
}

function induction_import_new_session( string $extract_dir ): array {
    return [
        'extract_dir'     => $extract_dir,
        'phase'           => 'extract',
        'cursor'          => 0,
        'processed'       => 0,
        'total'           => 0,
        'media_map'       => [],
        'module_ref_map'  => [],
        'categories_done' => false,
        'created'         => [ 'attachments' => [], 'modules' => [], 'posts' => [], 'categories' => [] ],
        'summary'         => [
            'modules'                      => 0,
            'locations'                    => 0,
            'documents'                    => 0,
            'media'                        => 0,
            'progress'                     => 0,
            'assignments'                  => 0,
            'quiz_responses'               => 0,
            'media_failed'                 => 0,
            'items_failed'                 => 0,
            'records_skipped_unknown_user' => 0,
        ],
    ];
}

function induction_import_checkpoint( array $session ): void {
    if ( ! empty( $session['id'] ) && ! induction_import_session_save( (string) $session['id'], $session ) ) {
        throw new Induction_Session_Save_Error( 'Could not save import progress.' );
    }
}

// Serialises requests per session: PHP keeps running after a client gives up and retries.
function induction_import_with_lock( string $id, callable $fn ): WP_REST_Response|WP_Error {
    $lock = @fopen( induction_import_lock_path( $id ), 'c' );
    if ( ! $lock || ! flock( $lock, LOCK_EX ) ) {
        return new WP_Error( 'induction_session_lock', 'Could not lock the import session.', [ 'status' => 500 ] );
    }
    try {
        return $fn();
    } finally {
        flock( $lock, LOCK_UN );
        fclose( $lock );
    }
}

// ── Import: endpoints ───────────────────────────────────────────────────────

function induction_import_begin( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id = induction_import_request_id( $request, 'uploadId' );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    return induction_import_with_lock( $id, fn() => induction_import_begin_locked( $id, (int) $request->get_param( 'size' ) ) );
}

function induction_import_begin_locked( string $id, int $expected_size ): WP_REST_Response|WP_Error {
    // A retried /begin whose response was lost gets the existing session back.
    $existing = induction_import_session_load( $id );
    if ( is_array( $existing ) ) {
        $payload = induction_import_read_payload( (string) ( $existing['extract_dir'] ?? '' ) ) ?? [];
        return rest_ensure_response( [ 'sessionId' => $id, 'total' => (int) ( $existing['total'] ?? 0 ), 'contents' => induction_import_contents( $payload ) ] );
    }

    $part = induction_import_part_path( $id );
    if ( ! file_exists( $part ) ) {
        return new WP_Error( 'induction_no_upload', 'No uploaded data was found for that session.', [ 'status' => 400 ] );
    }
    if ( $expected_size > 0 && (int) filesize( $part ) !== $expected_size ) {
        @unlink( $part );
        return new WP_Error( 'induction_incomplete_upload', 'The upload was incomplete; please try again.', [ 'status' => 400 ] );
    }

    // Nothing is unzipped yet: the extract phase takes only what was picked.
    $extract_dir = induction_transfer_dir() . 'induction-import-' . $id;
    induction_rrmdir( $extract_dir );
    $archive = $extract_dir . '/' . INDUCTION_IMPORT_ARCHIVE;
    $moved   = wp_mkdir_p( $extract_dir ) && ( @rename( $part, $archive ) || @copy( $part, $archive ) );
    @unlink( $part );
    if ( ! $moved ) {
        induction_rrmdir( $extract_dir );
        return new WP_Error( 'induction_extract_dir', 'Could not create a working directory for the import.', [ 'status' => 500 ] );
    }
    if ( ! induction_import_archive( $extract_dir ) ) {
        induction_rrmdir( $extract_dir );
        return new WP_Error( 'induction_bad_zip', 'That file could not be read as a zip archive.', [ 'status' => 400 ] );
    }
    induction_import_safe_extracted_path( $extract_dir, 'content.json' );

    $payload = induction_import_read_payload( $extract_dir );
    $invalid = induction_import_check_format( $payload );
    if ( $invalid ) {
        induction_import_archive( $extract_dir, true );
        induction_rrmdir( $extract_dir );
        return $invalid;
    }

    $total = 0;
    foreach ( array_keys( INDUCTION_IMPORT_NEXT_PHASE ) as $phase ) {
        $total += count( induction_import_phase_items( $payload, $phase ) );
    }

    $session          = induction_import_new_session( $extract_dir );
    $session['id']    = $id;
    $session['total'] = $total;
    induction_import_session_save( $id, $session );

    return rest_ensure_response( [ 'sessionId' => $id, 'total' => $total, 'contents' => induction_import_contents( $payload ) ] );
}

// Items are keyed by their position in the backup.
function induction_import_contents( array $payload ): array {
    $contents = [];
    foreach ( array_keys( INDUCTION_IMPORT_POST_TYPES ) as $phase ) {
        $contents[ $phase ] = [];
        foreach ( induction_import_phase_items( $payload, $phase ) as $index => $item ) {
            if ( is_array( $item ) ) {
                $contents[ $phase ][] = [
                    'index'  => $index,
                    'title'  => sanitize_text_field( (string) ( $item['title'] ?? '' ) ),
                    'status' => 'publish' === ( $item['status'] ?? '' ) ? 'publish' : 'draft',
                ];
            }
        }
    }
    return $contents;
}

function induction_import_select( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id = induction_import_request_id( $request, 'sessionId' );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    $picked = [];
    foreach ( array_keys( INDUCTION_IMPORT_POST_TYPES ) as $phase ) {
        $picked[ $phase ] = array_values( array_unique( array_map( 'intval', (array) $request->get_param( $phase ) ) ) );
    }
    return induction_import_with_lock( $id, fn() => induction_import_select_locked( $id, $picked ) );
}

// Only before the import starts. Media and records follow the picked items.
function induction_import_select_locked( string $id, array $picked ): WP_REST_Response|WP_Error {
    $session = induction_import_session_load( $id );
    if ( ! is_array( $session ) ) {
        return new WP_Error( 'induction_no_session', 'Import session not found.', [ 'status' => 404 ] );
    }
    if ( 'extract' !== $session['phase'] || $session['processed'] > 0 ) {
        return new WP_Error( 'induction_import_started', 'This import has already started.', [ 'status' => 409 ] );
    }
    $payload = induction_import_read_payload( (string) ( $session['extract_dir'] ?? '' ) );
    if ( null === $payload ) {
        return new WP_Error( 'induction_session_lost', 'The uploaded export is no longer on the server.', [ 'status' => 410 ] );
    }

    $modules     = induction_import_phase_items( $payload, 'modules' );
    $module_refs = [];
    foreach ( $picked['modules'] as $index ) {
        $module_refs[] = (string) ( $modules[ $index ]['ref'] ?? '' );
    }
    $session['selection'] = $picked + [
        'media'       => induction_import_needed_media( $payload, $picked ),
        'module_refs' => array_values( array_filter( $module_refs ) ),
    ];
    induction_import_session_save( $id, $session );
    return rest_ensure_response( [ 'selected' => true ] );
}

function induction_import_needed_media( array $payload, array $picked ): array {
    $ids       = [];
    $modules   = induction_import_phase_items( $payload, 'modules' );
    $locations = induction_import_phase_items( $payload, 'locations' );
    $documents = induction_import_phase_items( $payload, 'documents' );

    // URLs are matched against the backup's own media list: they point at the old site.
    $known     = induction_import_backup_urls( $payload );
    $url_to_id = static fn( string $url ): int => $known[ strtok( $url, '?#' ) ] ?? 0;
    foreach ( $picked['modules'] as $index ) {
        $module = $modules[ $index ] ?? null;
        if ( is_array( $module ) ) {
            $ids[] = (int) ( $module['meta']['module_hero_image'] ?? 0 );
            induction_media_ids_in_value( [ $module['blocks'] ?? [], (string) ( $module['content'] ?? '' ) ], $ids, $url_to_id );
        }
    }
    foreach ( $picked['locations'] as $index ) {
        $ids[] = (int) ( $locations[ $index ]['thumbnail_id'] ?? 0 );
    }
    foreach ( $picked['documents'] as $index ) {
        $ids[] = (int) ( $documents[ $index ]['document_file_id'] ?? 0 );
    }
    return array_values( array_unique( array_filter( $ids ) ) );
}

function induction_import_step( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    induction_transfer_no_time_limit();
    $id = induction_import_request_id( $request, 'sessionId' );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    return induction_import_with_lock( $id, fn() => induction_import_step_locked( $id ) );
}

function induction_import_step_locked( string $id ): WP_REST_Response|WP_Error {
    $session = induction_import_session_load( $id );
    if ( ! is_array( $session ) ) {
        return new WP_Error( 'induction_no_session', 'Import session not found; start the import again.', [ 'status' => 400 ] );
    }
    // Kept after finishing, so a retried final step gets the same summary.
    if ( 'done' === $session['phase'] ) {
        return rest_ensure_response( [ 'done' => true, 'summary' => $session['summary'] ] );
    }
    if ( 'undoing' === $session['phase'] ) {
        return new WP_Error( 'induction_import_undoing', 'This import is being undone.', [ 'status' => 409 ] );
    }

    $extract_dir = (string) ( $session['extract_dir'] ?? '' );
    $payload     = induction_import_read_payload( $extract_dir );
    if ( null === $payload ) {
        return new WP_Error( 'induction_session_lost', 'The uploaded export is no longer on the server, so this import cannot continue. You can undo what it added, then import again.', [ 'status' => 410 ] );
    }

    $deadline = microtime( true ) + INDUCTION_IMPORT_STEP_SECONDS;
    try {
        do {
            induction_import_advance_one( $session, $payload );
        } while ( 'done' !== $session['phase'] && microtime( true ) < $deadline );
        $saved = induction_import_session_save( $id, $session );
    } catch ( Induction_Session_Save_Error $e ) {
        $saved = false;
    }
    if ( ! $saved ) {
        return new WP_Error( 'induction_disk_full', 'The server could not save import progress (it may be out of disk space). Free some space, then resume.', [ 'status' => 507 ] );
    }

    if ( 'done' === $session['phase'] ) {
        induction_import_archive( $extract_dir, true );
        induction_rrmdir( $extract_dir ); // only now: the session is already saved as done
        return rest_ensure_response( [ 'done' => true, 'summary' => $session['summary'] ] );
    }
    return rest_ensure_response( [
        'done'      => false,
        'processed' => (int) $session['processed'],
        'total'     => (int) ( $session['total'] ?? 0 ),
    ] );
}

function induction_import_status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $id = induction_import_request_id( $request, 'sessionId' );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    return induction_import_with_lock( $id, fn() => induction_import_status_locked( $id ) );
}

function induction_import_status_locked( string $id ): WP_REST_Response|WP_Error {
    $session = induction_import_session_load( $id );
    if ( ! is_array( $session ) ) {
        return new WP_Error( 'induction_no_session', 'Import session not found.', [ 'status' => 404 ] );
    }
    $running   = ! in_array( $session['phase'], [ 'done', 'undoing' ], true );
    $resumable = $running && null !== induction_import_read_payload( (string) ( $session['extract_dir'] ?? '' ) );
    return rest_ensure_response( [
        'phase'     => (string) $session['phase'],
        'done'      => 'done' === $session['phase'],
        'resumable' => $resumable,
        'processed' => (int) $session['processed'],
        'total'     => (int) ( $session['total'] ?? 0 ),
        'summary'   => $session['summary'],
    ] );
}

function induction_import_undo( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    induction_transfer_no_time_limit();
    $id = induction_import_request_id( $request, 'sessionId' );
    if ( is_wp_error( $id ) ) {
        return $id;
    }
    return induction_import_with_lock( $id, fn() => induction_import_undo_locked( $id ) );
}

// Removes exactly what one import created, in ~5s slices like /step.
function induction_import_undo_locked( string $id ): WP_REST_Response|WP_Error {
    global $wpdb;
    $session = induction_import_session_load( $id );
    if ( ! is_array( $session ) ) {
        return new WP_Error( 'induction_no_session', 'Import session not found.', [ 'status' => 404 ] );
    }

    $session['phase']   = 'undoing'; // /step refuses from here on
    $session['created'] = (array) ( $session['created'] ?? [] );
    induction_import_discard_attempt( $session );
    $session['removed'] = (array) ( $session['removed'] ?? [] ) + [ 'attachments' => 0, 'modules' => 0, 'posts' => 0, 'rows' => 0 ];
    $created            = &$session['created'];
    $removed            = &$session['removed'];

    if ( empty( $session['rows_removed'] ) ) {
        foreach ( array_chunk( array_map( 'intval', (array) ( $created['modules'] ?? [] ) ), 500 ) as $module_ids ) {
            $in = implode( ',', $module_ids ); // ints only
            foreach ( [ 'progress', 'assignments', 'quiz_responses', 'module_versions' ] as $table ) {
                $removed['rows'] += (int) $wpdb->query( "DELETE FROM {$wpdb->prefix}induction_{$table} WHERE module_id IN ({$in})" );
            }
        }
        if ( ! empty( $created['categories'] ) ) {
            induction_save_resource_categories( array_diff_key( induction_resource_categories(), array_flip( (array) $created['categories'] ) ) );
            $created['categories'] = [];
        }
        $session['rows_removed'] = true;
        induction_import_session_save( $id, $session );
    }

    $deadline = microtime( true ) + INDUCTION_IMPORT_STEP_SECONDS;
    foreach ( [ 'posts' => 'wp_delete_post', 'modules' => 'wp_delete_post', 'attachments' => 'wp_delete_attachment' ] as $key => $delete ) {
        while ( ! empty( $created[ $key ] ) && microtime( true ) < $deadline ) {
            $delete( (int) array_pop( $created[ $key ] ), true );
            $removed[ $key ]++;
            induction_import_session_save( $id, $session );
        }
    }

    $remaining = count( $created['posts'] ?? [] ) + count( $created['modules'] ?? [] ) + count( $created['attachments'] ?? [] );
    if ( $remaining > 0 ) {
        return rest_ensure_response( [ 'done' => false, 'remaining' => $remaining, 'removed' => $removed ] );
    }
    induction_rrmdir( (string) ( $session['extract_dir'] ?? '' ) );
    induction_import_session_delete( $id );
    return rest_ensure_response( [ 'done' => true, 'removed' => $removed ] );
}

// One-shot import (multipart zip, or a v1 JSON body) for callers that don't chunk.
function induction_import_site( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $file = $request->get_file_params()['file'] ?? null;

    if ( is_array( $file ) && isset( $file['error'] ) && UPLOAD_ERR_OK !== (int) $file['error'] ) {
        $too_big = in_array( (int) $file['error'], [ UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE ], true );
        return new WP_Error(
            'induction_upload_error',
            $too_big
                ? 'That export is larger than this server accepts (upload_max_filesize / post_max_size). Raise those limits or reduce the export size.'
                : 'The upload did not complete. Please try again.',
            [ 'status' => 400 ]
        );
    }
    if ( is_array( $file ) && ! empty( $file['tmp_name'] ) && is_uploaded_file( $file['tmp_name'] ) ) {
        return induction_import_zip_file( $file['tmp_name'] );
    }

    $payload = $request->get_json_params();
    if ( is_array( $payload ) ) {
        return induction_import_from_payload( $payload, '' );
    }
    return new WP_Error( 'induction_no_file', 'No export archive was uploaded.', [ 'status' => 400 ] );
}

function induction_import_zip_file( string $zip_path ): WP_REST_Response|WP_Error {
    $extract_dir = induction_transfer_dir() . 'induction-import-' . wp_generate_uuid4();
    try {
        $unzipped = induction_unzip_streaming( $zip_path, $extract_dir );
        if ( is_wp_error( $unzipped ) ) {
            return $unzipped;
        }
        $payload = induction_import_read_payload( $extract_dir );
        return null === $payload
            ? induction_import_check_format( null )
            : induction_import_from_payload( $payload, $extract_dir );
    } finally {
        induction_rrmdir( $extract_dir );
    }
}

function induction_import_from_payload( array $payload, string $extract_dir ): WP_REST_Response|WP_Error {
    induction_transfer_no_time_limit();
    $invalid = induction_import_check_format( $payload );
    if ( $invalid ) {
        return $invalid;
    }
    $session = induction_import_new_session( $extract_dir );
    while ( 'done' !== $session['phase'] ) {
        induction_import_advance_one( $session, $payload );
    }
    return rest_ensure_response( [ 'imported' => true, 'summary' => $session['summary'] ] );
}

// ── Import: engine ──────────────────────────────────────────────────────────

// Content references media by id, and records reference modules by ref. Media is unzipped
// in bulk first: unzipping each file just before use was ~40% slower on Windows.
const INDUCTION_IMPORT_NEXT_PHASE = [
    'extract'        => 'media',
    'media'          => 'modules',
    'modules'        => 'locations',
    'locations'      => 'documents',
    'documents'      => 'progress',
    'progress'       => 'assignments',
    'assignments'    => 'quiz_responses',
    'quiz_responses' => 'done',
];

const INDUCTION_IMPORT_POST_TYPES = [
    'modules'   => 'induction_module',
    'locations' => 'induction_location',
    'documents' => 'induction_document',
];

// Cached: rebuilding the list for every item would make big imports quadratic.
function induction_import_phase_items( array $payload, string $phase ): array {
    static $cache = [];
    if ( isset( $cache[ $phase ] ) ) {
        return $cache[ $phase ];
    }
    if ( 'media' === $phase || 'extract' === $phase ) {
        $items = [];
        foreach ( (array) ( $payload['media'] ?? [] ) as $old_id => $entry ) {
            $items[] = [ $old_id, $entry ];
        }
    } elseif ( isset( INDUCTION_IMPORT_POST_TYPES[ $phase ] ) ) {
        $items = array_values( (array) ( $payload[ $phase ] ?? [] ) );
    } else {
        $items = array_values( (array) ( $payload['records'][ $phase ] ?? [] ) );
    }
    return $cache[ $phase ] = $items;
}

// One item. Media and posts are checkpointed, so a crash resumes at the right place. An item
// that was mid-flight when PHP died is skipped, or one bad file would stall the import forever.
function induction_import_advance_one( array &$session, array $payload ): void {
    $phase = (string) $session['phase'];
    if ( ! isset( INDUCTION_IMPORT_NEXT_PHASE[ $phase ] ) ) {
        $session['phase'] = 'done';
        return;
    }
    if ( 'documents' === $phase && empty( $session['categories_done'] ) ) {
        $session['created']['categories'] = induction_import_categories( (array) ( $payload['resource_categories'] ?? [] ) );
        $session['categories_done']       = true;
        induction_import_checkpoint( $session );
    }

    $items = induction_import_phase_items( $payload, $phase );
    $i     = (int) $session['cursor'];
    if ( $i >= count( $items ) ) {
        $session['phase']  = INDUCTION_IMPORT_NEXT_PHASE[ $phase ];
        $session['cursor'] = 0;
        return;
    }

    if ( ! induction_import_is_selected( $session, $phase, $i, $items[ $i ] ) ) {
        $session['cursor'] = $i + 1;
        $session['processed']++;
        return;
    }

    $guarded  = 'media' === $phase || isset( INDUCTION_IMPORT_POST_TYPES[ $phase ] );
    $marker   = "{$phase}:{$i}";
    $fail_key = 'media' === $phase ? 'media_failed' : 'items_failed';

    if ( $guarded && ( $session['attempt'] ?? '' ) === $marker ) {
        $session['summary'][ $fail_key ]++;
        induction_import_discard_attempt( $session );
    } else {
        if ( $guarded ) {
            $session['attempt'] = $marker;
            induction_import_checkpoint( $session );
        }
        try {
            induction_import_one_item( $session, $payload, $phase, $items[ $i ] );
        } catch ( Induction_Session_Save_Error $e ) {
            throw $e;
        } catch ( \Throwable $e ) {
            // A TypeError on one malformed row fails that item, not the step.
            $session['summary'][ $fail_key ]++;
            induction_import_discard_attempt( $session );
            error_log( "induction import: {$marker} failed: " . $e->getMessage() );
        }
    }

    induction_import_clear_attempt( $session );
    $session['cursor'] = $i + 1;
    $session['processed']++;
    if ( $guarded ) {
        induction_import_checkpoint( $session );
    }
}

// Everything is selected until /import/select narrows it. Records follow their module.
function induction_import_is_selected( array $session, string $phase, int $index, $item ): bool {
    $selection = $session['selection'] ?? null;
    if ( null === $selection ) {
        return true;
    }
    if ( 'media' === $phase || 'extract' === $phase ) {
        return in_array( (int) $item[0], $selection['media'], true );
    }
    if ( isset( INDUCTION_IMPORT_POST_TYPES[ $phase ] ) ) {
        return in_array( $index, $selection[ $phase ], true );
    }
    return is_array( $item ) && in_array( (string) ( $item['module_ref'] ?? '' ), $selection['module_refs'], true );
}

// Every upload URL in the backup (full size and thumbnails) -> its old attachment id.
function induction_import_backup_urls( array $payload ): array {
    $urls = [];
    foreach ( induction_import_phase_items( $payload, 'media' ) as [ $old_id, $entry ] ) {
        if ( ! is_array( $entry ) || empty( $entry['url'] ) ) {
            continue;
        }
        $urls[ (string) $entry['url'] ] = (int) $old_id;
        foreach ( (array) ( $entry['sizes'] ?? [] ) as $size ) {
            if ( is_array( $size ) && ! empty( $size['file'] ) ) {
                $urls[ dirname( (string) $entry['url'] ) . '/' . basename( (string) $size['file'] ) ] = (int) $old_id;
            }
        }
    }
    return $urls;
}

function induction_import_clear_attempt( array &$session ): void {
    unset( $session['attempt'], $session['attempt_attachment'], $session['attempt_file'], $session['attempt_post'] );
}

function induction_import_discard_attempt( array &$session ): void {
    global $wpdb;
    $post       = (int) ( $session['attempt_post'] ?? 0 );
    $attachment = (int) ( $session['attempt_attachment'] ?? 0 );
    if ( $post ) {
        wp_delete_post( $post, true );
        $wpdb->delete( $wpdb->prefix . 'induction_module_versions', [ 'module_id' => $post ] );
        induction_import_forget( $session, 'modules', $post );
        induction_import_forget( $session, 'posts', $post );
    } elseif ( $attachment ) {
        wp_delete_attachment( $attachment, true );
        induction_import_forget( $session, 'attachments', $attachment );
    } elseif ( ! empty( $session['attempt_file'] ) && is_file( $session['attempt_file'] ) ) {
        @unlink( $session['attempt_file'] );
    }
    induction_import_clear_attempt( $session );
}

function induction_import_forget( array &$session, string $key, int $id ): void {
    $session['created'][ $key ] = array_values( array_diff( (array) ( $session['created'][ $key ] ?? [] ), [ $id ] ) );
}

function induction_import_one_item( array &$session, array $payload, string $phase, $item ): void {
    if ( 'extract' === $phase ) {
        induction_import_extract_media( (string) $session['extract_dir'], $item[1] );
        return;
    }
    if ( 'media' === $phase ) {
        induction_import_one_media( $session, $item );
        return;
    }
    if ( ! is_array( $item ) ) {
        return;
    }
    if ( ! isset( INDUCTION_IMPORT_POST_TYPES[ $phase ] ) ) {
        // Record rows: undo removes them by module_id, so they need no tracking.
        $result = induction_import_one_record( $phase, $item, (array) $session['module_ref_map'] );
        if ( 'imported' === $result ) {
            $session['summary'][ $phase ]++;
        } elseif ( 'skipped' === $result ) {
            $session['summary']['records_skipped_unknown_user']++;
        }
        return;
    }

    if ( 'modules' === $phase ) {
        $item = induction_import_remap_module( $item, $payload, (array) $session['media_map'] );
    }
    $id = induction_import_insert_post( INDUCTION_IMPORT_POST_TYPES[ $phase ], $item );
    if ( ! $id ) {
        return;
    }
    // Recorded before its meta is written, so undo and a crash retry can find it.
    $list                            = 'modules' === $phase ? 'modules' : 'posts';
    $session['attempt_post']         = $id;
    $session['created'][ $list ][]   = $id;
    induction_import_checkpoint( $session );

    $media_map = (array) $session['media_map'];
    if ( 'modules' === $phase ) {
        induction_import_module_meta( $id, $item );
        if ( ! empty( $item['ref'] ) ) {
            $session['module_ref_map'][ (string) $item['ref'] ] = $id;
        }
    } elseif ( 'locations' === $phase ) {
        induction_import_location_meta( $id, $item, $media_map );
    } else {
        induction_import_document_meta( $id, $item, $media_map );
    }
    $session['summary'][ $phase ]++;
}

function induction_import_one_media( array &$session, array $item ): void {
    [ $old_id, $entry ] = $item;
    if ( ! is_array( $entry ) ) {
        return;
    }
    $file = induction_import_place_media( $entry, (string) $session['extract_dir'] );
    if ( ! $file ) {
        $session['summary']['media_failed']++;
        return;
    }
    $session['attempt_file'] = $file['path'];
    induction_import_checkpoint( $session );

    $id = induction_import_insert_attachment( $entry, $file );
    if ( ! $id ) {
        @unlink( $file['path'] );
        $session['summary']['media_failed']++;
        return;
    }
    $session['attempt_attachment']        = $id;
    $session['created']['attachments'][] = $id;
    induction_import_checkpoint( $session );

    $meta = induction_import_restore_sizes( $entry, $file, (string) $session['extract_dir'] );
    if ( null === $meta ) {
        // Slow, and the step most likely to kill PHP; everything above is already recorded.
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $meta = wp_generate_attachment_metadata( $id, $file['path'] );
    }
    wp_update_attachment_metadata( $id, $meta );
    $session['media_map'][ (int) $old_id ] = $id;
    $session['summary']['media']++;
}

// ── Import: item helpers ────────────────────────────────────────────────────

// From the zip (v2), embedded base64 (v1) or its URL. Returns [ path, name, type ] or null.
function induction_import_place_media( array $entry, string $extract_dir ): ?array {
    require_once ABSPATH . 'wp-admin/includes/file.php';

    $filename = sanitize_file_name( (string) ( $entry['filename'] ?? 'import' ) );
    $src      = '';
    $cleanup  = '';

    if ( ! empty( $entry['file'] ) && '' !== $extract_dir ) {
        $src = induction_import_safe_extracted_path( $extract_dir, (string) $entry['file'] );
    }
    if ( '' === $src && ! empty( $entry['data'] ) ) {
        $bytes = base64_decode( (string) $entry['data'], true );
        if ( false !== $bytes ) {
            $src     = wp_tempnam( $filename );
            $cleanup = $src;
            if ( false === file_put_contents( $src, $bytes ) ) {
                @unlink( $src );
                return null;
            }
        }
    }
    if ( '' === $src && ! empty( $entry['url'] ) ) {
        $tmp = download_url( (string) $entry['url'], INDUCTION_IMPORT_URL_TIMEOUT );
        if ( ! is_wp_error( $tmp ) ) {
            $src     = $tmp;
            $cleanup = $tmp;
        }
    }
    if ( '' === $src ) {
        return null;
    }

    // Untrusted archive: same type check as a normal upload, or x.php could land in uploads.
    $check = wp_check_filetype_and_ext( $src, $filename );
    if ( ! empty( $check['proper_filename'] ) ) {
        $filename = $check['proper_filename'];
    }
    $allowed    = $check['type'] || current_user_can( 'unfiltered_upload' );
    $upload_dir = wp_upload_dir();
    if ( ! $allowed || ! empty( $upload_dir['error'] ) ) {
        if ( '' !== $cleanup ) {
            @unlink( $cleanup );
        }
        return null;
    }

    $name  = induction_import_free_name( $upload_dir['path'], $filename, induction_import_size_suffixes( $entry ) );
    $path  = trailingslashit( $upload_dir['path'] ) . $name;
    $moved = @rename( $src, $path ) || @copy( $src, $path );
    if ( '' !== $cleanup ) {
        @unlink( $cleanup );
    }
    return $moved ? [ 'path' => $path, 'name' => $name, 'type' => $check['type'] ?: 'application/octet-stream' ] : null;
}

// Not wp_unique_filename(): it scans the whole upload folder on every call, which made
// imports crawl. A name is free when neither it nor its thumbnail names exist yet.
function induction_import_free_name( string $dir, string $filename, array $suffixes ): string {
    $ext  = pathinfo( $filename, PATHINFO_EXTENSION );
    $dot  = '' !== $ext ? ".{$ext}" : '';
    $base = pathinfo( $filename, PATHINFO_FILENAME );
    for ( $n = 0; ; $n++ ) {
        $stem  = $n ? "{$base}-{$n}" : $base;
        $taken = file_exists( "{$dir}/{$stem}{$dot}" );
        foreach ( $suffixes as $suffix ) {
            $taken = $taken || file_exists( "{$dir}/{$stem}-{$suffix}" );
        }
        if ( ! $taken ) {
            return $stem . $dot;
        }
    }
}

function induction_import_size_suffix( array $size, string $ext ): string {
    return sprintf( '%dx%d.%s', (int) ( $size['width'] ?? 0 ), (int) ( $size['height'] ?? 0 ), $ext );
}

function induction_import_size_suffixes( array $entry ): array {
    $suffixes = [];
    foreach ( (array) ( $entry['sizes'] ?? [] ) as $size ) {
        if ( is_array( $size ) && ! empty( $size['file'] ) ) {
            $suffixes[] = induction_import_size_suffix( $size, pathinfo( (string) $size['file'], PATHINFO_EXTENSION ) );
        }
    }
    return $suffixes;
}

// Null when the export has no thumbnails (older exports, non-images): the caller regenerates.
function induction_import_restore_sizes( array $entry, array $file, string $extract_dir ): ?array {
    if ( ! isset( $entry['sizes'] ) || ! is_array( $entry['sizes'] ) || '' === $extract_dir ) {
        return null;
    }
    if ( 0 !== strpos( $file['type'], 'image/' ) ) {
        return null;
    }

    $dir   = dirname( $file['path'] );
    $stem  = pathinfo( $file['name'], PATHINFO_FILENAME );
    $sizes = [];
    foreach ( $entry['sizes'] as $name => $size ) {
        $src  = is_array( $size ) ? induction_import_safe_extracted_path( $extract_dir, (string) ( $size['file'] ?? '' ) ) : '';
        $base = sanitize_file_name( basename( (string) ( $size['file'] ?? '' ) ) );
        $type = '' !== $src ? wp_check_filetype_and_ext( $src, $base )['type'] : false;
        if ( ! $type ) {
            continue;
        }
        // Two sizes can share dimensions, and so a file.
        $target = $stem . '-' . induction_import_size_suffix( $size, pathinfo( $base, PATHINFO_EXTENSION ) );
        if ( file_exists( "{$dir}/{$target}" ) || @rename( $src, "{$dir}/{$target}" ) || @copy( $src, "{$dir}/{$target}" ) ) {
            $sizes[ sanitize_key( (string) $name ) ] = [
                'file'      => $target,
                'width'     => (int) ( $size['width'] ?? 0 ),
                'height'    => (int) ( $size['height'] ?? 0 ),
                'mime-type' => $type,
            ];
        }
    }

    $dimensions = @getimagesize( $file['path'] );
    return [
        'width'      => (int) ( $dimensions[0] ?? $entry['width'] ?? 0 ),
        'height'     => (int) ( $dimensions[1] ?? $entry['height'] ?? 0 ),
        'file'       => _wp_relative_upload_path( $file['path'] ),
        'filesize'   => (int) filesize( $file['path'] ),
        'sizes'      => $sizes,
        'image_meta' => [],
    ];
}

function induction_import_insert_attachment( array $entry, array $file ): int {
    $id = wp_insert_attachment( [
        'post_mime_type' => $file['type'],
        'post_title'     => (string) ( $entry['title'] ?? $file['name'] ),
        'post_status'    => 'inherit',
    ], $file['path'] );
    return is_wp_error( $id ) ? 0 : (int) $id;
}

// Old upload URL -> new URL for everything imported so far, thumbnails included.
function induction_import_url_map( array $payload, array $media_map ): array {
    static $map   = [];
    static $built = -1;
    if ( count( $media_map ) === $built ) {
        return $map;
    }
    $map = [];
    foreach ( induction_import_phase_items( $payload, 'media' ) as [ $old_id, $entry ] ) {
        $new_id = $media_map[ (int) $old_id ] ?? 0;
        if ( ! $new_id || ! is_array( $entry ) || empty( $entry['url'] ) ) {
            continue;
        }
        $new_url                        = (string) wp_get_attachment_url( $new_id );
        $map[ (string) $entry['url'] ] = $new_url;
        $meta                           = wp_get_attachment_metadata( $new_id );
        foreach ( (array) ( $entry['sizes'] ?? [] ) as $name => $size ) {
            $new_file = $meta['sizes'][ sanitize_key( (string) $name ) ]['file'] ?? '';
            if ( is_array( $size ) && ! empty( $size['file'] ) && '' !== $new_file ) {
                $map[ dirname( (string) $entry['url'] ) . '/' . basename( (string) $size['file'] ) ] = dirname( $new_url ) . '/' . $new_file;
            }
        }
    }
    $built = count( $media_map );
    return $map;
}

// Points id fields, upload URLs and wp-image-N classes at the restored media.
function induction_import_remap_content( $value, array $media_map, array $url_map ) {
    if ( is_string( $value ) ) {
        if ( false !== strpos( $value, '/uploads/' ) ) {
            $value = strtr( $value, $url_map );
        }
        if ( false !== strpos( $value, 'wp-image-' ) ) {
            $value = preg_replace_callback( '/wp-image-(\d+)/', static fn( $m ) => 'wp-image-' . ( $media_map[ (int) $m[1] ] ?? $m[1] ), $value );
        }
        return $value;
    }
    if ( ! is_array( $value ) ) {
        return $value;
    }
    foreach ( $value as $key => $child ) {
        $is_id         = in_array( $key, INDUCTION_MEDIA_ID_KEYS, true ) && is_numeric( $child ) && (int) $child > 0;
        $value[ $key ] = $is_id ? ( $media_map[ (int) $child ] ?? 0 ) : induction_import_remap_content( $child, $media_map, $url_map );
    }
    if ( ! empty( $value['mediaId'] ) && isset( $value['url'] ) ) {
        $value['url'] = (string) wp_get_attachment_url( (int) $value['mediaId'] );
    }
    if ( ! empty( $value['heroImageMediaId'] ) && isset( $value['heroImage'] ) ) {
        $value['heroImage'] = (string) wp_get_attachment_url( (int) $value['heroImageMediaId'] );
    }
    return $value;
}

function induction_import_remap_module( array $module, array $payload, array $media_map ): array {
    $url_map           = induction_import_url_map( $payload, $media_map );
    $sections          = induction_import_clean_sections( induction_normalize_sections( (array) ( $module['blocks'] ?? [] ) ) );
    $module['blocks']  = induction_import_remap_content( $sections, $media_map, $url_map );
    $module['content'] = induction_import_remap_content( (string) ( $module['content'] ?? '' ), $media_map, $url_map );

    $meta                      = (array) ( $module['meta'] ?? [] );
    $hero                      = (int) ( $meta['module_hero_image'] ?? 0 );
    $meta['module_hero_image'] = $hero ? ( $media_map[ $hero ] ?? 0 ) : 0;
    $module['meta']            = $meta;
    return $module;
}

// Import bypasses the editor, so drop malformed sections: every reader assumes arrays.
function induction_import_clean_sections( array $sections ): array {
    $clean = [];
    foreach ( $sections as $section ) {
        if ( ! is_array( $section ) ) {
            continue;
        }
        $section['blocks']     = array_values( array_filter( (array) ( $section['blocks'] ?? [] ), 'is_array' ) );
        $section['quizBlocks'] = array_values( array_filter( (array) ( $section['quizBlocks'] ?? [] ), 'is_array' ) );
        $clean[]               = $section;
    }
    return $clean;
}

// Always created fresh; import never overwrites. Returns the new id, or 0.
function induction_import_insert_post( string $type, array $item ): int {
    global $wpdb;
    $title = sanitize_text_field( (string) ( $item['title'] ?? '' ) );
    // A copy beside a current version is labelled and starts as a draft, for review.
    $taken = '' !== $title && $wpdb->get_var( $wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_title = %s AND post_status IN ('publish', 'draft') LIMIT 1",
        $type,
        $title
    ) );
    $status = 'publish' === ( $item['status'] ?? 'draft' ) ? 'publish' : 'draft';
    if ( $taken ) {
        $title .= ' (restored ' . wp_date( 'j M' ) . ')';
        $status = 'draft';
    }
    $post = [
        'post_type'   => $type,
        'post_title'  => $title,
        'post_status' => $status,
    ];
    if ( 'induction_module' === $type ) {
        $post['post_content'] = wp_kses_post( (string) ( $item['content'] ?? '' ) );
        $post['post_excerpt'] = sanitize_text_field( (string) ( $item['excerpt'] ?? '' ) );
    }
    $id = wp_insert_post( $post, true );
    return is_wp_error( $id ) ? 0 : (int) $id;
}

// $module has already been through induction_import_remap_module().
function induction_import_module_meta( int $id, array $module ): void {
    $meta     = (array) ( $module['meta'] ?? [] );
    $sections = (array) ( $module['blocks'] ?? [] );
    update_post_meta( $id, 'module_role_targets', (array) ( $meta['module_role_targets'] ?? [] ) );
    update_post_meta( $id, 'module_estimated_minutes', (int) ( $meta['module_estimated_minutes'] ?? 0 ) );
    update_post_meta( $id, 'module_order', (int) ( $meta['module_order'] ?? 0 ) );
    update_post_meta( $id, 'module_duration_days', (int) ( $meta['module_duration_days'] ?? 0 ) );
    update_post_meta( $id, 'module_icon', induction_slash_meta( sanitize_text_field( (string) ( $meta['module_icon'] ?? '' ) ) ) );
    update_post_meta( $id, 'module_hero_image', (int) ( $meta['module_hero_image'] ?? 0 ) );
    update_post_meta( $id, 'quiz_pass_threshold', (int) ( $meta['quiz_pass_threshold'] ?? 70 ) );

    $encoded = induction_encode_meta_json( $sections );
    if ( null !== $encoded ) {
        update_post_meta( $id, 'module_blocks', induction_slash_meta( $encoded ) );
        induction_snapshot_module_blocks( $id, $encoded );
    }
}

function induction_import_location_meta( int $id, array $loc, array $media_map ): void {
    $thumb = (int) ( $loc['thumbnail_id'] ?? 0 );
    induction_save_location_meta( $id, [
        'address'      => (string) ( $loc['address'] ?? '' ),
        'lat'          => (float) ( $loc['lat'] ?? 0 ),
        'lng'          => (float) ( $loc['lng'] ?? 0 ),
        'zoom'         => (int) ( $loc['zoom'] ?? 17 ),
        'thumbnail_id' => $thumb ? ( $media_map[ $thumb ] ?? 0 ) : 0,
        'notes'        => (string) ( $loc['notes'] ?? '' ),
        'markers'      => (string) ( $loc['markers'] ?? '[]' ),
        'paths'        => (string) ( $loc['paths'] ?? '[]' ),
    ] );
}

function induction_import_document_meta( int $id, array $doc, array $media_map ): void {
    $file = (int) ( $doc['document_file_id'] ?? 0 );
    update_post_meta( $id, 'document_category', induction_slash_meta( sanitize_text_field( (string) ( $doc['document_category'] ?? '' ) ) ) );
    update_post_meta( $id, 'document_file_id', $file ? ( $media_map[ $file ] ?? 0 ) : 0 );
    // An archive written before documents had an audience holds nothing here,
    // and those documents were visible to everyone on the site they came from.
    // Restoring them as "no audience" would hide them instead, which is a
    // silent change to what staff can see — so the old behaviour is recorded
    // explicitly rather than inferred.
    $targets = (array) ( $doc['document_role_targets'] ?? [] );
    update_post_meta( $id, 'document_role_targets', $targets ?: [ 'all' ] );
}

// Never overwrites an existing label. Returns the slugs it added, for undo.
function induction_import_categories( array $incoming ): array {
    if ( ! $incoming ) {
        return [];
    }
    $merged = induction_resource_categories();
    $added  = [];
    foreach ( $incoming as $slug => $label ) {
        if ( count( $merged ) >= INDUCTION_RESOURCE_CATEGORY_MAX ) {
            break;
        }
        $slug  = sanitize_key( (string) $slug );
        $label = mb_substr( sanitize_text_field( is_scalar( $label ) ? (string) $label : '' ), 0, INDUCTION_RESOURCE_CATEGORY_LABEL_MAX_LENGTH );
        if ( '' !== $slug && '' !== $label && ! isset( $merged[ $slug ] ) ) {
            $merged[ $slug ] = $label;
            $added[]         = $slug;
        }
    }
    induction_save_resource_categories( $merged );
    return $added;
}

function induction_import_resolve_user( array $ref ): int {
    foreach ( [ 'login', 'email' ] as $field ) {
        if ( ! empty( $ref[ $field ] ) && is_string( $ref[ $field ] ) ) {
            $user = get_user_by( $field, $ref[ $field ] );
            if ( $user ) {
                return (int) $user->ID;
            }
        }
    }
    return 0;
}

// Returns 'imported', 'skipped' (no matching user or module) or 'duplicate'.
function induction_import_one_record( string $table, array $row, array $module_ref_map ): string {
    global $wpdb;
    $user_id   = induction_import_resolve_user( (array) ( $row['user'] ?? [] ) );
    $module_id = $module_ref_map[ (string) ( $row['module_ref'] ?? '' ) ] ?? 0;
    if ( ! $user_id || ! $module_id ) {
        return 'skipped';
    }
    unset( $row['user'], $row['module_ref'] );
    $row['user_id']   = $user_id;
    $row['module_id'] = (int) $module_id;
    if ( 'assignments' === $table ) {
        $row['assigned_by'] = get_current_user_id();
    }

    // Only columns this table has: one unknown column (from a newer export) fails the insert.
    static $columns = [];
    $table_name     = $wpdb->prefix . 'induction_' . $table;
    if ( ! isset( $columns[ $table_name ] ) ) {
        $columns[ $table_name ] = array_flip( (array) $wpdb->get_col( "SHOW COLUMNS FROM `{$table_name}`" ) );
    }
    $row = array_filter(
        array_intersect_key( $row, $columns[ $table_name ] ),
        static fn( $value ) => null === $value || is_scalar( $value )
    );
    unset( $row['id'] );
    // A duplicate row hits a unique key: the intended no-op on re-import.
    return $wpdb->insert( $table_name, $row ) ? 'imported' : 'duplicate';
}

// ─── Module Content History ─────────────────────────────────────────────────

// Appends the given blocks JSON as the module's next version. A save that
// didn't change the sections (renaming the module, changing its icon) is not a
// new version, so identical content is skipped by hash — otherwise history
// fills with duplicates and the useful entries scroll away.
function induction_snapshot_module_blocks( int $module_id, string $blocks_json, ?int $author_id = null ): void {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_module_versions';
    $hash  = sha1( $blocks_json );

    $latest = $wpdb->get_row( $wpdb->prepare(
        "SELECT version, blocks_hash FROM $table WHERE module_id = %d ORDER BY version DESC LIMIT 1",
        $module_id
    ), ARRAY_A );

    if ( $latest && $latest['blocks_hash'] === $hash ) {
        return;
    }

    $decoded = json_decode( $blocks_json, true );

    $wpdb->insert( $table, [
        'module_id'     => $module_id,
        'version'       => $latest ? (int) $latest['version'] + 1 : 1,
        'blocks_json'   => $blocks_json,
        'blocks_hash'   => $hash,
        'section_count' => is_array( $decoded ) ? count( $decoded ) : 0,
        'author_id'     => $author_id ?: ( get_current_user_id() ?: null ),
        'created_at'    => current_time( 'mysql' ),
    ] );

    induction_prune_module_versions( $module_id );
}

function induction_prune_module_versions( int $module_id ): void {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_module_versions';

    $keep = $wpdb->get_col( $wpdb->prepare(
        "SELECT id FROM $table WHERE module_id = %d ORDER BY version DESC LIMIT %d",
        $module_id,
        INDUCTION_MODULE_VERSION_LIMIT
    ) );

    if ( count( $keep ) < INDUCTION_MODULE_VERSION_LIMIT ) {
        return;
    }

    $placeholders = implode( ',', array_fill( 0, count( $keep ), '%d' ) );
    $wpdb->query( $wpdb->prepare(
        "DELETE FROM $table WHERE module_id = %d AND id NOT IN ($placeholders)",
        array_merge( [ $module_id ], array_map( 'intval', $keep ) )
    ) );
}

// Captures whatever is already stored as version 1, the first time a module is
// edited after this feature landed. Without it the state that existed before
// versioning began would be the one thing history couldn't get back — i.e. the
// version an author is most likely to want on the day they upgrade.
function induction_seed_module_version_history( int $module_id ): void {
    global $wpdb;
    $table = $wpdb->prefix . 'induction_module_versions';

    $existing_rows = (int) $wpdb->get_var( $wpdb->prepare(
        "SELECT COUNT(*) FROM $table WHERE module_id = %d",
        $module_id
    ) );
    if ( $existing_rows > 0 ) {
        return;
    }

    $stored = (string) get_post_meta( $module_id, 'module_blocks', true );
    if ( '' === $stored || '[]' === $stored ) {
        return;
    }

    induction_snapshot_module_blocks( $module_id, $stored, null );
}

function induction_get_module_versions( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    global $wpdb;
    $module_id = (int) $request['id'];
    $post      = get_post( $module_id );
    if ( ! $post || 'induction_module' !== $post->post_type ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }

    $table = $wpdb->prefix . 'induction_module_versions';
    // blocks_json is deliberately excluded — a list of 30 large payloads is not
    // what the history panel needs, and it's fetched per version on restore.
    $rows = $wpdb->get_results( $wpdb->prepare(
        "SELECT version, blocks_hash, section_count, author_id, created_at, CHAR_LENGTH(blocks_json) AS size_bytes
         FROM $table WHERE module_id = %d ORDER BY version DESC",
        $module_id
    ), ARRAY_A ) ?? [];

    $current_hash = sha1( (string) ( get_post_meta( $module_id, 'module_blocks', true ) ?: '[]' ) );

    return rest_ensure_response( array_map( function ( $row ) use ( $current_hash ) {
        $author = $row['author_id'] ? get_userdata( (int) $row['author_id'] ) : null;
        return [
            'version'       => (int) $row['version'],
            'section_count' => (int) $row['section_count'],
            'size_bytes'    => (int) $row['size_bytes'],
            'author_name'   => $author ? $author->display_name : '',
            'created_at'    => $row['created_at'],
            'is_current'    => $row['blocks_hash'] === $current_hash,
        ];
    }, $rows ) );
}

function induction_get_module_version( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    global $wpdb;
    $module_id = (int) $request['id'];
    $version   = (int) $request['version'];
    $table     = $wpdb->prefix . 'induction_module_versions';

    $blocks = $wpdb->get_var( $wpdb->prepare(
        "SELECT blocks_json FROM $table WHERE module_id = %d AND version = %d",
        $module_id,
        $version
    ) );

    if ( null === $blocks ) {
        return new WP_Error( 'not_found', 'Version not found.', [ 'status' => 404 ] );
    }

    return rest_ensure_response( [ 'version' => $version, 'blocks' => $blocks ] );
}

// Restore writes the old content forward as a new version rather than rewinding
// the history, so restoring is itself undoable and nothing is ever destroyed.
function induction_restore_module_version( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    global $wpdb;
    $module_id = (int) $request['id'];
    $version   = (int) $request['version'];

    $post = get_post( $module_id );
    if ( ! $post || 'induction_module' !== $post->post_type ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }

    $table  = $wpdb->prefix . 'induction_module_versions';
    $blocks = $wpdb->get_var( $wpdb->prepare(
        "SELECT blocks_json FROM $table WHERE module_id = %d AND version = %d",
        $module_id,
        $version
    ) );
    if ( null === $blocks ) {
        return new WP_Error( 'not_found', 'Version not found.', [ 'status' => 404 ] );
    }

    $decoded = json_decode( (string) $blocks, true );
    if ( ! is_array( $decoded ) ) {
        return new WP_Error(
            'induction_version_unreadable',
            'That version could not be read back and was not restored. Nothing was changed.',
            [ 'status' => 500 ]
        );
    }

    $encoded = induction_encode_meta_json( $decoded );
    if ( null === $encoded ) {
        return new WP_Error(
            'induction_blocks_encode_failed',
            'That version could not be encoded for storage. Nothing was changed.',
            [ 'status' => 500 ]
        );
    }

    update_post_meta( $module_id, 'module_blocks', induction_slash_meta( $encoded ) );
    induction_snapshot_module_blocks( $module_id, $encoded );

    return rest_ensure_response( induction_format_module( get_post( $module_id ) ) );
}

// ─── Section header images ──────────────────────────────────────────────────
// Section heroes used to be typed-in URLs that a backup can't carry.

// [ module id => [ section index => url ] ] for heroes with no media id yet.
function induction_linked_section_images(): array {
    $found = [];
    $ids   = get_posts( [ 'post_type' => 'induction_module', 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids' ] );
    foreach ( $ids as $module_id ) {
        $sections = json_decode( (string) ( get_post_meta( $module_id, 'module_blocks', true ) ?: '[]' ), true );
        foreach ( induction_normalize_sections( $sections ) as $i => $section ) {
            $url = is_array( $section ) ? trim( (string) ( $section['heroImage'] ?? '' ) ) : '';
            if ( '' !== $url && empty( $section['heroImageMediaId'] ) ) {
                $found[ (int) $module_id ][ $i ] = $url;
            }
        }
    }
    return $found;
}

function induction_count_linked_section_images(): WP_REST_Response {
    return rest_ensure_response( [ 'count' => array_sum( array_map( 'count', induction_linked_section_images() ) ) ] );
}

// `skip` holds URLs that already failed this run, so dead links aren't retried.
function induction_copy_linked_section_images( WP_REST_Request $request ): WP_REST_Response {
    $deadline = microtime( true ) + INDUCTION_IMPORT_STEP_SECONDS;
    $skip     = array_map( 'strval', (array) ( $request->get_param( 'skip' ) ?? [] ) );
    $copied   = 0;
    $failed   = [];

    foreach ( induction_linked_section_images() as $module_id => $heroes ) {
        $sections = induction_normalize_sections( json_decode( (string) get_post_meta( $module_id, 'module_blocks', true ), true ) );
        $changed  = false;

        foreach ( $heroes as $i => $url ) {
            if ( in_array( $url, $skip, true ) || microtime( true ) > $deadline ) {
                continue;
            }
            $id = induction_section_image_attachment( $url );
            if ( is_wp_error( $id ) ) {
                $skip[]   = $url;
                $failed[] = [ 'url' => $url, 'module' => get_the_title( $module_id ) ?: '(Untitled module)', 'error' => $id->get_error_message() ];
                continue;
            }
            $sections[ $i ]['heroImageMediaId'] = $id;
            $sections[ $i ]['heroImage']        = (string) wp_get_attachment_url( $id );
            $changed                            = true;
            $copied++;
        }

        $encoded = $changed ? induction_encode_meta_json( $sections ) : null;
        if ( null !== $encoded ) {
            induction_seed_module_version_history( $module_id );
            update_post_meta( $module_id, 'module_blocks', induction_slash_meta( $encoded ) );
            induction_snapshot_module_blocks( $module_id, $encoded );
        }
    }

    $remaining = 0;
    foreach ( induction_linked_section_images() as $heroes ) {
        $remaining += count( array_diff( $heroes, $skip ) );
    }

    return rest_ensure_response( [ 'copied' => $copied, 'failed' => $failed, 'remaining' => $remaining ] );
}

// Sections often share an image, so each URL is downloaded once.
function induction_section_image_attachment( string $url ): int|WP_Error {
    $existing = induction_attachment_id_from_url( $url );
    if ( $existing ) {
        return $existing;
    }
    $copies = get_posts( [
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_key'       => '_induction_source_url',
        'meta_value'     => $url,
    ] );
    if ( $copies ) {
        return (int) $copies[0];
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $tmp = download_url( $url, 30 );
    if ( is_wp_error( $tmp ) ) {
        return $tmp;
    }

    // Stock-photo URLs often have no extension.
    $extensions = [ 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp' ];
    $ext        = $extensions[ (string) wp_get_image_mime( $tmp ) ] ?? '';
    if ( '' === $ext ) {
        wp_delete_file( $tmp );
        return new WP_Error( 'not_an_image', 'The address did not return an image.' );
    }
    $name = sanitize_file_name( pathinfo( (string) wp_parse_url( $url, PHP_URL_PATH ), PATHINFO_FILENAME ) ) ?: 'section-image';

    $id = media_handle_sideload( [ 'name' => "$name.$ext", 'tmp_name' => $tmp ], 0 );
    if ( is_wp_error( $id ) ) {
        wp_delete_file( $tmp );
        return $id;
    }
    update_post_meta( $id, '_induction_source_url', $url );
    induction_set_media_category( $id, INDUCTION_RESOURCE_CATEGORY_DEFAULT );
    induction_tag_media( [ $id ] );
    return (int) $id;
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
// Shared by the single and bulk endpoints so one staff member's reminder and
// fifty of them are drafted from identically shaped facts.
function induction_reminder_context_for_user( int $user_id ): ?array {
    $user = get_user_by( 'id', $user_id );
    if ( ! $user ) {
        return null;
    }

    $outstanding = induction_outstanding_assignments( $user_id );
    $date_format = get_option( 'date_format' );

    return [
        'user_id'       => $user_id,
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
    ];
}

function induction_get_reminder_context( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $context = induction_reminder_context_for_user( (int) $request['id'] );
    if ( null === $context ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }
    return rest_ensure_response( $context );
}

// Contexts for many staff at once, so the compose dialog can render a per
// person preview without one request per recipient.
function induction_get_reminder_contexts( WP_REST_Request $request ): WP_REST_Response {
    $raw = (string) $request->get_param( 'user_ids' );
    $ids = array_slice(
        array_unique( array_filter( array_map( 'intval', explode( ',', $raw ) ) ) ),
        0,
        INDUCTION_REMINDER_BULK_MAX
    );

    $contexts = [];
    foreach ( $ids as $id ) {
        $context = induction_reminder_context_for_user( $id );
        if ( null !== $context ) {
            $contexts[] = $context;
        }
    }

    return rest_ensure_response( $contexts );
}

// Sends a batch of already-composed messages. Same contract as the single
// send: the SPA decides the wording, this decides nothing. Every recipient
// gets an individual result so a partial failure is visible rather than being
// flattened into one success or one error.
function induction_send_bulk_reminders( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $params   = $request->get_json_params();
    $messages = is_array( $params['messages'] ?? null ) ? $params['messages'] : [];

    if ( ! $messages ) {
        return new WP_Error( 'no_messages', 'No reminders to send.', [ 'status' => 400 ] );
    }
    if ( count( $messages ) > INDUCTION_REMINDER_BULK_MAX ) {
        return new WP_Error(
            'too_many_messages',
            sprintf( 'Send to at most %d staff at a time.', INDUCTION_REMINDER_BULK_MAX ),
            [ 'status' => 400 ]
        );
    }

    $results = [];
    foreach ( $messages as $message ) {
        if ( ! is_array( $message ) ) {
            continue;
        }
        $user_id = (int) ( $message['user_id'] ?? 0 );
        $user    = $user_id ? get_user_by( 'id', $user_id ) : null;

        if ( ! $user ) {
            $results[] = [ 'user_id' => $user_id, 'name' => '', 'sent' => false, 'reason' => 'Staff member not found.' ];
            continue;
        }
        if ( ! is_email( $user->user_email ) ) {
            $results[] = [ 'user_id' => $user_id, 'name' => $user->display_name, 'sent' => false, 'reason' => 'No email address on file.' ];
            continue;
        }

        $subject = trim( sanitize_text_field( (string) ( $message['subject'] ?? '' ) ) );
        $body    = trim( wp_kses_post( (string) ( $message['body'] ?? '' ) ) );

        if ( '' === $subject || '' === trim( wp_strip_all_tags( $body ) ) ) {
            $results[] = [ 'user_id' => $user_id, 'name' => $user->display_name, 'sent' => false, 'reason' => 'Empty subject or message.' ];
            continue;
        }

        $sent = wp_mail(
            $user->user_email,
            mb_substr( $subject, 0, INDUCTION_REMINDER_SUBJECT_MAX_LENGTH ),
            $body,
            [ 'Content-Type: text/html; charset=UTF-8' ]
        );

        $results[] = [
            'user_id' => $user_id,
            'name'    => $user->display_name,
            'email'   => $user->user_email,
            'sent'    => (bool) $sent,
            'reason'  => $sent ? '' : 'WordPress could not send the email.',
        ];
    }

    $sent_count = count( array_filter( $results, fn( $r ) => $r['sent'] ) );

    return rest_ensure_response( [
        'sent'    => $sent_count,
        'failed'  => count( $results ) - $sent_count,
        'results' => $results,
    ] );
}

// ─── Account setup email ────────────────────────────────────────────────────

// Sent when an admin creates a staff account. Deliberately does NOT contain the
// password the admin typed: mailing a plaintext credential is the thing this
// replaces. It carries a WordPress password-reset link instead, so the staff
// member sets their own and the admin never has to relay one out of band.
function induction_send_account_setup_email( WP_User $user ): bool {
    if ( ! is_email( $user->user_email ) ) {
        return false;
    }

    $site       = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
    $portal_url = induction_portal_page_url();

    $key = get_password_reset_key( $user );
    if ( is_wp_error( $key ) ) {
        return false;
    }
    $set_password_url = network_site_url(
        'wp-login.php?action=rp&key=' . rawurlencode( $key ) . '&login=' . rawurlencode( $user->user_login ),
        'login'
    );

    $subject = sprintf( '[%s] Your induction account', $site );
    $body    = sprintf(
        '<p>Hi %1$s,</p>' .
        '<p>An induction account has been created for you at %2$s.</p>' .
        '<p><strong>Username:</strong> %3$s</p>' .
        '<p><a href="%4$s">Choose your password</a> to get started, then sign in to the ' .
        '<a href="%5$s">staff portal</a> to see the training assigned to you.</p>' .
        '<p>If that link has expired, use the "Lost your password?" option on the sign-in page.</p>' .
        '<p>— %2$s</p>',
        esc_html( $user->display_name ),
        esc_html( $site ),
        esc_html( $user->user_login ),
        esc_url( $set_password_url ),
        esc_url( $portal_url )
    );

    return (bool) wp_mail(
        $user->user_email,
        $subject,
        $body,
        [ 'Content-Type: text/html; charset=UTF-8' ]
    );
}

// Deep link to one submission's grading screen. The SPA is hash-routed and
// mounted on the portal page, so every admin route hangs off that page's URL.
function induction_quiz_review_url( int $user_id, int $module_id ): string {
    return induction_portal_page_url() . '#/quiz-reviews/' . $user_id . '/' . $module_id;
}

// Everyone who can actually grade a submission. Resolved from the capability
// rather than a hard-coded role list, so a site that has handed
// manage_induction to a role of its own still gets told.
function induction_quiz_review_recipients(): array {
    $users = get_users( [
        'capability' => 'manage_induction',
        'number'     => INDUCTION_QUIZ_REVIEW_NOTIFY_MAX,
        'fields'     => [ 'user_email' ],
    ] );

    $emails = [];
    foreach ( $users as $user ) {
        if ( is_email( $user->user_email ) ) {
            // Keyed by the lowercased address: two accounts sharing a mailbox
            // should produce one email, not two identical ones.
            $emails[ strtolower( $user->user_email ) ] = $user->user_email;
        }
    }

    return array_values( $emails );
}

// Tells the graders that a module-level quiz is waiting on them. Without this
// the only signal is the sidebar badge, which nobody sees until they happen to
// open the admin app — so a submission could sit unmarked for days.
//
// Returns how many graders were successfully mailed. Deliberately total: a
// site with no working mail transport must still be able to take submissions.
function induction_send_quiz_review_notification( WP_User $student, int $module_id ): int {
    $recipients = induction_quiz_review_recipients();
    if ( empty( $recipients ) ) {
        return 0;
    }

    $site   = wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES );
    $module = get_the_title( $module_id ) ?: '(Untitled module)';

    $subject = sprintf( '[%s] %s submitted a quiz for review', $site, $student->display_name );
    $body    = sprintf(
        '<p>%1$s has submitted the module-level quiz for <strong>%2$s</strong> ' .
        'and it is waiting to be graded.</p>' .
        '<p><a href="%3$s">Grade this submission</a></p>' .
        '<p>— %4$s</p>',
        esc_html( $student->display_name ),
        esc_html( $module ),
        esc_url( induction_quiz_review_url( $student->ID, $module_id ) ),
        esc_html( $site )
    );

    $sent = 0;
    foreach ( $recipients as $email ) {
        if ( wp_mail( $email, $subject, $body, [ 'Content-Type: text/html; charset=UTF-8' ] ) ) {
            $sent++;
        }
    }

    return $sent;
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
        // Every write to module_blocks funnels through here, so this is the one
        // place history has to be recorded — it covers the module editor, the
        // section editor, and anything added later.
        induction_seed_module_version_history( $id );
        update_post_meta( $id, 'module_blocks', induction_slash_meta( $encoded_blocks ) );
        induction_snapshot_module_blocks( $id, $encoded_blocks );
    }
    if ( isset( $meta['module_icon'] ) ) {
        update_post_meta( $id, 'module_icon', induction_slash_meta( sanitize_text_field( (string) $meta['module_icon'] ) ) );
    }
    if ( isset( $meta['module_hero_image'] ) ) {
        update_post_meta( $id, 'module_hero_image', (int) $meta['module_hero_image'] );
    }

    $media_ids = [];
    if ( isset( $meta['module_hero_image'] ) ) {
        $media_ids[] = (int) $meta['module_hero_image'];
    }
    if ( is_array( $decoded_blocks ) ) {
        $media_ids = array_merge( $media_ids, induction_media_ids_in_sections( $decoded_blocks ) );
    }
    induction_tag_media( $media_ids );

    return true;
}

/**
 * Order modules by their module_order meta, ascending, with the post ID as a
 * stable tiebreaker.
 *
 * Deliberately not WP_Query's `meta_key` + `orderby => meta_value_num`, which
 * is what these queries used before. That pairing makes WP_Query INNER JOIN
 * wp_postmeta, so a module with no module_order row is dropped from the result
 * entirely rather than sorted last: absent from the admin list, absent from the
 * assign dialog, and — for the staff-facing query — absent from the portal,
 * with no error raised anywhere.
 *
 * Nothing in the UI creates a module in that state (the editor always sends
 * module_order, and import writes it explicitly), but a module created through
 * the REST API without the field does, and so would any module predating it.
 * A missing row reads as 0 here, which sorts it first — the same place the
 * registered default would put it.
 *
 * posts_per_page is -1 at every call site, so the full set is already in memory
 * and sorting in PHP costs nothing the database was not already paying.
 */
function induction_sort_modules_by_order( array $posts ): array {
    usort( $posts, static function ( WP_Post $a, WP_Post $b ): int {
        $order_a = (int) get_post_meta( $a->ID, 'module_order', true );
        $order_b = (int) get_post_meta( $b->ID, 'module_order', true );
        return [ $order_a, $a->ID ] <=> [ $order_b, $b->ID ];
    } );
    return $posts;
}

/**
 * Renumber modules from a list of ids given in the order they should appear.
 *
 * Takes the whole ordered list rather than "move module X up one": the client
 * already holds the list it is showing, and sending it back whole means the
 * server never has to guess what the neighbours were. Positions are rewritten
 * as 0, 1, 2 … so the numbers stay dense however many times the list is
 * shuffled.
 *
 * Only writes where the value actually changes. That keeps the post-meta hooks
 * quiet — and matters because reordering a list of twenty modules would
 * otherwise fire twenty update_post_meta events for no reason.
 */
function induction_reorder_modules( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $ids = array_values( array_unique( array_map( 'intval', (array) $request->get_param( 'ids' ) ) ) );

    if ( empty( $ids ) ) {
        return new WP_Error( 'induction_no_modules', 'No modules were given to reorder.', [ 'status' => 400 ] );
    }

    foreach ( $ids as $id ) {
        if ( 'induction_module' !== get_post_type( $id ) ) {
            return new WP_Error(
                'induction_not_a_module',
                sprintf( 'ID %d is not a training module.', $id ),
                [ 'status' => 400 ]
            );
        }
    }

    $changed = 0;
    foreach ( $ids as $position => $id ) {
        if ( (int) get_post_meta( $id, 'module_order', true ) !== $position ) {
            update_post_meta( $id, 'module_order', $position );
            $changed++;
        }
    }

    return rest_ensure_response( [ 'reordered' => count( $ids ), 'changed' => $changed ] );
}

function induction_get_modules(): WP_REST_Response {
    $posts = induction_sort_modules_by_order( get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => [ 'publish', 'draft' ],
        'posts_per_page' => -1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ] ) );
    return rest_ensure_response( array_map( 'induction_format_module', $posts ) );
}

function induction_get_module( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $post = get_post( (int) $request['id'] );
    if ( ! $post || $post->post_type !== 'induction_module' ) {
        return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
    }
    // Staff get what wp/v2 gives them: published modules, without draft sections.
    if ( ! current_user_can( 'manage_induction' ) ) {
        if ( 'publish' !== $post->post_status ) {
            return new WP_Error( 'not_found', 'Module not found.', [ 'status' => 404 ] );
        }
        $data = induction_format_module( $post );
        $data['meta']['module_blocks'] = induction_strip_unpublished_sections_json( (string) $data['meta']['module_blocks'] );
        return rest_ensure_response( $data );
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
    // Append rather than default to 0: with positions numbered from zero, a
    // new module would otherwise land at the top of a list an author had just
    // arranged. Only when the caller did not ask for a position itself.
    if ( ! isset( $params['meta']['module_order'] ) ) {
        global $wpdb;
        $max = (int) $wpdb->get_var(
            "SELECT MAX( CAST( meta_value AS SIGNED ) ) FROM $wpdb->postmeta WHERE meta_key = 'module_order'"
        );
        update_post_meta( $id, 'module_order', $max + 1 );
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

/**
 * Third-party assets to drop on the portal page, matched on the registered
 * src rather than the handle: handles are private to each plugin and change
 * between versions, whereas the path a plugin serves from does not.
 *
 * The portal page renders one React app into an empty document and bypasses
 * the theme, so none of the storefront's front-end runs for any reason here.
 * It is not merely wasted bandwidth. A performance recording from a staff
 * member showed the browser hanging inside Google's analytics.js: the SPA uses
 * a hash router, so every click on a sidebar link reads to a tag manager's
 * history listener as a fresh page view, and the freeze reproduced only for
 * users running a content blocker, which substitutes its own stub for
 * analytics.js. Either half of that pairing is somebody else's code doing
 * somebody else's job on a page that needs neither.
 *
 * Note the analytics property is a Universal Analytics one (UA-...), which
 * stopped accepting data in July 2023, so nothing here is losing measurement
 * that still exists. Retiring it site-wide is a separate job.
 *
 * @return string[] Case-insensitive substrings matched against each src.
 */
function induction_portal_blocked_asset_patterns(): array {
    return (array) apply_filters( 'induction_portal_blocked_asset_patterns', [
        // Analytics and tag managers - the observed cause of the hang.
        'googletagmanager.com',
        'google-analytics.com',
        '/gtag/js',
        'analytics.js',
        // Storefront and page builder. Nothing on this page is built with
        // either, and WooCommerce alone queues a dozen scripts.
        '/plugins/woocommerce/',
        '/plugins/woo-variation-gallery/',
        '/plugins/woolentor-addons/',
        '/plugins/elementor/',
        '/plugins/elementor-pro/',
        // Marketing and form widgets with no counterpart in the SPA. The
        // portal signs in over JWT and has no reCAPTCHA-protected form.
        '/plugins/custom-facebook-feed-pro/',
        '/plugins/recaptcha-woo/',
        'google.com/recaptcha',
        // The theme is bypassed by portal-page.php, so its assets are dead
        // weight by definition.
        '/themes/',
    ] );
}

/**
 * Drop those assets, on this page only. Deliberately narrow:
 *
 *   - jQuery and the wp-* core scripts stay. They are cheap, and a plugin that
 *     prints a raw inline jQuery() call in the footer would throw without it.
 *     Inline scripts attached to a dequeued handle go with it automatically.
 *   - Styles are left alone apart from the Elementor kit already handled in
 *     induction_portal_render_head(); a missing stylesheet cannot hang a
 *     browser, and stripping more risks the page shell.
 */
function induction_portal_dequeue_third_party(): void {
    if ( ! induction_is_portal_page() ) {
        return;
    }

    $scripts  = wp_scripts();
    $patterns = induction_portal_blocked_asset_patterns();

    foreach ( $scripts->queue as $handle ) {
        $src = $scripts->registered[ $handle ]->src ?? '';
        if ( ! is_string( $src ) || '' === $src ) {
            continue;
        }
        // Never match this plugin's own bundle, whatever the pattern list says.
        if ( false !== strpos( $src, INDUCTION_URL ) ) {
            continue;
        }
        foreach ( $patterns as $pattern ) {
            if ( false !== stripos( $src, (string) $pattern ) ) {
                wp_dequeue_script( $handle );
                break;
            }
        }
    }
}

/**
 * Remove <script> tags that were printed as raw markup rather than enqueued,
 * so there is no handle to dequeue. Tag manager snippets are the usual case:
 * both the loader and the inline dataLayer bootstrap that configures it, which
 * is why inline script bodies are matched too and not just src attributes.
 *
 * Applied to buffered wp_head() and wp_footer() output.
 */
function induction_portal_strip_third_party( string $html ): string {
    $patterns = array_merge(
        induction_portal_blocked_asset_patterns(),
        // Injected as raw markup and conflicts with the SPA's own scripts.
        [ 'mailerlite', 'dataLayer', 'GoogleAnalyticsObject' ]
    );

    return (string) preg_replace_callback(
        '#<script\b[^>]*>.*?</script>#is',
        static function ( array $matches ) use ( $patterns ): string {
            // The SPA's own bundle is printed by wp_footer() and must survive
            // regardless of what the pattern list happens to contain.
            if ( false !== strpos( $matches[0], INDUCTION_URL ) ) {
                return $matches[0];
            }
            foreach ( $patterns as $pattern ) {
                if ( false !== stripos( $matches[0], (string) $pattern ) ) {
                    return '';
                }
            }
            return $matches[0];
        },
        $html
    );
}

/**
 * wp_footer() is where this plugin's own bundle is printed, so it cannot simply
 * be skipped - it is buffered and filtered like the head, which also catches a
 * tag manager's body snippet.
 */
function induction_portal_render_footer(): void {
    ob_start();
    wp_footer();
    echo induction_portal_strip_third_party( (string) ob_get_clean() );
}

// This page bypasses the theme entirely for the SPA (see portal-page.php),
// so wp_head() still pulls in third-party CSS/JS meant for the theme's own
// pages - none of which this page has any use for. Buffer wp_head() and
// strip the known offenders out of this page only, rather than
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
    $head_output = induction_portal_strip_third_party( $head_output );
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

    // Cache-bust on INDUCTION_VERSION rather than filemtime(). mtime is not
    // deployment-safe: extracting a zip restores the archived timestamp, and a
    // page cache (LiteSpeed on this host) can serve HTML carrying the previous
    // ?ver=, so the browser never requests the new bundle and runs stale JS
    // against a newer API. The version constant changes when we say it does,
    // and is identical on every environment. BUMP IT ON EVERY RELEASE.
    //
    // Under WP_DEBUG the mtime is appended so local edits show up without a
    // version bump on each save.
    $asset_version = defined( 'WP_DEBUG' ) && WP_DEBUG
        ? INDUCTION_VERSION . '.' . filemtime( $js_path )
        : INDUCTION_VERSION;

    wp_enqueue_script( 'induction-app', INDUCTION_URL . 'assets/app/app.js', [], $asset_version, true );

    if ( file_exists( $css_path ) ) {
        wp_enqueue_style( 'induction-app', INDUCTION_URL . 'assets/app/app.css', [], $asset_version );
    }

    wp_localize_script( 'induction-app', 'InductionApp', [
        'restUrl' => esc_url_raw( rest_url() ),
    ] );
}
