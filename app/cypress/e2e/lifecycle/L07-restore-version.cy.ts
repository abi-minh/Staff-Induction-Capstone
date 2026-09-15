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

  // The module page is a section index, not the section body: each section is a
  // card with an Attempt Now button that opens it in place (no route change).
  // A section already worked through offers Review instead, so match either.
  function openFirstSection() {
    cy.contains('button', /Attempt Now|Review/).click();
  }

  it('shows the staff member the replacement first', () => {
    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    openFirstSection();
    cy.contains(REPLACEMENT).should('be.visible');
    cy.contains(ORIGINAL).should('not.exist');
  });

  it('lists both versions in the History dialog', () => {
    cy.visitAs('admin', `/#/modules/${moduleId}`);
    cy.contains('button', 'History').click();

    // Scoped by its title, not by [role="dialog"] alone: ModuleHistoryDialog
    // renders two Dialogs — the history list and its restore confirmation — so
    // a bare role selector matches more than one element and within() refuses.
    cy.contains('[role="dialog"]', 'Content history').within(() => {
      cy.contains('v1').should('exist');
      cy.contains('v2').should('exist');
      cy.contains('current').should('exist');
    });
  });

  it('restores v1 and reports it as a new version, not a rewind', () => {
    cy.visitAs('admin', `/#/modules/${moduleId}`);
    cy.contains('button', 'History').click();

    cy.contains('[role="dialog"]', 'Content history').within(() => {
      cy.contains('tr', 'v1').within(() => cy.contains('button', 'Restore').click());
    });

    // The confirm dialog spells out what is being replaced. Scoped too: by now
    // both dialogs are open and each carries a Restore button.
    cy.intercept('POST', '**/versions/*/restore').as('restore');
    cy.contains('[role="dialog"]', 'Restore v1?')
      .should('be.visible')
      .within(() => cy.contains('button', 'Restore').click());

    // Wait for the write, or the reads below race it.
    cy.wait('@restore').its('response.statusCode').should('eq', 200);

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
    openFirstSection();
    cy.contains(ORIGINAL).should('be.visible');
    cy.contains(REPLACEMENT).should('not.exist');
  });
});
