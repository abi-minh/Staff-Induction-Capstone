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

// ─── Bootstrap ───────────────────────────────────────────────────────────────

add_action( 'init',            'induction_register_post_types' );
add_action( 'init',            'induction_register_roles' );
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
}

// ─── Sanitization ───────────────────────────────────────────────────────────

function induction_sanitize_blocks_json( string $value ): string {
    $decoded = json_decode( $value, true );
    // Must be a valid JSON array; reject anything else.
    if ( ! is_array( $decoded ) || json_last_error() !== JSON_ERROR_NONE ) {
        return '[]';
    }
    // Re-encode to ensure clean JSON (no trailing commas, etc.).
    return wp_json_encode( $decoded );
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

    $roles = $user->roles;

    // Fetch published modules whose role_targets include any of the user's roles,
    // OR modules explicitly assigned to this user (role target = "user:{id}").
    $modules = get_posts( [
        'post_type'      => 'induction_module',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => 'module_order',
        'order'          => 'ASC',
    ] );

    $assigned = array_filter( $modules, function( $post ) use ( $roles, $user_id ) {
        $targets = get_post_meta( $post->ID, 'module_role_targets', true ) ?: [];
        // Match by role slug or by explicit user ID target.
        return array_intersect( $roles, $targets )
            || in_array( 'user:' . $user_id, $targets, true )
            || in_array( 'all', $targets, true );
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

function induction_bulk_assign( WP_REST_Request $request ): WP_REST_Response {
    $module_id = (int) $request->get_param( 'module_id' );
    $user_ids  = array_map( 'intval', (array) $request->get_param( 'user_ids' ) );

    if ( ! $module_id || empty( $user_ids ) ) {
        return new WP_REST_Response( [ 'message' => 'module_id and user_ids are required' ], 400 );
    }

    // Add each user as an explicit target on the module's role_targets meta.
    $current_targets = get_post_meta( $module_id, 'module_role_targets', true ) ?: [];
    foreach ( $user_ids as $uid ) {
        $key = 'user:' . $uid;
        if ( ! in_array( $key, $current_targets, true ) ) {
            $current_targets[] = $key;
        }
    }
    update_post_meta( $module_id, 'module_role_targets', $current_targets );

    // Record an assignment row per user, with an auto-calculated due date.
    global $wpdb;
    $assignments_table = $wpdb->prefix . 'induction_assignments';
    $now               = current_time( 'mysql' );
    $duration_days     = (int) get_post_meta( $module_id, 'module_duration_days', true );
    $explicit_due      = $request->get_param( 'due_date' );

    if ( $explicit_due ) {
        $due_date = $explicit_due;
    } elseif ( $duration_days > 0 ) {
        $due_date = date( 'Y-m-d H:i:s', strtotime( $now . ' +' . $duration_days . ' days' ) );
    } else {
        $due_date = null;
    }

    foreach ( $user_ids as $uid ) {
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $assignments_table WHERE user_id = %d AND module_id = %d",
            $uid, $module_id
        ) );
        if ( $existing ) {
            if ( $due_date !== null ) {
                $wpdb->update( $assignments_table, [ 'due_date' => $due_date ], [ 'id' => (int) $existing ] );
            }
        } else {
            $wpdb->insert( $assignments_table, [
                'user_id'     => $uid,
                'module_id'   => $module_id,
                'assigned_at' => $now,
                'due_date'    => $due_date,
                'assigned_by' => get_current_user_id(),
            ] );
        }
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
    $current_targets = get_post_meta( $module_id, 'module_role_targets', true ) ?: [];
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

    return wp_json_encode( $parsed );
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

    return wp_json_encode( $visible );
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
    return [
        'id'          => $user->ID,
        'name'        => $user->display_name,
        'slug'        => $user->user_login,
        'email'       => $user->user_email,
        'roles'       => $user->roles,
        'avatar_urls' => [
            '48' => get_avatar_url( $user->ID, [ 'size' => 48 ] ),
            '96' => get_avatar_url( $user->ID, [ 'size' => 96 ] ),
        ],
    ];
}

function induction_assignable_roles(): array {
    $core  = [ 'administrator', 'editor', 'author', 'contributor', 'subscriber' ];
    $names = wp_roles()->get_names();
    return array_diff_key( $names, array_flip( $core ) );
}

function induction_get_roles(): WP_REST_Response {
    $out = [];
    foreach ( induction_assignable_roles() as $slug => $label ) {
        $out[] = [ 'value' => $slug, 'label' => $label ];
    }
    return rest_ensure_response( $out );
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

    return rest_ensure_response( induction_format_staff_user( get_user_by( 'id', $user_id ) ) );
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
        update_post_meta( $id, 'module_blocks', wp_json_encode( $decoded_blocks ) );
    }
    if ( isset( $meta['module_icon'] ) ) {
        update_post_meta( $id, 'module_icon', sanitize_text_field( (string) $meta['module_icon'] ) );
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

function induction_portal_template( string $template ): string {
    if ( ! induction_is_portal_page() ) {
        return $template;
    }
    return INDUCTION_DIR . 'templates/portal-page.php';
}

function induction_maybe_enqueue_portal(): void {
    if ( ! induction_is_portal_page() || ! is_user_logged_in() ) {
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
