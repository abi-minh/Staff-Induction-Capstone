# Induction Platform — Setup Guide

A staff onboarding and training platform built with **React + WordPress**, consisting of two applications embedded into WordPress via shortcode:
- **Staff Portal** — for staff users to complete assigned induction modules  
- **Admin Portal** — for managing modules, documents, users, and reporting

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

## 2. Install the Custom WordPress Plugin

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

## 3. Build the React Applications

Both apps compile directly into the plugin assets folder.

### Build Staff Portal

```bash
cd portal
npm install
npm run build
```

This outputs `portal.js` and `portal.css` to `wp-plugin/assets/portal/`


### Build Admin Portal
```bash
cd admin
npm install
npm run build
```

This outputs `admin.js` and `admin.css` to `wp-plugin/assets/admin/`

---

## 4. Add the Staff Portal to WordPress

1. Go to **WP Admin → Pages → Add New**.
2. Title it **"Staff Portal"** (or similar).
3. In the body, add the shortcode:
   ```
   [induction_portal]
   ```
4. Publish the page.

---

## 5. Add the Admin Portal to WordPress

1. Go to **WP Admin → Pages → Add New**.
2. Title it **"Admin Portal"** (or similar).
3. In the body, add the shortcode:
   ```
   [induction_admin]
   ```
4. Publish the page.

---

## 6. Create Users and Assign Roles

### Staff users

1. Go to **WP Admin → Users → Add New**.
2. Set the role to **Staff**.
3. Staff users will see assigned modules when they visit the portal page.

### Induction admins

1. Go to **WP Admin → Users → Add New** (or edit an existing user).
2. Set the role to **Induction Admin**.
3. Induction admins can manage modules and documents via the admin app.

---

## 8. Updating the Plugin

1. Rebuild apps - npm run build portal and admin directories 
2. Copy plugin folder into WordPress plugins directory
3. Replace the existing plugin files with - wp-plugin/
4. Reload wordpress site

---

## 9. Verify the Setup

| Check | How |
|---|---|
| Plugin active | WP Admin → Plugins — confirm "Induction Platform" is active |
| Portal built | `wp-plugin/assets/portal/portal.js` and `portal.css` exist |
| Admin built | `wp-plugin/assets/admin/adminl.js` and `admin.css` exist |
| Portal renders | [induction_portal] renders React app |
| Admin renders | [induction_admin] renders React app |
| Staff and Admin login work | Staff sees assigned modules and Admin sees management |

---

## Project Structure

```
prototypeReactWordpress/
├── admin/          # Admin React app
├── portal/         # Staff portal React app
└── wp-plugin/      # WordPress plugin
    └── assets/
        ├── admin/
        └── portal/
```

---

## Troubleshooting

**Portal or admin page is blank**
— The portal has not been built yet. Run `npm run build` for the relevant app.

**App Not Loading**
- Ensure page contains [induction_admin] or [induction_portal]



# WordPress Admin App as plugin update
## Previous JWT Login Removed
The old standalone JWT login flow has been removed from the admin application.

## Wordpress auth 
Authentication is now handled using:
- Existing WordPress login session
- WordPress cookies
- REST API nonce (X-WP-Nonce)
- Role/capability checks inside the plugin

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