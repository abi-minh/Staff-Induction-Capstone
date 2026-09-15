/// <reference types="cypress" />
import { testEnv, wp } from '../../support/testEnv';

describe('Authentication and role boundaries', () => {
  it('issues a token for valid credentials', () => {
    const { user } = testEnv().admin;
    // The password comes off the secret channel, not testEnv() — see the note
    // in support/testEnv.ts about the Cypress 16 expose/env split.
    cy.env<Record<string, string>>(['adminPass']).then(({ adminPass }) => {
      cy.request('POST', wp('jwt-auth/v1/token'), { username: user, password: adminPass })
        .then(({ status, body }) => {
          expect(status).to.eq(200);
          expect(body.token).to.be.a('string').and.have.length.greaterThan(20);
        });
    });
  });

  it('rejects a wrong password without leaking whether the user exists', () => {
    const { user } = testEnv().admin;
    cy.request({
      method: 'POST',
      url: wp('jwt-auth/v1/token'),
      body: { username: user, password: 'definitely-not-the-password' },
      failOnStatusCode: false,
    }).its('status').should('be.oneOf', [401, 403]);
  });

  it('refuses admin routes with no token at all', () => {
    [
      'induction/v1/staff',
      'induction/v1/reports/summary',
      'induction/v1/transfer/export',
    ].forEach((route) => {
      cy.request({ url: wp(route), failOnStatusCode: false })
        .its('status')
        .should('be.oneOf', [401, 403]);
    });
  });

  // The important half of the permission model: a staff token must not reach
  // admin data. A leak here exposes every colleague's training record.
  it('refuses admin routes when authenticated as staff', () => {
    cy.loginAs('staff').then((token) => {
      ['induction/v1/staff', 'induction/v1/reports/summary', 'induction/v1/transfer/export']
        .forEach((route) => {
          cy.request({
            url: wp(route),
            headers: { Authorization: `Bearer ${token}` },
            failOnStatusCode: false,
          })
            .its('status')
            .should('be.oneOf', [401, 403]);
        });
    });
  });

  it('lets a staff token read its own identity and the team page', () => {
    cy.loginAs('staff').then((token) => {
      const headers = { Authorization: `Bearer ${token}` };
      cy.request({ url: wp('induction/v1/me'), headers }).its('status').should('eq', 200);
      cy.request({ url: wp('induction/v1/team'), headers }).its('status').should('eq', 200);
    });
  });

  it('rejects a malformed token', () => {
    cy.request({
      url: wp('induction/v1/staff'),
      headers: { Authorization: 'Bearer not.a.real.token' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('be.oneOf', [401, 403]);
  });
});
