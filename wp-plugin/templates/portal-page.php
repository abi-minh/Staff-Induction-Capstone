<?php
/**
 * Full-page template for the induction platform (unified SPA).
 * Bypasses the WordPress theme so the React app can take over the viewport.
 * The SPA handles role-based routing after JWT login.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

// This page bypasses the theme entirely for the SPA, so the admin bar must be
// turned off properly (not just hidden with CSS) — otherwise WordPress still
// fires admin_bar_menu and lets admin-bar-dependent plugins (e.g. Simple
// History's React widget) enqueue and mount scripts against a bar that was
// never actually rendered, which throws when it hits a missing wp.hooks call.
show_admin_bar( false );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html( wp_get_document_title() ); ?></title>
    <?php induction_portal_render_head(); ?>
    <style>
        html, body { margin: 0; padding: 0; height: 100%; }
        html { margin-top: 0 !important; }
        #wpadminbar { display: none !important; }
    </style>
</head>
<body>
    <div id="induction-app-root"></div>
    <?php wp_footer(); ?>
</body>
</html>
