/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

// These specs send email. They rely on the test site's mailer being a catcher
// (MailHog/MailPit) — see cypress.config.ts. Running them against a site with a
// real SMTP transport mails the client's staff.

describe('Training reminders', () => {
  let staffId: number;

  before(() => {
    // The fixture account, never body[0]: these specs send real mail, and the
    // first record on a populated site is a real staff member.
    cy.fixtureStaff().then((staff) => {
      staffId = staff.id;
    });
  });

  describe('context', () => {
    it('describes one staff member for the compose dialog', () => {
      cy.api('GET', `induction/v1/staff/${staffId}/reminder`).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body).to.include.keys(['name', 'email', 'site_name', 'portal_url', 'modules']);
        expect(body.modules).to.be.an('array');
      });
    });

    it('lists only outstanding modules, never completed ones', () => {
      cy.api('GET', `induction/v1/staff/${staffId}/reminder`).then(({ body }) => {
        cy.api('GET', `induction/v1/progress/user/${staffId}`).then(({ body: progress }) => {
          const completed = progress
            .filter((p: { status: string }) => p.status === 'completed')
            .map((p: { moduleId?: number; module_id?: number }) => p.moduleId ?? p.module_id);
          const reminded = body.modules.map((m: { module_id: number }) => m.module_id);
          completed.forEach((id: number) => expect(reminded).to.not.include(id));
        });
      });
    });

    it('fetches many contexts in one request', () => {
      cy.api('GET', 'induction/v1/staff').then(({ body: staff }) => {
        const ids = staff.slice(0, 3).map((s: { id: number }) => s.id);
        cy.api('GET', `induction/v1/staff/reminders/context?user_ids=${ids.join(',')}`)
          .then(({ status, body }) => {
            expect(status).to.eq(200);
            expect(body).to.have.length(ids.length);
            expect(body.map((c: { user_id: number }) => c.user_id)).to.deep.eq(ids);
          });
      });
    });

    it('404s an unknown staff member', () => {
      cy.api('GET', 'induction/v1/staff/99999/reminder').its('status').should('eq', 404);
    });
  });

  describe('sending', () => {
    it('sends one composed reminder', () => {
      cy.api('POST', `induction/v1/staff/${staffId}/reminder`, {
        subject: 'Cypress single reminder',
        body: '<p>Please finish your training.</p>',
      }).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body.sent).to.eq(true);
      });
    });

    it('refuses an empty subject or body rather than mailing a blank', () => {
      cy.api('POST', `induction/v1/staff/${staffId}/reminder`, {
        subject: '',
        body: '<p>x</p>',
      }).then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('empty_email');
      });

      cy.api('POST', `induction/v1/staff/${staffId}/reminder`, {
        subject: 'Has a subject',
        body: '<p>   </p>',
      }).its('status').should('eq', 400);
    });

    it('strips scripts from a composed body', () => {
      cy.api('POST', `induction/v1/staff/${staffId}/reminder`, {
        subject: 'Cypress sanitiser check',
        body: '<p>ok</p><script>alert(1)</script>',
      }).its('status').should('eq', 200);

      // Asserted at the mail catcher, since the response only reports handoff.
      if (testEnv().mailUrl) {
        cy.request(`${testEnv().mailUrl}/api/v2/messages`).then(({ body }) => {
          const latest = JSON.stringify(body.items?.[0] ?? {});
          expect(latest).to.not.contain('<script>');
        });
      }
    });

    // The batch is the fixture account plus a deliberately unresolvable id,
    // rather than the first two records on the site. That still exercises
    // per-recipient reporting across a mixed batch — one success, one failure —
    // without a second real person receiving anything.
    it('reports a per-recipient result for every address in a batch', () => {
      const targets = [staffId, 99999];

      cy.api('POST', 'induction/v1/staff/reminders', {
        messages: targets.map((id) => ({
          user_id: id,
          subject: 'Cypress bulk reminder',
          body: '<p>Bulk body.</p>',
        })),
      }).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body.results).to.have.length(targets.length);
        expect(body.sent + body.failed).to.eq(targets.length);
        expect(body.sent, 'the fixture account is mailable').to.eq(1);
        expect(body.failed, 'the unknown id is reported, not dropped').to.eq(1);
        body.results.forEach((r: { user_id: number; sent: boolean }) => {
          expect(r).to.include.keys(['user_id', 'name', 'sent', 'reason']);
        });
      });
    });

    it('reports rather than silently dropping a recipient who cannot be mailed', () => {
      cy.api('POST', 'induction/v1/staff/reminders', {
        messages: [{ user_id: 99999, subject: 'x', body: '<p>y</p>' }],
      }).then(({ body }) => {
        expect(body.sent).to.eq(0);
        expect(body.failed).to.eq(1);
        expect(body.results[0].reason).to.not.be.empty;
      });
    });

    it('rejects an empty batch and an oversized one', () => {
      cy.api('POST', 'induction/v1/staff/reminders', { messages: [] })
        .its('status').should('eq', 400);

      const tooMany = Array.from({ length: 201 }, () => ({
        user_id: staffId, subject: 'x', body: '<p>y</p>',
      }));
      cy.api('POST', 'induction/v1/staff/reminders', { messages: tooMany })
        .then(({ status, body }) => {
          expect(status).to.eq(400);
          expect(body.code).to.eq('too_many_messages');
        });
    });

    it('refuses bulk sending to a staff token', () => {
      cy.loginAs('staff').then((token) => {
        cy.request({
          method: 'POST',
          url: `${testEnv().wpUrl}/wp-json/induction/v1/staff/reminders`,
          headers: { Authorization: `Bearer ${token}` },
          body: { messages: [{ user_id: staffId, subject: 'x', body: '<p>y</p>' }] },
          failOnStatusCode: false,
        }).its('status').should('be.oneOf', [401, 403]);
      });
    });
  });
});
