# WordPress Admin App as plugin

The admin app now runs inside the existing `Induction Platform` WordPress plugin and uses wordpress auth:
- Admin assets are built into:
   - `wp-plugin/assets/admin/`
- Portal assets are built into:
  - `wp-plugin/assets/portal/`

To update the plugin:
1. Build both the admin and portal app (npm run build).
2. Transfer contents of `wp-plugin` directory (assets and induction-platform.php) to induction-platform folder in Local wordpress plugin folder
3. implement both shortcode into different pages:
   - `[induction_portal]`
   - `[induction_admin]`


# Induction Platform — Setup Guide

A staff onboarding and training platform built with React + WordPress. The **portal** embeds into WordPress via a shortcode; the **admin** app is a standalone React SPA.

---

## Prerequisites

- [Local by Flywheel](https://localwp.com/) — for running WordPress locally
- [Node.js](https://nodejs.org/) v18+ and npm

---

## 1. Create a WordPress Site in Local

1. Open **Local** and click **+ Create a new site**.
2. Choose **Custom** setup:
   - **Site name**: `Induction Platform` (or any name you prefer)
   - **PHP version**: 8.1+
   - **Web server**: Nginx or Apache (either works)
   - **WordPress version**: latest
3. Set your WordPress admin username and password, then click **Add Site**.
4. Once the site is created, note the **Local site URL** (e.g., `http://induction-platform.local`).

---

## 2. Install Required WordPress Plugins

### JWT Authentication for WP REST API

This plugin enables token-based authentication for the REST API, which the admin app uses to log in.

1. In Local, click **WP Admin** to open your WordPress dashboard.
2. Go to **Plugins → Add New Plugin**.
3. Search for **"JWT Authentication for WP REST API"** by Enrique Chavez.
4. Click **Install Now**, then **Activate**.

### Advanced Custom Fields (optional but recommended)

If you plan to extend module metadata:

1. Go to **Plugins → Add New Plugin**.
2. Search for **"Advanced Custom Fields"**.
3. Install and activate.

---

## 3. Configure `wp-config.php`

The JWT plugin requires two constants to be defined in `wp-config.php` **before** the line that reads `/* That's all, stop editing! */`.

### Find your wp-config.php

In Local, right-click your site and choose **Open Site Folder**, then navigate to `app/public/wp-config.php`. Alternatively, use Local's built-in terminal:

1. In Local, click the **terminal icon** (or go to **Open Site Shell**) for your site.
2. Run:
   ```bash
   nano /app/public/wp-config.php
   ```

### Add the JWT constants

Add the following two lines **before** `/* That's all, stop editing! */`:

```php
define('JWT_AUTH_SECRET_KEY', 'your-secret-key-here');
define('JWT_AUTH_CORS_ENABLE', true);
```

**Generating a secure secret key:**

Use any random string generator. You can run this in your site shell:

```bash
openssl rand -base64 64
```

Paste the output as the value for `JWT_AUTH_SECRET_KEY`. Example:

```php
define('JWT_AUTH_SECRET_KEY', 'xK9mP2vLqRtY7nWjBsUaGcEhFdZiNoCpX3wMkVeA5yQlT1uJ8rH4bDfOgSI6');
define('JWT_AUTH_CORS_ENABLE', true);
```

> **Important:** Keep this key secret and consistent. Changing it will invalidate all existing tokens and log out all users.

### Configure the REST API namespace (Apache only)

If your Local site uses **Apache**, also add this to `.htaccess` in the site root (`app/public/.htaccess`) to ensure the `Authorization` header is passed through:

```apache
RewriteEngine on
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule ^(.*) - [E=HTTP_AUTHORIZATION:%1]
```

> **Note:** The WordPress plugin (`wp-plugin/induction-platform.php`) already includes a fallback for this, but the `.htaccess` rule is the most reliable fix.

---

## 4. Install the Custom WordPress Plugin

Copy the plugin folder into your Local site's plugins directory.

In your terminal (from the project root):

```bash
# Find your Local site path — typically:
# macOS: ~/Local Sites/<site-name>/app/public/wp-content/plugins/
# Windows: C:\Users\<you>\Local Sites\<site-name>\app\public\wp-content\plugins\

cp -r wp-plugin/ "/path/to/Local Sites/induction-platform/app/public/wp-content/plugins/induction-platform"
```

Then activate it in WordPress:

1. Go to **WP Admin → Plugins**.
2. Find **Induction Platform** and click **Activate**.

On activation, the plugin:
- Creates custom post types (`induction_module`, `induction_document`)
- Creates custom user roles (`staff`, `induction_admin`)
- Creates the `wp_induction_progress` database table

---

## 5. Build the Portal (WordPress-Embedded App)

The portal builds directly into the plugin's `assets/` directory, where WordPress picks it up automatically.

```bash
cd portal
npm install
npm run build
```

This outputs `portal.js` and `portal.css` to `wp-plugin/assets/`. If you're actively developing:

```bash
npm run dev
```

> The dev server runs on port 5173. For live development, you'll need to temporarily update the plugin's asset enqueue path to point to the dev server, or rebuild after each change.

---

## 6. Set Up the Staff Portal Page in WordPress

1. Go to **WP Admin → Pages → Add New**.
2. Title it **"Staff Portal"** (or similar).
3. In the body, add the shortcode:
   ```
   [induction_portal]
   ```
4. Publish the page.
5. Visit the page URL — the React portal will render here for logged-in staff.

---

## 7. Set Up the Admin App (Standalone SPA)

The admin app is a separate React SPA that communicates with the WordPress REST API.

### Configure the API URL

Create a `.env` file in the `admin/` directory:

```bash
cp admin/.env.example admin/.env
```

If no `.env.example` exists, create `admin/.env` with:

```env
VITE_WP_REST_URL=http://induction-platform.local/wp-json
```

Replace `http://induction-platform.local` with your Local site URL.

### Run the Admin App

```bash
cd admin
npm install
npm run dev
```

The admin app runs at `http://localhost:5174`. Log in with your WordPress admin credentials.

---

## 8. Create Users and Assign Roles

### Staff users

1. Go to **WP Admin → Users → Add New**.
2. Set the role to **Staff**.
3. Staff users will see assigned modules when they visit the portal page.

### Induction admins

1. Go to **WP Admin → Users → Add New** (or edit an existing user).
2. Set the role to **Induction Admin**.
3. Induction admins can manage modules and documents via the admin app.

---

## 9. Verify the Setup

| Check | How |
|---|---|
| JWT plugin active | WP Admin → Plugins — confirm "JWT Authentication for WP REST API" is active |
| `JWT_AUTH_SECRET_KEY` set | `GET /wp-json/jwt-auth/v1/token` returns a token when POSTing credentials |
| Plugin active | WP Admin → Plugins — confirm "Induction Platform" is active |
| Portal built | `wp-plugin/assets/portal.js` and `portal.css` exist |
| Portal renders | Visit the Staff Portal page while logged in as a Staff user |
| Admin app works | `http://localhost:5174` — log in as admin or induction_admin |

---

## Project Structure

```
prototypeReactWordpress/
├── admin/          # Standalone admin SPA (React + Vite, port 5174)
├── portal/         # Staff portal (React + Vite, builds to wp-plugin/assets/)
└── wp-plugin/      # WordPress plugin (PHP, REST API, custom DB table)
    └── assets/     # Built portal JS/CSS (generated by `npm run build` in portal/)
```

---

## Troubleshooting

**JWT returns 403 "jwt_auth_bad_config"**
— `JWT_AUTH_SECRET_KEY` is not defined or `wp-config.php` was not saved. Double-check the constant is above `/* That's all, stop editing! */`.

**Portal page is blank**
— The portal has not been built yet. Run `npm run build` in the `portal/` directory.

**REST API returns 401 on admin app login**
— Confirm the JWT plugin is activated and `VITE_WP_API_URL` in `admin/.env` points to the correct Local site URL.

**"Authorization" header stripped**
— Add the `RewriteRule` to `.htaccess` as described in step 3. The plugin's PHP fallback should also handle this automatically.
