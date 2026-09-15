/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

// The deployment health check the deliverables agreement promises. It asserts
// the plugin's whole route surface is registered, which catches the failure
// mode that actually happens after a deploy: a rewrite cache or a stale plugin
// leaves a namespace half-present and every call 404s.
const EXPECTED_ROUTES = [
  '/induction/v1',
  '/induction/v1/me',
  '/induction/v1/modules',
  '/induction/v1/staff',
  '/induction/v1/staff-roles',
  '/induction/v1/roles',
  '/induction/v1/progress',
  '/induction/v1/quiz/check',
  '/induction/v1/quiz/save',
  '/induction/v1/quiz/grade',
  '/induction/v1/quiz/submit-for-review',
  '/induction/v1/quiz/pending-review',
  '/induction/v1/assignments/bulk',
  '/induction/v1/assignments/remove',
  '/induction/v1/assignments/role',
  '/induction/v1/assignments/role/remove',
  '/induction/v1/reports/summary',
  '/induction/v1/reports/overdue',
  '/induction/v1/team',
  '/induction/v1/locations',
  '/induction/v1/transfer/export',
  '/induction/v1/transfer/import',
  '/induction/v1/staff/reminders',
  '/induction/v1/staff/reminders/context',
  '/induction/v1/media',
  '/induction/v1/resource-categories',
];

describe('Endpoint health', () => {
  it('registers every expected route in the induction namespace', () => {
    cy.request(`${testEnv().wpUrl}/wp-json/induction/v1`).then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.namespace).to.eq('induction/v1');

      const registered = Object.keys(body.routes);
      const missing = EXPECTED_ROUTES.filter((route) => !registered.includes(route));

      // Named in the assertion so a failure says which route vanished.
      expect(missing, `missing routes: ${missing.join(', ')}`).to.deep.eq([]);
    });
  });

  it('registers the parameterised routes', () => {
    cy.request(`${testEnv().wpUrl}/wp-json/induction/v1`).then(({ body }) => {
      const registered = Object.keys(body.routes).join('\n');
      ['modules/', 'staff/', 'locations/', 'versions'].forEach((fragment) => {
        expect(registered).to.contain(fragment);
      });
    });
  });

  it('serves the WordPress core namespaces the app also depends on', () => {
    cy.request(`${testEnv().wpUrl}/wp-json/wp/v2`).its('status').should('eq', 200);
  });
});
