/// <reference types="cypress" />

// Cypress 16 removed the `Cypress.env('key')` accessor that every tutorial
// still uses; environment values now live under `Cypress.config('env')`.
// Reading it in exactly one place means a future Cypress upgrade — or a move
// back to `Cypress.env()` — is a one-file change rather than a sweep through
// every spec.

export interface Credentials {
  user: string;
  pass: string;
}

export interface TestEnv {
  /** WordPress under test. Must be a dedicated test site, never staging. */
  wpUrl: string;
  admin: Credentials;
  staff: Credentials;
  /** MailHog/MailPit API root, or '' when no catcher is configured. */
  mailUrl: string;
}

export function testEnv(): TestEnv {
  const env = Cypress.config('env') as Partial<TestEnv>;
  return {
    wpUrl: env.wpUrl ?? '',
    admin: env.admin ?? { user: '', pass: '' },
    staff: env.staff ?? { user: '', pass: '' },
    mailUrl: env.mailUrl ?? '',
  };
}

/** Absolute URL for a REST route, e.g. wp('induction/v1/modules'). */
export function wp(path: string): string {
  return `${testEnv().wpUrl}/wp-json/${path.replace(/^\/+/, '')}`;
}
