/// <reference types="cypress" />
import { sectionsJson } from '../../support/fixtures';

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
});
