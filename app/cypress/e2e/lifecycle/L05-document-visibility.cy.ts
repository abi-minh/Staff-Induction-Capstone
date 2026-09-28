/// <reference types="cypress" />
import { wp } from '../../support/testEnv';

// L5: a document reaches staff whose role it targets and no one else.
// No attachment is needed to prove visibility — just a title and a role target.

const IN_ROLE = 'staff';            // the fixture staff member has this
const OUT_ROLE = 'induction_admin'; // and deliberately does not

describe('L5 · document visibility by role', () => {
  let inDoc: number;
  let outDoc: number;
  const inTitle = `L5 in-role doc ${Date.now()}`;
  const outTitle = `L5 out-of-role doc ${Date.now()}`;

  function createDoc(title: string, role: string) {
    return cy.api('POST', 'wp/v2/induction_document', {
      title,
      status: 'publish',
      meta: { document_category: '', document_file_id: 0, document_role_targets: [role] },
    });
  }

  before(() => {
    cy.loginAs('staff').then((token) => {
      cy.request({ url: wp('induction/v1/me'), headers: { Authorization: `Bearer ${token}` } })
        .its('body.roles').should((roles: string[]) => {
          expect(roles, `fixture staff must be in "${IN_ROLE}"`).to.include(IN_ROLE);
          expect(roles, `fixture staff must not be in "${OUT_ROLE}"`).to.not.include(OUT_ROLE);
        });
    });

    createDoc(inTitle, IN_ROLE).then(({ body }) => { inDoc = body.id; });
    createDoc(outTitle, OUT_ROLE).then(({ body }) => { outDoc = body.id; });
  });

  after(() => {
    if (inDoc) cy.api('DELETE', `wp/v2/induction_document/${inDoc}`, undefined, { qs: { force: true } });
    if (outDoc) cy.api('DELETE', `wp/v2/induction_document/${outDoc}`, undefined, { qs: { force: true } });
  });

  it('shows a document targeted at the staff role, but not one targeted elsewhere', () => {
    cy.visitAs('staff', '/#/portal/library');
    cy.contains('Resources').should('be.visible');
    cy.contains(inTitle).should('be.visible');
    cy.contains(outTitle).should('not.exist');
  });

  it('reflects the same split in the documents the staff API returns', () => {
    cy.loginAs('staff').then((token) => {
      // Scope to our two docs by id so the count of other published docs can't
      // push either off the returned page. The role filter still strips the out doc.
      cy.request({
        url: wp('wp/v2/induction_document'),
        qs: { include: `${inDoc},${outDoc}`, status: 'publish' },
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ body }) => {
        const ids = (body as { id: number }[]).map((d) => d.id);
        expect(ids).to.include(inDoc);
        expect(ids).to.not.include(outDoc);
      });
    });
  });
});
