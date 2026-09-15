/// <reference types="cypress" />
import { wp } from '../../support/testEnv';

// Every uploaded file is filed under a category from a managed list. The list
// is the contract these specs hold: the built-in bucket cannot be deleted, a
// category in use cannot be deleted, and a file's category and its document
// record's category are never allowed to disagree.

const DEFAULT_CATEGORY = 'module-resources';

interface Category {
  value: string;
  label: string;
  count: number;
  protected: boolean;
}

describe('Resource categories', () => {
  const created: string[] = [];

  after(() => {
    created.forEach((slug) => {
      cy.api('DELETE', `induction/v1/resource-categories/${slug}`);
    });
  });

  it('always offers the built-in bucket', () => {
    cy.api('GET', 'induction/v1/resource-categories').then(({ status, body }) => {
      expect(status).to.eq(200);
      const built = body.find((c: Category) => c.value === DEFAULT_CATEGORY);
      expect(built, 'Module Resources is always present').to.exist;
      expect(built.label).to.eq('Module Resources');
      expect(built.protected).to.eq(true);
    });
  });

  it('refuses to delete the built-in bucket', () => {
    cy.api('DELETE', `induction/v1/resource-categories/${DEFAULT_CATEGORY}`)
      .then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('protected_category');
      });
  });

  it('creates, renames and deletes a category', () => {
    const name = `Cypress Safety ${Date.now()}`;

    cy.api('POST', 'induction/v1/resource-categories', { name }).then(({ status, body }) => {
      expect(status).to.be.oneOf([200, 201]);
      expect(body.label).to.eq(name);
      // Slugged from the whole name, so a two-word category keeps its words.
      expect(body.value).to.contain('cypress-safety');
      expect(body.count).to.eq(0);
      expect(body.protected).to.eq(false);

      const slug = body.value;
      created.push(slug);

      cy.api('POST', `induction/v1/resource-categories/${slug}`, { name: 'Cypress Renamed' })
        .then(({ body: renamed }) => {
          // The slug is what every file stores, so a rename must not move it.
          expect(renamed.value).to.eq(slug);
          expect(renamed.label).to.eq('Cypress Renamed');
        });

      cy.api('DELETE', `induction/v1/resource-categories/${slug}`).then(({ status: s }) => {
        expect(s).to.eq(200);
        created.splice(created.indexOf(slug), 1);
      });

      cy.api('GET', 'induction/v1/resource-categories').then(({ body: list }) => {
        expect(list.map((c: Category) => c.value)).to.not.include(slug);
      });
    });
  });

  it('rejects a blank name and a duplicate', () => {
    cy.api('POST', 'induction/v1/resource-categories', { name: '   ' })
      .then(({ status, body }) => {
        expect(status).to.eq(400);
        expect(body.code).to.eq('invalid_name');
      });

    cy.api('POST', 'induction/v1/resource-categories', { name: 'Module Resources' })
      .then(({ status, body }) => {
        expect(status).to.eq(409);
        expect(body.code).to.eq('category_exists');
      });
  });

  it('refuses a category a staff token tries to create', () => {
    cy.loginAs('staff').then((token) => {
      cy.request({
        method: 'POST',
        url: wp('induction/v1/resource-categories'),
        headers: { Authorization: `Bearer ${token}` },
        body: { name: 'Staff Should Not Manage This' },
        failOnStatusCode: false,
      }).its('status').should('be.oneOf', [401, 403]);

      // Reading is allowed, though — the portal filters on the same list.
      cy.request({
        method: 'GET',
        url: wp('induction/v1/resource-categories'),
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).its('status').should('eq', 200);
    });
  });

  describe('filing a file', () => {
    let fileId: number;
    let slug: string;

    before(() => {
      cy.api('POST', 'induction/v1/resource-categories', {
        name: `Cypress Filing ${Date.now()}`,
      }).then(({ body }) => {
        slug = body.value;
        created.push(slug);
      });

      cy.api('GET', 'induction/v1/media').then(({ body }) => {
        expect(body, 'the test site needs at least one file in the library')
          .to.have.length.greaterThan(0);
        fileId = body[0].id;
      });
    });

    it('reports a category on every file in the library', () => {
      cy.api('GET', 'induction/v1/media').then(({ body }) => {
        body.forEach((m: { id: number; category: string; categoryLabel: string }) => {
          expect(m).to.include.keys(['category', 'categoryLabel']);
        });
      });
    });

    it('moves a file between categories', () => {
      cy.api('POST', `induction/v1/media/${fileId}/category`, { category: slug })
        .then(({ status, body }) => {
          expect(status).to.eq(200);
          expect(body.category).to.eq(slug);
        });

      cy.api('GET', 'induction/v1/media').then(({ body }) => {
        const file = body.find((m: { id: number }) => m.id === fileId);
        expect(file.category).to.eq(slug);
      });

      // Now in use, so it must not be deletable.
      cy.api('DELETE', `induction/v1/resource-categories/${slug}`)
        .then(({ status, body }) => {
          expect(status).to.eq(409);
          expect(body.code).to.eq('category_in_use');
        });

      cy.api('POST', `induction/v1/media/${fileId}/category`, { category: DEFAULT_CATEGORY })
        .its('status').should('eq', 200);
    });

    it('rejects a category that does not exist', () => {
      cy.api('POST', `induction/v1/media/${fileId}/category`, { category: 'not-a-category' })
        .then(({ status, body }) => {
          expect(status).to.eq(400);
          expect(body.code).to.eq('unknown_category');
        });
    });

    it('keeps a document and its file in step', () => {
      cy.api('POST', 'wp/v2/induction_document', {
        title: `Cypress category doc ${Date.now()}`,
        status: 'publish',
        meta: {
          document_category: slug,
          document_file_id: fileId,
          document_role_targets: ['all'],
        },
      }).then(({ status, body }) => {
        expect(status).to.be.oneOf([200, 201]);

        // Writing the document's category stamps the file behind it.
        cy.api('GET', 'induction/v1/media').then(({ body: media }) => {
          const file = media.find((m: { id: number }) => m.id === fileId);
          expect(file.category, 'the file followed its document').to.eq(slug);
        });

        // And moving the file carries the document back the other way.
        cy.api('POST', `induction/v1/media/${fileId}/category`, { category: DEFAULT_CATEGORY })
          .its('status').should('eq', 200);

        cy.api('GET', `wp/v2/induction_document/${body.id}?context=edit`).then(({ body: doc }) => {
          expect(doc.meta.document_category, 'the document followed its file')
            .to.eq(DEFAULT_CATEGORY);
        });

        cy.api('DELETE', `wp/v2/induction_document/${body.id}?force=true`);
      });
    });
  });
});
