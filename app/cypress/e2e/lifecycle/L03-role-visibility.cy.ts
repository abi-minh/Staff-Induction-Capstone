/// <reference types="cypress" />
import { wp } from '../../support/testEnv';
import { textSection } from '../../support/fixtures';

// L3: a module targeted at the staff member's role appears; one targeted elsewhere does not.

const IN_ROLE = 'staff';            // the fixture staff member has this
const OUT_ROLE = 'induction_admin'; // and deliberately does not have this

function publishedSection(): string {
  return JSON.stringify([
    textSection('<p>Role targeted content.</p>', {
      id: 'section-l3',
      title: 'Role section',
      status: 'publish',
    }),
  ]);
}

describe('L3 · role-targeted visibility', () => {
  let staffId: number;
  let inRoleModule: number;
  let outRoleModule: number;
  const inTitle = `L3 in-role ${Date.now()}`;
  const outTitle = `L3 out-of-role ${Date.now()}`;

  before(() => {
    cy.fixtureStaff().then((staff) => { staffId = staff.id; });

    // Guard the fixture's role assumptions so a role change fails loudly, not silently.
    cy.loginAs('staff').then((token) => {
      cy.request({ url: wp('induction/v1/me'), headers: { Authorization: `Bearer ${token}` } })
        .its('body.roles').should((roles: string[]) => {
          expect(roles, `fixture staff must be in "${IN_ROLE}"`).to.include(IN_ROLE);
          expect(roles, `fixture staff must not be in "${OUT_ROLE}"`).to.not.include(OUT_ROLE);
        });
    });

    cy.api('POST', 'induction/v1/modules', {
      title: inTitle,
      status: 'publish',
      meta: { module_order: 0, module_blocks: publishedSection() },
    }).then(({ body }) => {
      inRoleModule = body.id;
      cy.api('POST', 'induction/v1/assignments/role', {
        module_id: inRoleModule,
        role: IN_ROLE,
        due_date: null,
      });
    });

    cy.api('POST', 'induction/v1/modules', {
      title: outTitle,
      status: 'publish',
      meta: { module_order: 0, module_blocks: publishedSection() },
    }).then(({ body }) => {
      outRoleModule = body.id;
      cy.api('POST', 'induction/v1/assignments/role', {
        module_id: outRoleModule,
        role: OUT_ROLE,
        due_date: null,
      });
    });
  });

  after(() => {
    if (inRoleModule) cy.api('DELETE', `induction/v1/modules/${inRoleModule}`);
    if (outRoleModule) cy.api('DELETE', `induction/v1/modules/${outRoleModule}`);
  });

  it('shows a module targeted at the staff role, but not one targeted elsewhere', () => {
    cy.visitAs('staff', '/#/portal');
    cy.contains('Welcome Back').should('be.visible'); // dashboard has loaded
    cy.contains(inTitle).should('be.visible');
    cy.contains(outTitle).should('not.exist');
  });

  it('reflects the same split in the assignments the API returns', () => {
    cy.api('GET', `induction/v1/assignments/user/${staffId}`).then(({ body }) => {
      const ids = (body as { id: number }[]).map((m) => m.id);
      expect(ids).to.include(inRoleModule);
      expect(ids).to.not.include(outRoleModule);
    });
  });
});
