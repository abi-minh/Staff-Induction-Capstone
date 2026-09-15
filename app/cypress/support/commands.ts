/// <reference types="cypress" />
import { testEnv, wp, isSafeRecipient } from './testEnv';

type Role = 'admin' | 'staff';

export interface FixtureStaff {
  id: number;
  name: string;
  slug: string;
  email: string;
}

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
      /**
       * The dedicated staff fixture account — the only staff record specs may
       * mutate or mail. Never picks a record positionally.
       */
      fixtureStaff(): Chainable<FixtureStaff>;
    }
  }
}

// Tokens are minted once per role per run. Logging in through the UI on every
// spec would add minutes and make an auth outage look like a feature failure.
const tokenCache: Partial<Record<Role, string>> = {};

Cypress.Commands.add('loginAs', (role: Role) => {
  const cached = tokenCache[role];
  if (cached) return cy.wrap(cached, { log: false });

  const { user } = testEnv()[role];
  const passKey = role === 'admin' ? 'adminPass' : 'staffPass';

  // cy.env() is the only way to reach a secret in Cypress 16, and it is a
  // command rather than an accessor — hence the extra nesting here. The
  // password never enters the spec's synchronous scope, which is the point.
  return cy.env<Record<string, string>>([passKey]).then((secrets) => {
    const pass = secrets[passKey];
    expect(pass, `password for the ${role} test account (set CYPRESS_${role.toUpperCase()}_PASS)`)
      .to.be.a('string').and.not.be.empty;

    return cy
      .request('POST', wp('jwt-auth/v1/token'), { username: user, password: pass })
      .then(({ body }) => {
        tokenCache[role] = body.token;
        return body.token as string;
      });
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

// Resolved once per run. Specs previously took `body[0]` of the staff list,
// which on any site with real data is a real colleague — one who then gets
// their profile rewritten and, in the reminder specs, actually emailed. The
// account is now found by the username under test, and the run aborts if its
// address is not a sink. That check is the containment: without a mail
// catcher it is the only thing standing between a misconfigured run and the
// client's staff, so it fails the suite rather than skipping.
let fixtureStaffCache: FixtureStaff | undefined;

Cypress.Commands.add('fixtureStaff', () => {
  if (fixtureStaffCache) return cy.wrap(fixtureStaffCache, { log: false });

  const username = testEnv().staff.user;

  return cy.api('GET', 'induction/v1/staff').then(({ body }) => {
    const match = (body as FixtureStaff[]).find((s) => s.slug === username);

    expect(
      match,
      `the staff fixture account "${username}" must exist on the test site — ` +
        'create it, or set CYPRESS_STAFF_USER to an account that exists',
    ).to.not.be.undefined;

    const staff = match as FixtureStaff;

    expect(
      isSafeRecipient(staff.email),
      `refusing to run: "${username}" has address ${staff.email}, which is outside ` +
        `the permitted domains (${testEnv().mailDomains.join(', ')}). Point the ` +
        'fixture account at a sink address, or widen CYPRESS_MAIL_DOMAINS to a ' +
        'mailbox you own. Never widen it to the client\'s domain.',
    ).to.eq(true);

    fixtureStaffCache = staff;
    return staff;
  });
});

interface PortalUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

// Resolved once per role. The seeded session used to carry a stub user with
// id: 0, which is enough to get past the auth guard and route correctly — and
// silently wrong everywhere the id is actually used. StaffModuleViewPage starts
// a progress record from an effect guarded on `!userId`, and 0 is falsy, so
// opening a module recorded nothing and the failure surfaced as "no request
// ever occurred" rather than as a bad fixture.
const meCache: Partial<Record<Role, PortalUser>> = {};

function currentUser(role: Role, token: string): Cypress.Chainable<PortalUser> {
  const cached = meCache[role];
  if (cached) return cy.wrap(cached, { log: false });

  return cy
    .request({ url: wp('induction/v1/me'), headers: { Authorization: `Bearer ${token}` } })
    .then(({ body }) => {
      meCache[role] = body as PortalUser;
      return body as PortalUser;
    });
}

Cypress.Commands.add('visitAs', (role: Role, path = '/') => {
  cy.loginAs(role).then((token) => {
    currentUser(role, token).then((user) => {
      cy.visit(path, {
        onBeforeLoad(win) {
          // The e2e build is served standalone by `vite preview`, so the
          // WordPress shortcode that normally prints window.InductionApp never
          // runs. api/client.ts reads restUrl at module scope and otherwise
          // falls back to localhost:8080 — the app would quietly talk to the
          // wrong backend. onBeforeLoad runs before the page's own scripts, so
          // setting it here points the bundle at the same site the API specs
          // use, with no build-time environment variable to keep in sync.
          (win as Window & { InductionApp?: { restUrl: string } }).InductionApp = {
            restUrl: `${testEnv().wpUrl}/wp-json/`,
          };

          win.localStorage.setItem('induction_token', token);
          // The real record from /me, not a stub: the store's user.id is what
          // the portal pages send back to the API.
          win.localStorage.setItem('induction_user', JSON.stringify(user));
        },
      });
    });
  });
});

export {};
