<?php
/**
 * Full-page template for the induction platform (unified SPA).
 * Bypasses the WordPress theme so the React app can take over the viewport.
 * The SPA handles role-based routing after JWT login.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! is_user_logged_in() ) {
    wp_redirect( wp_login_url( get_permalink() ) );
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html( wp_get_document_title() ); ?></title>
    <?php wp_head(); ?>
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
