# WordPress Admin App as plugin

The admin app now runs inside the existing `Induction Platform` WordPress plugin and uses the current WordPress session for authentication.
- Admin assets are built into:
   - `wp-plugin/assets/admin/`
- Portal assets are built into:
  - `wp-plugin/assets/portal/`

To update the plugin:
1. Build both the admin and portal app ('npm install' and 'npm run build').
2. Copy the contents of `wp-plugin/` into the WordPress plugin folder.
3. Implement both shortcode into different pages:
   - `[induction_portal]`
   - `[induction_admin]`


Notes:
- The admin app no longer uses JWT login.
- The plugin injects runtime config through `window.InductionAdmin`.
- The admin app runs inside WordPress, not at `localhost:5174`.