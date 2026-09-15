import { defineConfig } from 'cypress';

// Every environment value is overridable from CI or a local cypress.env.json.
// The defaults deliberately point at localhost, never staging: these specs
// create staff, submit quizzes and SEND EMAIL, and a default that reaches the
// client's site is one typo away from mailing their actual employees.
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_APP_URL ?? 'http://localhost:5175',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'test-results/cypress-[hash].xml',
      toConsole: true,
    },
    env: {
      // WordPress under test. MUST be a dedicated test site.
      wpUrl: process.env.CYPRESS_WP_URL ?? 'http://localhost:8080',
      admin: {
        user: process.env.CYPRESS_ADMIN_USER ?? 'induction_admin_testing',
        pass: process.env.CYPRESS_ADMIN_PASS ?? '',
      },
      staff: {
        user: process.env.CYPRESS_STAFF_USER ?? 'induction_staff_testing',
        pass: process.env.CYPRESS_STAFF_PASS ?? '',
      },
      // MailHog/MailPit API, for asserting what was actually sent.
      mailUrl: process.env.CYPRESS_MAIL_URL ?? '',
    },
  },
});
