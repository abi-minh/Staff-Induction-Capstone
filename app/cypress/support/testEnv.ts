/// <reference types="cypress" />

// Cypress 16 removed `Cypress.env()` and replaced it with two channels:
//
//   Cypress.expose()  - synchronous, for non-sensitive values
//   cy.env([keys])    - a command, and the only route to sensitive values
//
// Note `Cypress.config('env')` type-checks, because `env` is a key of
// ResolvedConfigOptions — but it is undefined at runtime, since the whole point
// of the change is that secrets are not in the browser's synchronous scope.
// Everything here reads the expose channel; passwords are fetched with cy.env()
// in commands.ts and are deliberately absent from this interface.
//
// Reading it in exactly one place means a future Cypress change is a one-file
// fix rather than a sweep through every spec.

export interface TestEnv {
  /** WordPress under test. Must be a dedicated test site, never staging. */
  wpUrl: string;
  admin: { user: string };
  staff: { user: string };
  /** MailHog/MailPit API root, or '' when no catcher is configured. */
  mailUrl: string;
  /**
   * Domains the suite is permitted to send mail to. This is the containment
   * mechanism when there is no mail catcher: specs that send resolve their
   * recipient from the fixture account and refuse to proceed unless that
   * address sits in a domain listed here. Default is example.test, which RFC
   * 2606 reserves and no MTA can deliver to.
   */
  mailDomains: string[];
}

interface Exposed {
  wpUrl?: string;
  adminUser?: string;
  staffUser?: string;
  mailUrl?: string;
  mailDomains?: string[];
}

export function testEnv(): TestEnv {
  const e = (Cypress.expose() ?? {}) as Exposed;
  return {
    wpUrl: e.wpUrl ?? '',
    admin: { user: e.adminUser ?? '' },
    staff: { user: e.staffUser ?? '' },
    mailUrl: e.mailUrl ?? '',
    mailDomains: e.mailDomains?.length ? e.mailDomains : ['example.test'],
  };
}

/** True when an address is one the suite is allowed to mail. */
export function isSafeRecipient(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return testEnv().mailDomains.some(
    (allowed) => domain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`),
  );
}

/** Absolute URL for a REST route, e.g. wp('induction/v1/modules'). */
export function wp(path: string): string {
  return `${testEnv().wpUrl}/wp-json/${path.replace(/^\/+/, '')}`;
}
