/// <reference types="cypress" />

// L7 from the test plan: edit a published module, restore the previous version
// from the History dialog, and confirm staff see the restored content. This is
// the safety net for the content-loss class of bug, exercised through the UI
// the way an author would actually reach for it.

const ORIGINAL = 'Original content that must be recoverable';
const REPLACEMENT = 'Replacement content that overwrote it';

function sections(html: string) {
  return JSON.stringify([{
    id: 'section-l7',
    heroImage: '',
    title: 'Restorable section',
    description: '',
    status: 'publish',
    quizStatus: 'draft',
    blocks: [{ id: 'b1', type: 'text', data: { html: `<p>${html}</p>` } }],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
  }]);
}

describe('L7 · restore a previous version', () => {
  let moduleId: number;

  before(() => {
    cy.api('POST', 'induction/v1/modules', {
      title: `L7 restore ${Date.now()}`,
      status: 'publish',
      meta: { module_blocks: sections(ORIGINAL) },
    }).then(({ body }) => {
      moduleId = body.id;
      // A second save is what creates a version worth restoring.
      cy.api('POST', `induction/v1/modules/${moduleId}`, {
        meta: { module_blocks: sections(REPLACEMENT) },
      });
    });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  it('shows the staff member the replacement first', () => {
    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains(REPLACEMENT).should('be.visible');
    cy.contains(ORIGINAL).should('not.exist');
  });

  it('lists both versions in the History dialog', () => {
    cy.visitAs('admin', `/#/modules/${moduleId}`);
    cy.contains('button', 'History').click();

    cy.get('[role="dialog"]').within(() => {
      cy.contains('Content history').should('be.visible');
      cy.contains('v1').should('exist');
      cy.contains('v2').should('exist');
      cy.contains('current').should('exist');
    });
  });

  it('restores v1 and reports it as a new version, not a rewind', () => {
    cy.visitAs('admin', `/#/modules/${moduleId}`);
    cy.contains('button', 'History').click();

    cy.get('[role="dialog"]').within(() => {
      cy.contains('tr', 'v1').within(() => cy.contains('button', 'Restore').click());
    });
    // The confirm dialog spells out what is being replaced.
    cy.contains('Restore v1?').should('be.visible');
    cy.contains('button', 'Restore').click();

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      expect(body.meta.module_blocks).to.contain(ORIGINAL);
    });

    cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body }) => {
      // v3 exists: restoring appended rather than deleting v2.
      expect(body.length).to.be.at.least(3);
    });
  });

  it('serves the restored content to the staff member', () => {
    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains(ORIGINAL).should('be.visible');
    cy.contains(REPLACEMENT).should('not.exist');
  });
});
