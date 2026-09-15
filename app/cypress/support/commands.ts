/// <reference types="cypress" />
import { testEnv, wp } from './testEnv';
import type { Credentials } from './testEnv';

type Role = 'admin' | 'staff';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Mints a JWT via the API and seeds it, skipping the login form. */
      loginAs(role: Role): Chainable<string>;
      /** An authenticated request against the plugin's REST namespace. */
      api(
        method: string,
        path: string,
        body?: Cypress.RequestBody,
        options?: Partial<Cypress.RequestOptions>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ): Chainable<Cypress.Response<any>>;
      /** Seeds the browser session so cy.visit() lands already signed in. */
      visitAs(role: Role, path?: string): Chainable<void>;
    }
  }
}

// Tokens are minted once per role per run. Logging in through the UI on every
// spec would add minutes and make an auth outage look like a feature failure.
const tokenCache: Partial<Record<Role, string>> = {};

Cypress.Commands.add('loginAs', (role: Role) => {
  const cached = tokenCache[role];
  if (cached) return cy.wrap(cached, { log: false });

  const { user, pass }: Credentials = testEnv()[role];
  expect(pass, `password for the ${role} test account (set CYPRESS_${role.toUpperCase()}_PASS)`)
    .to.be.a('string').and.not.be.empty;

  return cy
    .request('POST', wp('jwt-auth/v1/token'), { username: user, password: pass })
    .then(({ body }) => {
      tokenCache[role] = body.token;
      return body.token as string;
    });
});

Cypress.Commands.add('api', (method, path, body, options = {}) =>
  cy.loginAs('admin').then((token) =>
    cy.request({
      method,
      url: wp(path),
      body,
      headers: { Authorization: `Bearer ${token}` },
      // Off by default so a spec can assert on 4xx responses, which is most of
      // what the permission tests do.
      failOnStatusCode: false,
      ...options,
    }),
  ),
);

Cypress.Commands.add('visitAs', (role: Role, path = '/') => {
  cy.loginAs(role).then((token) => {
    cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('induction_token', token);
        // The store reads a user object alongside the token; without it the
        // app treats the session as unauthenticated and bounces to /login.
        win.localStorage.setItem(
          'induction_user',
          JSON.stringify({ id: 0, name: role, roles: [role === 'admin' ? 'induction_admin' : 'staff'] }),
        );
      },
    });
  });
});

export {};
