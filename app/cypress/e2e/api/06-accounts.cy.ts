/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

// Account creation now emails the new starter. The security-relevant assertion
// is the negative one: the email must NOT contain the password the admin typed.

describe('Staff account creation', () => {
  const created: number[] = [];

  after(() => {
    if (created.length) cy.api('POST', 'induction/v1/staff/remove', { user_ids: created });
  });

  function newStaff(suffix: string) {
    const stamp = `${Date.now()}${suffix}`;
    return {
      name: `Cypress ${stamp}`,
      username: `cypress_${stamp}`,
      email: `cypress_${stamp}@example.test`,
      role: 'staff',
      password: 'a-long-enough-password',
    };
  }

  it('creates an account and reports that the setup email was sent', () => {
    const input = newStaff('a');
    cy.api('POST', 'induction/v1/staff', input).then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.id).to.be.a('number');
      expect(body.notified, 'setup email reported as sent').to.eq(true);
      created.push(body.id);
    });
  });

  it('suppresses the email when notify is false', () => {
    const input = { ...newStaff('b'), notify: false };
    cy.api('POST', 'induction/v1/staff', input).then(({ body }) => {
      expect(body.notified).to.eq(false);
      created.push(body.id);
    });
  });

  it('never puts the password in the email, and does include a set-password link', () => {
    if (!testEnv().mailUrl) {
      cy.log('No mail catcher configured — skipping delivered-content assertion');
      return;
    }
    const input = newStaff('c');
    cy.api('POST', 'induction/v1/staff', input).then(({ body }) => {
      created.push(body.id);

      cy.request(`${testEnv().mailUrl}/api/v2/messages`).then(({ body: mail }) => {
        const latest = JSON.stringify(mail.items?.[0] ?? {});
        expect(latest, 'password must not be mailed').to.not.contain(input.password);
        expect(latest).to.contain('action=rp');
        expect(latest).to.contain(input.username);
      });
    });
  });

  it('rejects a weak password', () => {
    cy.api('POST', 'induction/v1/staff', { ...newStaff('d'), password: 'short' })
      .then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('weak_password');
      });
  });

  it('rejects a duplicate username', () => {
    const input = newStaff('e');
    cy.api('POST', 'induction/v1/staff', input).then(({ body }) => {
      created.push(body.id);
      cy.api('POST', 'induction/v1/staff', input).its('status').should('eq', 400);
    });
  });

  it('refuses account creation to a staff token', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        method: 'POST',
        url: `${testEnv().wpUrl}/wp-json/induction/v1/staff`,
        headers: { Authorization: `Bearer ${token}` },
        body: newStaff('f'),
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);
    });
  });
});
