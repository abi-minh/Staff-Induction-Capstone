/// <reference types="cypress" />
import { testEnv } from '../../support/testEnv';

function sections(html: string) {
  return JSON.stringify([{
    id: 'section-v',
    heroImage: '',
    title: 'Versioned',
    description: '',
    blocks: [{ id: 'block-1', type: 'text', data: { html } }],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
  }]);
}

describe('Module content history', () => {
  let moduleId: number;

  before(() => {
    cy.api('POST', 'induction/v1/modules', {
      title: `Versioning ${Date.now()}`,
      status: 'draft',
      meta: { module_blocks: sections('<p>first</p>') },
    }).then(({ body }) => { moduleId = body.id; });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  it('records a version when the sections change', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: sections('<p>second</p>') },
    }).its('status').should('eq', 200);

    cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.length).to.be.greaterThan(1);
      // Newest first, and exactly one entry matches what is stored now.
      expect(body[0].version).to.be.greaterThan(body[1].version);
      expect(body.filter((v: { is_current: boolean }) => v.is_current)).to.have.length(1);
    });
  });

  // Without this, history fills with duplicates from icon and title edits and
  // the entries an author actually wants scroll out of retention.
  it('records nothing when the sections are unchanged', () => {
    cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body }) => {
      const before = body.length;

      cy.api('POST', `induction/v1/modules/${moduleId}`, {
        meta: { module_blocks: sections('<p>second</p>') },
      });

      cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body: after }) => {
        expect(after.length).to.eq(before);
      });
    });
  });

  it('returns the stored content for a single version', () => {
    cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body }) => {
      const oldest = body[body.length - 1];
      cy.api('GET', `induction/v1/modules/${moduleId}/versions/${oldest.version}`)
        .then(({ status, body: single }) => {
          expect(status).to.eq(200);
          expect(single.blocks).to.contain('first');
        });
    });
  });

  // Restore must write forward, never rewind: using history cannot destroy it.
  it('restores by appending a new version rather than deleting later ones', () => {
    cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body }) => {
      const countBefore = body.length;
      const oldest = body[body.length - 1];

      cy.api('POST', `induction/v1/modules/${moduleId}/versions/${oldest.version}/restore`)
        .its('status').should('eq', 200);

      cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body: mod }) => {
        expect(mod.meta.module_blocks).to.contain('first');
      });

      cy.api('GET', `induction/v1/modules/${moduleId}/versions`).then(({ body: after }) => {
        expect(after.length, 'a version was added, not removed').to.eq(countBefore + 1);
      });
    });
  });

  it('404s an unknown version instead of restoring something arbitrary', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}/versions/99999/restore`)
      .its('status').should('eq', 404);
  });

  it('refuses history to a staff token', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        url: `${testEnv().wpUrl}/wp-json/induction/v1/modules/${moduleId}/versions`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);
    });
  });
});
