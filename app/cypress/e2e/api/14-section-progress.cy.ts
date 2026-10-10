/// <reference types="cypress" />
import { sectionsJson } from '../../support/fixtures';
import { wp } from '../../support/testEnv';

// Section completion. This used to live in each browser's localStorage, which
// meant it was lost on a new device, shared between two people on one device,
// and invisible to reporting — an admin saw "not started" for someone who had
// read four sections of five. It now sits on the progress row, which is what
// this spec is here to hold in place.

interface ProgressRow {
  module_id?: number;
  moduleId?: number;
  user_id?: number;
  userId?: number;
  status: string;
  completed_sections?: string[];
  completedSections?: string[];
}

describe('Section progress', () => {
  let staffId: number;
  let adminId: number;
  const modules: number[] = [];

  before(() => {
    cy.fixtureStaff().then((staff) => {
      staffId = staff.id;
    });
    cy.api('GET', 'induction/v1/me').then(({ body }) => {
      adminId = body.id as number;
    });
  });

  after(() => {
    modules.forEach((id) => cy.api('DELETE', `induction/v1/modules/${id}`));
  });

  function createModule(): Cypress.Chainable<number> {
    return cy
      .api('POST', 'induction/v1/modules', {
        title: `Section progress ${Date.now()}`,
        status: 'publish',
        meta: {
          module_order: 0,
          module_blocks: sectionsJson('<p>Section progress fixture.</p>'),
        },
      })
      .then(({ status, body }) => {
        expect(status).to.eq(200);
        modules.push(body.id);
        return body.id as number;
      });
  }

  function setSections(moduleId: number, sectionIds: string[], userId?: number) {
    return cy.api('POST', 'induction/v1/progress/sections', {
      user_id: userId ?? staffId,
      module_id: moduleId,
      section_ids: sectionIds,
    });
  }

  /** The row as the staff member's own portal would read it. */
  function progressFor(moduleId: number): Cypress.Chainable<ProgressRow> {
    return cy
      .api('GET', `induction/v1/progress/user/${staffId}`)
      .then(({ status, body }) => {
        expect(status).to.eq(200);
        const row = (body as ProgressRow[]).find(
          (r) => (r.moduleId ?? r.module_id) === moduleId,
        );
        expect(row, 'a progress row exists for the module').to.exist;
        return row as ProgressRow;
      });
  }

  function sectionsOf(row: ProgressRow): string[] {
    return row.completedSections ?? row.completed_sections ?? [];
  }

  it('records sections and reads them back', () => {
    createModule().then((moduleId) => {
      setSections(moduleId, ['s1', 's2']).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(sectionsOf(body)).to.deep.eq(['s1', 's2']);
      });

      progressFor(moduleId).then((row) => {
        expect(sectionsOf(row), 'persisted, not just echoed').to.deep.eq(['s1', 's2']);
      });
    });
  });

  // The client sends the whole set rather than one id, so that unticking a
  // section needs no second endpoint and a dropped response cannot leave the
  // two out of step. A handler that appended would make an unmark impossible.
  it('replaces the set rather than appending to it', () => {
    createModule().then((moduleId) => {
      setSections(moduleId, ['s1', 's2', 's3']);
      setSections(moduleId, ['s1', 's3']).then(({ body }) => {
        expect(sectionsOf(body)).to.deep.eq(['s1', 's3']);
      });

      setSections(moduleId, []).then(({ body }) => {
        expect(sectionsOf(body), 'everything can be unmarked').to.deep.eq([]);
      });
    });
  });

  it('drops duplicates and empty ids', () => {
    createModule().then((moduleId) => {
      setSections(moduleId, ['s1', 's1', '', 's2']).then(({ body }) => {
        expect(sectionsOf(body)).to.deep.eq(['s1', 's2']);
      });
    });
  });

  // Opening a module and working through it is the start of progress, so the
  // row is created here rather than waiting for the separate /progress call.
  it('creates the progress row when there is not one yet', () => {
    createModule().then((moduleId) => {
      setSections(moduleId, ['s1']).then(({ status, body }) => {
        expect(status).to.eq(200);
        expect(body.status).to.eq('in_progress');
      });
    });
  });

  it('promotes a not_started row to in_progress', () => {
    createModule().then((moduleId) => {
      cy.api('POST', 'induction/v1/progress', {
        user_id: staffId,
        module_id: moduleId,
        status: 'not_started',
      }).its('status').should('eq', 200);

      setSections(moduleId, ['s1']).then(({ body }) => {
        expect(body.status).to.eq('in_progress');
      });
    });
  });

  // Re-reading a module you have already finished must not reopen it: the
  // dashboard, the reports and the staff member's own "Completed" line all
  // key off this status.
  it('leaves a completed module completed', () => {
    createModule().then((moduleId) => {
      cy.api('POST', 'induction/v1/progress', {
        user_id: staffId,
        module_id: moduleId,
        status: 'completed',
      }).its('status').should('eq', 200);

      setSections(moduleId, ['s1', 's2']).then(({ body }) => {
        expect(body.status, 'still completed').to.eq('completed');
        expect(sectionsOf(body), 'sections still recorded').to.deep.eq(['s1', 's2']);
      });
    });
  });

  describe('permissions', () => {
    function asStaff(body: Record<string, unknown>) {
      return cy.loginAs('staff').then((token) =>
        cy.request({
          method: 'POST',
          url: wp('induction/v1/progress/sections'),
          headers: { Authorization: `Bearer ${token}` },
          body,
          failOnStatusCode: false,
        }),
      );
    }

    it('lets a staff member record their own sections', () => {
      createModule().then((moduleId) => {
        asStaff({ user_id: staffId, module_id: moduleId, section_ids: ['own-1'] })
          .then(({ status, body }) => {
            expect(status).to.eq(200);
            expect(sectionsOf(body)).to.deep.eq(['own-1']);
          });
      });
    });

    it('refuses one staff member writing to another account', () => {
      createModule().then((moduleId) => {
        asStaff({ user_id: adminId, module_id: moduleId, section_ids: ['nope'] })
          .then(({ status, body }) => {
            expect(status).to.eq(403);
            expect(body.code).to.eq('rest_forbidden');
          });
      });
    });

    it('refuses an unauthenticated request', () => {
      createModule().then((moduleId) => {
        cy.request({
          method: 'POST',
          url: wp('induction/v1/progress/sections'),
          body: { user_id: staffId, module_id: moduleId, section_ids: ['x'] },
          failOnStatusCode: false,
        }).its('status').should('be.oneOf', [401, 403]);
      });
    });
  });

  // Reporting is the reason this moved server-side at all: an admin looking at
  // a module has to be able to see how far through it someone is.
  it('is visible to an admin reading the module', () => {
    createModule().then((moduleId) => {
      setSections(moduleId, ['s1', 's2']);

      cy.api('GET', `induction/v1/progress/module/${moduleId}`).then(({ status, body }) => {
        expect(status).to.eq(200);
        const row = (body as ProgressRow[]).find(
          (r) => (r.userId ?? r.user_id) === staffId,
        );
        expect(row, 'the fixture staff member has a progress row').to.exist;
        expect(sectionsOf(row as ProgressRow)).to.deep.eq(['s1', 's2']);
      });
    });
  });
});
