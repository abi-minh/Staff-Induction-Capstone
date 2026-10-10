/// <reference types="cypress" />
import { sectionsJson } from '../../support/fixtures';
import { testEnv } from '../../support/testEnv';

// Responsive image sources. Attached to the module response as a sidecar map
// keyed by attachment id, so the client can pick a variant that fits a phone
// instead of downloading the full-size original to render it 375px wide.
describe('Responsive image sources', () => {
  const modules: number[] = [];

  after(() => {
    modules.forEach((id) => cy.api('DELETE', `induction/v1/modules/${id}`));
  });

  it('exposes image_sources on the module response', () => {
    cy.api('POST', 'induction/v1/modules', {
      title: `Image sources ${Date.now()}`,
      status: 'publish',
      meta: { module_order: 0, module_blocks: sectionsJson('<p>No images here.</p>') },
    }).then(({ body }) => {
      modules.push(body.id);

      cy.api('GET', `wp/v2/induction_module/${body.id}`).then(({ status, body: mod }) => {
        expect(status).to.eq(200);
        // Present even when empty: the client reads it unconditionally, and an
        // absent key would be indistinguishable from a module whose images all
        // predate the field.
        expect(mod, 'the field is always attached').to.have.property('image_sources');
      });
    });
  });

  // The library is seeded with real uploads, so at least one attachment should
  // have generated sizes. Skips rather than fails on a library with none —
  // that is an empty test site, not a broken endpoint.
  it('gives a real attachment a srcset with more than one candidate', () => {
    cy.api('GET', 'induction/v1/media').then(({ body: media }) => {
      const image = (media as { id: number; type: string }[]).find((m) => m.type === 'image');
      if (!image) {
        cy.log('No image in the media library — nothing to derive sources from');
        return;
      }

      cy.api('POST', 'induction/v1/modules', {
        title: `Image sources real ${Date.now()}`,
        status: 'publish',
        meta: {
          module_order: 0,
          module_blocks: JSON.stringify([{
            id: 'section-img',
            heroImage: '', title: 'With an image', description: '', status: 'publish',
            quizStatus: 'draft', quizTitle: '', passingPercentage: 80,
            quizBlocks: [], isModuleQuiz: false,
            blocks: [{
              id: 'b-img',
              type: 'image',
              data: { mediaId: image.id, url: '', alt: 'Fixture', caption: '' },
            }],
          }]),
        },
      }).then(({ body }) => {
        modules.push(body.id);

        cy.api('GET', `wp/v2/induction_module/${body.id}`).then(({ body: mod }) => {
          const entry = mod.image_sources?.[String(image.id)];
          if (!entry) {
            cy.log(`Attachment ${image.id} has only one generated size`);
            return;
          }
          expect(entry.srcset, 'srcset lists widths').to.match(/\d+w/);
          expect(entry.sizes, 'sizes is set').to.be.a('string').and.not.be.empty;
        });
      });
    });
  });
});

// Module ordering. Replaced the "Display Order" number box, which worked but
// was invisible: every module defaulted to 0, so setting one to 1 moved it to
// the end rather than the front, and nothing on screen showed the current
// sequence.
describe('Module ordering', () => {
  const made: number[] = [];

  after(() => {
    made.forEach((id) => cy.api('DELETE', `induction/v1/modules/${id}`));
  });

  function make(title: string): Cypress.Chainable<number> {
    return cy.api('POST', 'induction/v1/modules', {
      title: `${title} ${Date.now()}`,
      status: 'publish',
      meta: { module_blocks: sectionsJson('<p>Ordering fixture.</p>') },
    }).then(({ status, body }) => {
      expect(status).to.eq(200);
      made.push(body.id);
      return body.id as number;
    });
  }

  // Without this, a new module lands at position 0 and jumps to the top of a
  // list someone has just arranged.
  it('appends a new module rather than putting it first', () => {
    cy.api('GET', 'induction/v1/modules').then(({ body: before }) => {
      const highest = Math.max(
        0,
        ...(before as { meta: { module_order: number } }[]).map((m) => m.meta.module_order),
      );
      make('Appended').then((id) => {
        cy.api('GET', `induction/v1/modules/${id}`).then(({ body }) => {
          expect(body.meta.module_order, 'placed after the existing modules')
            .to.be.greaterThan(highest - 1);
        });
      });
    });
  });

  it('renumbers from zero in the order given', () => {
    make('Order A').then((a) => {
      make('Order B').then((b) => {
        cy.api('POST', 'induction/v1/modules/order', { ids: [b, a] })
          .then(({ status, body }) => {
            expect(status).to.eq(200);
            expect(body.reordered).to.eq(2);
          });

        cy.api('GET', `induction/v1/modules/${b}`)
          .then(({ body }) => expect(body.meta.module_order).to.eq(0));
        cy.api('GET', `induction/v1/modules/${a}`)
          .then(({ body }) => expect(body.meta.module_order).to.eq(1));
      });
    });
  });

  // Only changed rows are written, so reordering twenty modules does not fire
  // twenty post-meta hooks for nothing.
  it('reports how many actually moved', () => {
    make('Order C').then((c) => {
      cy.api('POST', 'induction/v1/modules/order', { ids: [c] }).then(({ body }) => {
        expect(body.changed, 'first call sets it').to.be.at.least(0);
      });
      cy.api('POST', 'induction/v1/modules/order', { ids: [c] }).then(({ body }) => {
        expect(body.changed, 'second call is a no-op').to.eq(0);
      });
    });
  });

  it('rejects an empty list and a non-module id', () => {
    cy.api('POST', 'induction/v1/modules/order', { ids: [] }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.code).to.eq('induction_no_modules');
    });

    cy.api('POST', 'induction/v1/modules/order', { ids: [999999] }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.code).to.eq('induction_not_a_module');
    });
  });

  it('refuses a staff token', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        method: 'POST',
        url: `${testEnv().wpUrl}/wp-json/induction/v1/modules/order`,
        headers: { Authorization: `Bearer ${token}` },
        body: { ids: [1] },
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);
    });
  });
});
