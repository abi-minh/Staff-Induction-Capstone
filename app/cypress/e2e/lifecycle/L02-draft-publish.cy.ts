/// <reference types="cypress" />
import { wp } from '../../support/testEnv';
import { textSection } from '../../support/fixtures';

// L2: staff see only published sections; admins see both; publishing a draft reveals it.

const PUBLISHED = 'This part is visible to staff';
const DRAFT     = 'This part is hidden until it is published';

function twoSections(draftStatus: 'draft' | 'publish'): string {
  return JSON.stringify([
    textSection(`<p>${PUBLISHED}</p>`, {
      id: 'section-published',
      title: 'Published section',
      status: 'publish',
    }),
    textSection(`<p>${DRAFT}</p>`, {
      id: 'section-draft',
      title: 'Draft section',
      status: draftStatus,
    }),
  ]);
}

describe('L2 · draft and published sections', () => {
  let moduleId: number;
  let staffId: number;

  before(() => {
    cy.fixtureStaff().then((staff) => { staffId = staff.id; });

    cy.api('POST', 'induction/v1/modules', {
      title: `L2 draft gating ${Date.now()}`,
      status: 'publish',
      meta: { module_order: 0, module_blocks: twoSections('draft') },
    }).then(({ body }) => {
      moduleId = body.id;
      // Assign via the API — this spec is about the draft gate, not the assign dialog (L4).
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
        due_date: null,
      });
    });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  it('shows the staff member the published section but not the draft', () => {
    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains('Published section').should('be.visible');
    cy.contains('Draft section').should('not.exist');
    cy.contains(DRAFT).should('not.exist');
  });

  it('strips the draft at the API for staff but keeps it for an admin', () => {
    // The gate is server-side, so it must hold at the API, not just in the UI.
    cy.loginAs('staff').then((token) => {
      cy.request({
        url: wp(`wp/v2/induction_module/${moduleId}`),
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ body }) => {
        const titles = JSON.parse(body.meta.module_blocks).map((s: { title: string }) => s.title);
        expect(titles).to.include('Published section');
        expect(titles).to.not.include('Draft section');
      });
    });

    // Admin sees both — the draft is hidden, not deleted.
    cy.api('GET', `wp/v2/induction_module/${moduleId}?context=edit`).then(({ body }) => {
      const titles = JSON.parse(body.meta.module_blocks).map((s: { title: string }) => s.title);
      expect(titles).to.include('Published section');
      expect(titles).to.include('Draft section');
    });
  });

  it('reveals the section to staff once it is published', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: twoSections('publish') },
    }).its('status').should('eq', 200);

    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains('Published section').should('be.visible');
    cy.contains('Draft section').should('be.visible');
  });
});
