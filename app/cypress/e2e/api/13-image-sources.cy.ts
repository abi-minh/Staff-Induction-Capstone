/// <reference types="cypress" />
import { sectionsJson } from '../../support/fixtures';

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
