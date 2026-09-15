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

Build the front end first (`cd app && npm run build`) — `wp-plugin/assets/app/` is
generated and is not in the repository. Then copy or symlink `wp-plugin/` to
`wp-content/plugins/induction-platform/` on your WordPress site and activate it
from the WordPress admin.

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

Output goes to `wp-plugin/assets/app/`, which WordPress enqueues directly from the
plugin's assets directory.

**The build output is not committed.** `wp-plugin/assets/app/` and
`wp-plugin/staff-portal.zip` are gitignored: vite wipes and rewrites that directory
on every build, so a committed bundle conflicts on every branch that touches the
front end, and the conflict can never be resolved by reading it — only by
rebuilding. Build before you deploy or package, and rebuild rather than merge.

To package an installable plugin zip, build first, then archive `wp-plugin/` with
`staff-portal/` as the folder inside the archive — that name is the plugin's
directory on the server, and changing it makes WordPress treat the upload as a
separate plugin.

---

## User roles

| Role | Access |
|------|--------|
| `administrator` | Full WordPress admin + induction management |
| `induction_admin` | Induction management only (no wp-admin access) |
| `staff` | Portal view only (no wp-admin access) |

A WordPress `administrator` is an induction admin by default: they hold
`manage_induction`, appear in the staff list and reporting, and a module can be
targeted at them. `administrator` is never offered as a role the app can
*grant*, so an `induction_admin` — who is not a full administrator — cannot
create or promote one through Add Staff or Change Role.

## Resource categories

Every file in the induction media library is filed under a category from a
managed list (`Documents → Manage Categories`). "Module Resources" ships with
the plugin and cannot be deleted; a category can only be deleted once it is
empty, and renaming one re-labels it without moving any file. The category is
stored on the attachment, and any `induction_document` record in front of a
file is kept in step with it in both directions.

Sites upgrading from before this feature have every existing file and document
moved into "Module Resources" once, on the first request after the upgrade.

## Notifications

| When | Who is emailed |
|------|----------------|
| A staff member submits a module quiz for review | Everyone with `manage_induction` |
| An admin creates a staff account | The new staff member (opt-out at creation) |
| An admin sends a training reminder | The selected staff member(s) |

Quiz review notifications fire once per submission: re-submitting while the
same attempt is still pending does not mail the graders again.

---

## Linting

```bash
cd app
npm run lint   # ESLint — max-warnings 0
```
