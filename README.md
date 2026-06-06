# Induction Platform

A staff induction and training platform built with React and WordPress. A WordPress plugin exposes custom REST endpoints, custom post types, and custom roles. The React SPA consumes those endpoints and is embedded into WordPress via a shortcode.

---

## Project structure

```
app/          React SPA (admin + staff portal)
wp-plugin/    WordPress plugin (PHP)
```

---

## Prerequisites

- Node.js 18+
- A WordPress site with:
  - [JWT Authentication for WP REST API](https://wordpress.org/plugins/jwt-authentication-for-wp-rest-api/) plugin installed and active
  - The induction platform plugin installed and active (see below)
  - `wp-config.php` defines:
    ```php
    define('JWT_AUTH_SECRET_KEY', 'your-secret-key');
    define('JWT_AUTH_CORS_ENABLE', true);
    ```

---

## WordPress plugin setup

Copy or symlink `wp-plugin/` to `wp-content/plugins/induction-platform/` on your WordPress site, then activate it from the WordPress admin.

The plugin registers:

- Custom post types: `induction_module`, `induction_document`
- Custom roles: `staff`, `induction_admin`
- REST namespace: `induction/v1`
- Shortcode: `[induction_portal]` — add this to any WordPress page to mount the app

---

## Local development

### 1. Configure environment

```bash
cd app
cp .env.example .env
```

Edit `.env`:

```env
# Set to the wp-json base URL of your WordPress site.
# Use /wp-proxy/wp-json/ when proxying to a remote site (see below).
VITE_WP_REST_URL=/wp-proxy/wp-json/

# Remote WordPress site to proxy requests to (avoids CORS in local dev).
# Omit if running WordPress locally.
VITE_WP_PROXY_TARGET=https://your-wp-site.com
```

When `VITE_WP_PROXY_TARGET` is set, the Vite dev server proxies all `/wp-proxy/*` requests to the target site server-side, so no CORS configuration is needed on the WordPress host.

### 2. Start the dev server

```bash
cd app
npm install
npm run dev
# → http://localhost:5175
```

### 3. Log in

Use any WordPress account with the `administrator` or `induction_admin` role.  
`staff` users land on the portal view; admins land on the management dashboard.

---

## Build and deploy

```bash
cd app
npm run build
```

Output goes to `wp-plugin/assets/app/`. Commit the built files — WordPress enqueues them directly from the plugin's assets directory.

---

## User roles

| Role | Access |
|------|--------|
| `administrator` | Full WordPress admin + induction management |
| `induction_admin` | Induction management only (no wp-admin access) |
| `staff` | Portal view only (no wp-admin access) |

---

## Linting

```bash
cd app
npm run lint   # ESLint — max-warnings 0
```
