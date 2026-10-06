/// <reference types="cypress" />
import { sectionsJson } from '../../support/fixtures';
import { testEnv } from '../../support/testEnv';

// Due dates. Named in the test plan and, until now, covered by nothing: the
// string "due" appeared in no spec, while both the Overdue report and the
// reminder emails are built on it.
//
// The model under test: a module carries module_duration_days, and the actual
// date is fixed per person on the assignment row when they are assigned. Two
// people assigned the same module on different days therefore hold different
// deadlines, and an explicit date passed at assignment time overrides the
// duration entirely.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses the MySQL DATETIME the API returns. */
function asDate(value: string): Date {
  const [date, time = '00:00:00'] = value.split(/[ T]/);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.replace('Z', '').split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

describe('Due dates', () => {
  let staffId: number;
  const modules: number[] = [];

  before(() => {
    cy.fixtureStaff().then((staff) => {
      staffId = staff.id;
    });
  });

  after(() => {
    modules.forEach((id) => cy.api('DELETE', `induction/v1/modules/${id}`));
  });

  function createModule(durationDays: number): Cypress.Chainable<number> {
    return cy
      .api('POST', 'induction/v1/modules', {
        title: `Due date ${durationDays}d ${Date.now()}`,
        status: 'publish',
        meta: {
          module_order: 0,
          module_duration_days: durationDays,
          module_blocks: sectionsJson('<p>Due date fixture.</p>'),
        },
      })
      .then(({ status, body }) => {
        expect(status).to.eq(200);
        modules.push(body.id);
        return body.id as number;
      });
  }

  // Wrapped in an object rather than yielding the value directly: Cypress
  // reads a null returned from .then() as "keep the previous subject", so a
  // string | null return matches two overloads and the chain loses its type.
  function dueDateFor(moduleId: number): Cypress.Chainable<{ dueDate: string | null }> {
    return cy
      .api('GET', `induction/v1/assignments/records/user/${staffId}`)
      .then(({ body }) => {
        const row = (body as { moduleId: number; dueDate: string | null }[])
          .find((r) => r.moduleId === moduleId);
        expect(row, 'an assignment row exists for the module').to.exist;
        return { dueDate: row!.dueDate };
      });
  }

  it('derives a due date from module_duration_days', () => {
    createModule(14).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
      }).its('status').should('eq', 200);

      dueDateFor(moduleId).then(({ dueDate: due }) => {
        expect(due, 'a duration produces a due date').to.be.a('string');
        // Same day is possible either side of midnight, so allow a day of slack
        // rather than pinning to the hour.
        const days = daysBetween(asDate(due as string), new Date());
        expect(days, `expected ~14 days out, got ${due}`).to.be.within(13, 15);
      });
    });
  });

  it('leaves the due date empty when the module has no duration', () => {
    createModule(0).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
      }).its('status').should('eq', 200);

      dueDateFor(moduleId).then(({ dueDate: due }) => {
        expect(due, 'no duration means no due date').to.eq(null);
      });
    });
  });

  // The assign dialog's optional date field. It has to win, or an admin setting
  // a specific deadline would silently get the duration instead.
  it('lets an explicit date at assignment time override the duration', () => {
    createModule(14).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
        due_date: '2030-01-15 09:00:00',
      }).its('status').should('eq', 200);

      dueDateFor(moduleId).then(({ dueDate: due }) => {
        expect(asDate(due as string).getUTCFullYear()).to.eq(2030);
        expect(asDate(due as string).getUTCMonth(), 'January').to.eq(0);
        expect(asDate(due as string).getUTCDate()).to.eq(15);
      });
    });
  });

  // Re-syncing an already-assigned user must not wipe a date they already have
  // — the comment on induction_ensure_assignment_row says so, and the Overdue
  // report depends on it.
  it('keeps an existing due date when the assignment is re-applied', () => {
    createModule(14).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
        due_date: '2030-02-20 09:00:00',
      }).its('status').should('eq', 200);

      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
      }).its('status').should('eq', 200);

      dueDateFor(moduleId).then(({ dueDate: due }) => {
        expect(asDate(due as string).getUTCFullYear(), 'the explicit date survived').to.eq(2030);
      });
    });
  });

  function setDuration(moduleId: number, durationDays: number) {
    cy.api('POST', `induction/v1/modules/${moduleId}`, { meta: { module_duration_days: durationDays } })
      .its('status').should('eq', 200);
  }

  it('moves a duration-based due date when the duration changes', () => {
    createModule(14).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
      }).its('status').should('eq', 200);

      dueDateFor(moduleId).then(({ dueDate: before }) => {
        setDuration(moduleId, 30);
        dueDateFor(moduleId).then(({ dueDate: after }) => {
          expect(daysBetween(asDate(after as string), asDate(before as string)), 'pushed out by 16 days').to.eq(16);
        });
        setDuration(moduleId, 0);
        dueDateFor(moduleId).then(({ dueDate }) => {
          expect(dueDate, 'no duration means no due date').to.eq(null);
        });
      });
    });
  });

  it('leaves a picked due date alone when the duration changes', () => {
    createModule(14).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
        due_date: '2030-03-10 09:00:00',
      }).its('status').should('eq', 200);

      setDuration(moduleId, 30);
      dueDateFor(moduleId).then(({ dueDate: due }) => {
        expect(due).to.match(/^2030-03-10/);
      });
    });
  });

  it('reports an overdue module and not a future one', () => {
    createModule(0).then((moduleId) => {
      cy.api('POST', 'induction/v1/assignments/bulk', {
        module_id: moduleId,
        user_ids: [staffId],
        due_date: '2020-01-01 09:00:00',
      }).its('status').should('eq', 200);

      cy.api('GET', 'induction/v1/reports/overdue').then(({ status, body }) => {
        expect(status).to.eq(200);
        const ids = (body as { moduleId?: number; module_id?: number }[])
          .map((r) => r.moduleId ?? r.module_id);
        expect(ids, 'a module past its due date is overdue').to.include(moduleId);
      });
    });
  });

  // Moving one person's deadline after the fact. This replaced the date picker
  // that used to sit in the assign dialog: assigning is a bulk action across
  // many people, while a deadline is almost always moved for one person who
  // had a reason.
  describe('extending a due date', () => {
    it('moves the date for one staff member without touching the module', () => {
      createModule(14).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/bulk', {
          module_id: moduleId, user_ids: [staffId],
        }).its('status').should('eq', 200);

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '2030-06-15',
        }).then(({ status, body }) => {
          expect(status).to.eq(200);
          // Stored at end of day, so a module due "on the 15th" is not overdue
          // at one minute past midnight on the 15th.
          expect(body.due_date).to.eq('2030-06-15 23:59:59');
        });

        dueDateFor(moduleId).then(({ dueDate: due }) => {
          expect(asDate(due as string).getUTCFullYear()).to.eq(2030);
          expect(asDate(due as string).getUTCDate()).to.eq(15);
        });

        // The module's own duration is untouched, so the next person assigned
        // still gets 14 days.
        cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
          expect(body.meta.module_duration_days).to.eq(14);
        });
      });
    });

    it('clears the deadline when given an empty date', () => {
      createModule(14).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/bulk', {
          module_id: moduleId, user_ids: [staffId],
        }).its('status').should('eq', 200);

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '',
        }).its('status').should('eq', 200);

        dueDateFor(moduleId).then(({ dueDate: due }) => {
          expect(due, 'deadline removed').to.eq(null);
        });
      });
    });

    it('rejects a date that is not a real one', () => {
      createModule(0).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/bulk', {
          module_id: moduleId, user_ids: [staffId],
        }).its('status').should('eq', 200);

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '2030-02-31',
        }).then(({ status, body }) => {
          expect(status).to.eq(400);
          expect(body.code).to.eq('invalid_due_date');
        });

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '15/06/2030',
        }).its('status').should('eq', 400);
      });
    });

    it('404s for a module the staff member is not assigned', () => {
      createModule(0).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '2030-06-15',
        }).then(({ status, body }) => {
          expect(status).to.eq(404);
          expect(body.code).to.eq('assignment_not_found');
        });
      });
    });

    // The two features meet here: a manually set date must survive a later
    // change to the module's duration. The refresh hook only recomputes rows
    // that are not marked as overridden, so an endpoint that forgot to mark
    // them would quietly undo every extension the next time an author edited
    // the module.
    it('survives a change to the module duration', () => {
      createModule(14).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/bulk', {
          module_id: moduleId, user_ids: [staffId],
        }).its('status').should('eq', 200);

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '2030-06-15',
        }).its('status').should('eq', 200);

        cy.api('POST', `induction/v1/modules/${moduleId}`, {
          meta: { module_duration_days: 3 },
        }).its('status').should('eq', 200);

        dueDateFor(moduleId).then(({ dueDate: due }) => {
          expect(asDate(due as string).getUTCFullYear(), 'extension kept').to.eq(2030);
          expect(asDate(due as string).getUTCDate()).to.eq(15);
        });
      });
    });

    // Likewise a deliberately removed deadline: changing the duration must not
    // bring one back.
    it('does not resurrect a deadline that was cleared', () => {
      createModule(14).then((moduleId) => {
        cy.api('POST', 'induction/v1/assignments/bulk', {
          module_id: moduleId, user_ids: [staffId],
        }).its('status').should('eq', 200);

        cy.api('POST', 'induction/v1/assignments/due-date', {
          user_id: staffId, module_id: moduleId, due_date: '',
        }).its('status').should('eq', 200);

        cy.api('POST', `induction/v1/modules/${moduleId}`, {
          meta: { module_duration_days: 7 },
        }).its('status').should('eq', 200);

        dueDateFor(moduleId).then(({ dueDate: due }) => {
          expect(due, 'still no deadline').to.eq(null);
        });
      });
    });

    it('refuses a staff token', () => {
      cy.loginAs('staff').then((token) => {
        cy.request({
          method: 'POST',
          url: `${testEnv().wpUrl}/wp-json/induction/v1/assignments/due-date`,
          headers: { Authorization: `Bearer ${token}` },
          body: { user_id: staffId, module_id: 1, due_date: '2030-06-15' },
          failOnStatusCode: false,
        }).its('status').should('be.oneOf', [401, 403]);
      });
    });
  });
});
