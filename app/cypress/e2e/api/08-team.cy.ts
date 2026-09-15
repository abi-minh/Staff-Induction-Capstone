/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

// The Meet Our Team endpoint. Two things matter here beyond the happy path:
// only opted-in profiles appear, and the owner's contact details are not
// handed out for anybody else — /team is readable by any signed-in account,
// not just staff.

describe('Meet Our Team', () => {
  it('is readable by a staff token', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        url: `${testEnv().wpUrl}/wp-json/induction/v1/team`,
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body).to.be.an('array');
      });
    });
  });

  it('returns the documented shape for every entry', () => {
    cy.api('GET', 'induction/v1/team').then(({ body }) => {
      body.forEach((member: Record<string, unknown>) => {
        expect(member).to.include.keys([
          'id', 'name', 'roleLabel', 'region', 'photoUrl', 'bio', 'isOwner',
          'contactEmail', 'contactPhone',
        ]);
      });
    });
  });

  it('lists at most one owner', () => {
    cy.api('GET', 'induction/v1/team').then(({ body }) => {
      const owners = body.filter((m: { isOwner: boolean }) => m.isOwner);
      expect(owners.length).to.be.at.most(1);
    });
  });

  // The privacy assertion: a non-owner entry must carry no contact details,
  // whatever is stored against that user.
  it('sends contact details only for the owner', () => {
    cy.api('GET', 'induction/v1/team').then(({ body }) => {
      body
        .filter((m: { isOwner: boolean }) => !m.isOwner)
        .forEach((m: { contactEmail: string; contactPhone: string; name: string }) => {
          expect(m.contactEmail, `contactEmail leaked for ${m.name}`).to.eq('');
          expect(m.contactPhone, `contactPhone leaked for ${m.name}`).to.eq('');
        });
    });
  });

  it('only lists profiles an admin has made visible', () => {
    cy.api('GET', 'induction/v1/team').then(({ body: team }) => {
      const listed = team.map((m: { id: number }) => m.id);
      cy.api('GET', 'induction/v1/staff').then(({ body: staff }) => {
        staff
          .filter((s: { teamVisible?: boolean; team_visible?: boolean }) =>
            !(s.teamVisible ?? s.team_visible))
          .forEach((s: { id: number; name: string }) => {
            expect(listed, `${s.name} is not opted in and must not be listed`).to.not.include(s.id);
          });
      });
    });
  });

  describe('contact details are admin-maintained', () => {
    let staffId: number;

    before(() => {
      // These cases overwrite the contact details on whichever account they
      // resolve, so it has to be the fixture one.
      cy.fixtureStaff().then((staff) => {
        staffId = staff.id;
      });
    });

    it('an admin can set and clear them', () => {
      cy.api('POST', `induction/v1/staff/${staffId}/team-profile`, {
        contact_email: 'bookings@example.test',
        contact_phone: '0400 000 000',
      }).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body.team_contact_email).to.eq('bookings@example.test');
        expect(body.team_contact_phone).to.eq('0400 000 000');
      });

      cy.api('POST', `induction/v1/staff/${staffId}/team-profile`, {
        contact_email: '',
        contact_phone: '',
      }).then(({ body }) => {
        expect(body.team_contact_email).to.eq('');
        expect(body.team_contact_phone).to.eq('');
      });
    });

    it('rejects an invalid contact email', () => {
      cy.api('POST', `induction/v1/staff/${staffId}/team-profile`, {
        contact_email: 'not-an-email',
      }).then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('invalid_contact_email');
      });
    });

    // A staff member editing their own profile must not be able to set the
    // business contact details — that is the point of them being admin-only.
    it('is not settable through a staff member\'s own profile endpoint', () => {
      cy.loginAs('staff').then((token) => {
        cy.request({
          method: 'POST',
          url: `${testEnv().wpUrl}/wp-json/induction/v1/me/profile`,
          headers: { Authorization: `Bearer ${token}` },
          body: { contact_email: 'hijack@example.test', contact_phone: '0499 999 999' },
          failOnStatusCode: false,
        }).then(({ status, body }) => {
          expect(status).to.eq(200);
          expect(body.team_contact_email).to.not.eq('hijack@example.test');
          expect(body.team_contact_phone).to.not.eq('0499 999 999');
        });
      });
    });
  });
});
