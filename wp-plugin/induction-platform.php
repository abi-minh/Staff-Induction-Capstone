<?php
/**
 * Plugin Name: Induction Platform
 * Description: Staff induction portal — registers custom post types, REST endpoints, and embeds the React portal via shortcode.
 * Version:     1.0.3
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

    register_post_meta( 'induction_module', 'module_role_targets',        [ 'type' => 'array',   'single' => true, 'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ], 'default' => [] ] );
    register_post_meta( 'induction_module', 'module_estimated_minutes',   [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0 ] );
    register_post_meta( 'induction_module', 'module_order',               [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0 ] );
    register_post_meta( 'induction_module', 'module_blocks',              [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '[]', 'sanitize_callback' => 'induction_sanitize_blocks_json' ] );
    register_post_meta( 'induction_module', 'quiz_pass_threshold',        [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 70 ] );
    register_post_meta( 'induction_module', 'module_icon',                [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '' ] );
    register_post_meta( 'induction_module', 'module_hero_image',          [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0 ] );

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

    register_post_meta( 'induction_document', 'document_category',      [ 'type' => 'string',  'single' => true, 'show_in_rest' => true, 'default' => '' ] );
    register_post_meta( 'induction_document', 'document_file_id',       [ 'type' => 'integer', 'single' => true, 'show_in_rest' => true, 'default' => 0 ] );
    register_post_meta( 'induction_document', 'document_role_targets',  [ 'type' => 'array',   'single' => true, 'show_in_rest' => [ 'schema' => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ] ], 'default' => [] ] );
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
        add_role( 'staff', 'Staff', [
            'read' => true,
        ] );
    }

    if ( ! get_role( 'induction_admin' ) ) {
        add_role( 'induction_admin', 'Induction Admin', [
            'read'             => true,
            'manage_induction' => true,
            'edit_posts'       => true,
            'publish_posts'    => true,
            'upload_files'     => true,
        ] );
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

    // POST /assignments/bulk — assign module(s) to user(s) (admin only)
    register_rest_route( $ns, '/assignments/bulk', [
        'methods'             => 'POST',
        'callback'            => 'induction_bulk_assign',
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

    // POST /quiz/submit — grade all answers for a module
    register_rest_route( $ns, '/quiz/submit', [
        'methods'             => 'POST',
        'callback'            => 'induction_quiz_submit',
        'permission_callback' => 'is_user_logged_in',
        'args'                => [
            'user_id'   => [ 'type' => 'integer', 'required' => true ],
            'module_id' => [ 'type' => 'integer', 'required' => true ],
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
        'methods'             => 'GET',
        'callback'            => 'induction_get_staff_list',
        'permission_callback' => 'induction_is_admin_user',
    ] );

    // GET /staff/{id} — single staff user
    register_rest_route( $ns, '/staff/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'induction_get_staff_member',
        'permission_callback' => 'induction_is_admin_user',
        'args'                => [ 'id' => [ 'type' => 'integer', 'required' => true ] ],
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

    return new WP_REST_Response( [ 'assigned' => count( $user_ids ) ] );
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

// ─── Quiz Callbacks ─────────────────────────────────────────────────────────

function induction_quiz_save( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_quiz_responses';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );
    $block_id  = $request->get_param( 'block_id' );
    $answer    = $request->get_param( 'answer' );
    $now       = current_time( 'mysql' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    // Upsert the answer without grading — is_correct stays NULL until submit.
    $existing = $wpdb->get_row(
        $wpdb->prepare( "SELECT id FROM $table WHERE user_id = %d AND module_id = %d AND block_id = %s", $user_id, $module_id, $block_id ),
        ARRAY_A
    );

    if ( $existing ) {
        $wpdb->update( $table, [
            'answer'     => $answer,
            'is_correct' => null,
            'created_at' => $now,
        ], [ 'id' => $existing['id'] ] );
    } else {
        $wpdb->insert( $table, [
            'user_id'    => $user_id,
            'module_id'  => $module_id,
            'block_id'   => $block_id,
            'answer'     => $answer,
            'is_correct' => null,
            'created_at' => $now,
        ] );
    }

    return new WP_REST_Response( [ 'saved' => true ] );
}

function induction_quiz_submit( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table     = $wpdb->prefix . 'induction_quiz_responses';
    $user_id   = (int) $request->get_param( 'user_id' );
    $module_id = (int) $request->get_param( 'module_id' );

    if ( get_current_user_id() !== $user_id && ! current_user_can( 'manage_induction' ) ) {
        return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
    }

    // Look up all quiz blocks and their correct answers.
    $blocks_json = get_post_meta( $module_id, 'module_blocks', true ) ?: '[]';
    $blocks      = json_decode( $blocks_json, true ) ?: [];
    $quiz_blocks = [];
    foreach ( $blocks as $b ) {
        if ( in_array( $b['type'] ?? '', [ 'multiple_choice', 'true_false' ], true ) ) {
            $quiz_blocks[ $b['id'] ] = $b;
        }
    }

    if ( empty( $quiz_blocks ) ) {
        return new WP_REST_Response( [ 'message' => 'No quiz blocks found' ], 400 );
    }

    // Get all saved answers for this user/module.
    $saved = $wpdb->get_results(
        $wpdb->prepare( "SELECT * FROM $table WHERE user_id = %d AND module_id = %d", $user_id, $module_id ),
        ARRAY_A
    ) ?? [];

    // Grade each answer and build results.
    $results   = [];
    $now       = current_time( 'mysql' );

    foreach ( $saved as $row ) {
        $block_id   = $row['block_id'];
        $quiz_block = $quiz_blocks[ $block_id ] ?? null;
        if ( ! $quiz_block ) continue;

        $answer     = $row['answer'];
        $is_correct = false;

        if ( $quiz_block['type'] === 'multiple_choice' ) {
            $is_correct = (int) $answer === (int) ( $quiz_block['data']['correctIndex'] ?? -1 );
        } elseif ( $quiz_block['type'] === 'true_false' ) {
            $correct_val = ! empty( $quiz_block['data']['correctAnswer'] );
            $is_correct  = ( $answer === 'true' ) === $correct_val;
        }

        // Update the row with the grading result.
        $wpdb->update( $table, [ 'is_correct' => $is_correct ? 1 : 0 ], [ 'id' => $row['id'] ] );

        $results[ $block_id ] = [
            'is_correct'  => $is_correct,
            'explanation' => $quiz_block['data']['explanation'] ?? '',
        ];
    }

    // Calculate score.
    $total   = count( $quiz_blocks );
    $correct = count( array_filter( $results, fn( $r ) => $r['is_correct'] ) );
    $score   = round( ( $correct / $total ) * 100, 2 );

    $threshold = (int) ( get_post_meta( $module_id, 'quiz_pass_threshold', true ) ?: 70 );
    $passed    = $score >= $threshold;

    // Update progress record.
    $progress_table = $wpdb->prefix . 'induction_progress';
    $wpdb->query(
        $wpdb->prepare(
            "UPDATE $progress_table SET score = %f, passed = %d, updated_at = %s WHERE user_id = %d AND module_id = %d",
            $score, $passed ? 1 : 0, $now, $user_id, $module_id
        )
    );

    return new WP_REST_Response( [
        'score'   => $score,
        'total'   => $total,
        'passed'  => $passed,
        'results' => $results,
    ] );
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

add_filter( 'rest_prepare_induction_module', 'induction_strip_quiz_answers', 10, 3 );

function induction_strip_quiz_answers( WP_REST_Response $response, WP_Post $post, WP_REST_Request $request ): WP_REST_Response {
    if ( current_user_can( 'manage_induction' ) ) {
        return $response;
    }

    $data = $response->get_data();
    if ( ! isset( $data['meta']['module_blocks'] ) ) {
        return $response;
    }

    $blocks = json_decode( $data['meta']['module_blocks'], true );
    if ( ! is_array( $blocks ) ) {
        return $response;
    }

    foreach ( $blocks as &$block ) {
        if ( ( $block['type'] ?? '' ) === 'multiple_choice' ) {
            unset( $block['data']['correctIndex'] );
        } elseif ( ( $block['type'] ?? '' ) === 'true_false' ) {
            unset( $block['data']['correctAnswer'] );
        }
    }
    unset( $block );

    $data['meta']['module_blocks'] = wp_json_encode( $blocks );
    $response->set_data( $data );

    return $response;
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

function induction_get_staff_list(): WP_REST_Response {
    $users = get_users( [ 'role__in' => [ 'staff', 'induction_admin' ], 'number' => 200 ] );
    return rest_ensure_response( array_map( 'induction_format_staff_user', $users ) );
}

function induction_get_staff_member( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $user = get_user_by( 'id', (int) $request['id'] );
    if ( ! $user ) {
        return new WP_Error( 'not_found', 'User not found.', [ 'status' => 404 ] );
    }
    return rest_ensure_response( induction_format_staff_user( $user ) );
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
