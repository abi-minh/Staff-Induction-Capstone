import { defineConfig } from 'cypress';

// Every environment value is overridable from CI or a local cypress.env.json.
// The defaults deliberately point at localhost, never staging: these specs
// create staff, submit quizzes and SEND EMAIL, and a default that reaches the
// client's site is one typo away from mailing their actual employees.
export default defineConfig({
  e2e: {
    // Null unless CYPRESS_APP_URL is set, and deliberately not defaulted to a
    // localhost port. Cypress pings baseUrl at startup and aborts the whole run
    // if nothing answers — but only the lifecycle specs call cy.visit(). The
    // endpoint suite is cy.request() against wpUrl, so a default here made the
    // API run depend on a dev server it never touches. nightly.yml sets this
    // explicitly after serving the built app; set it yourself to run the
    // lifecycle specs locally.
    baseUrl: process.env.CYPRESS_APP_URL ?? null,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    // Tuned for a remote target, not a local dev server. The app under test
    // talks to a WordPress on shared hosting behind Wordfence and LiteSpeed,
    // and an admin page fires five REST calls on mount; 8s routinely expired
    // while the page still read "Loading…", which surfaces as a misleading
    // "expected to find content" failure rather than "the site was slow".
    defaultCommandTimeout: 20000,
    requestTimeout: 30000,
    responseTimeout: 60000,
    pageLoadTimeout: 120000,
    retries: { runMode: 1, openMode: 0 },
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'test-results/cypress-[hash].xml',
      toConsole: true,
    },
    // Cypress 16 split configuration values in two, and the split is a security
    // boundary rather than a naming preference:
    //
    //   expose  - readable synchronously in the browser via Cypress.expose().
    //   env     - reachable only through the async cy.env() command, so secrets
    //             never sit in the spec's synchronous scope.
    //
    // Passwords therefore live in `env` and everything else in `expose`.
    // cypress.env.json merges into `env` wholesale, so setupNodeEvents below
    // re-sorts its contents into the right channel — that keeps one file for
    // a developer to edit while still honouring the boundary.
    setupNodeEvents(_on, config) {
      const file = (config.env ?? {}) as Record<string, never>;
      const creds = (key: 'admin' | 'staff') =>
        (file[key] ?? {}) as unknown as { user?: string; pass?: string };

      config.expose = {
        // WordPress under test. MUST be a dedicated test site.
        wpUrl: process.env.CYPRESS_WP_URL ?? file.wpUrl ?? 'http://localhost:8080',
        adminUser: process.env.CYPRESS_ADMIN_USER ?? creds('admin').user ?? 'induction_admin_testing',
        staffUser: process.env.CYPRESS_STAFF_USER ?? creds('staff').user ?? 'induction_staff_testing',
        // MailHog/MailPit API, for asserting what was actually sent.
        mailUrl: process.env.CYPRESS_MAIL_URL ?? file.mailUrl ?? '',
        // Domains the suite may mail. Specs that send resolve their recipient
        // from the fixture account and abort unless it matches. example.test is
        // RFC 2606 reserved and undeliverable, so the default cannot reach a
        // real person even if every other guard is misconfigured. Widen this
        // only to a sink you own (a Mailtrap or Mailinator address), never to
        // the client's domain.
        mailDomains: process.env.CYPRESS_MAIL_DOMAINS
          ? process.env.CYPRESS_MAIL_DOMAINS.split(',').map((d) => d.trim()).filter(Boolean)
          : (file.mailDomains as unknown as string[] | undefined) ?? ['example.test'],
      };

      // Replaced, not merged: whatever cypress.env.json held is re-read above,
      // and leaving the rest in `env` would keep non-secrets on the secret
      // channel where no synchronous helper can reach them.
      config.env = {
        adminPass: process.env.CYPRESS_ADMIN_PASS ?? creds('admin').pass ?? '',
        staffPass: process.env.CYPRESS_STAFF_PASS ?? creds('staff').pass ?? '',
      };

      return config;
    },
  },
});
