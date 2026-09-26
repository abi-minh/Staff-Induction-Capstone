/// <reference types="cypress" />
import { wp } from '../../support/testEnv';

// L4: the full loop across two roles and the reporting aggregate.
// admin assigns -> staff completes -> staff submits quiz -> admin grades -> reports.

describe('L4 · assign, complete, grade, report', () => {
  let moduleId: number;
  let staffId: number;
  let staffName: string;
  const moduleTitle = `L4 lifecycle ${Date.now()}`;

  before(() => {
    // The fixture account, not the first staff row — this writes real training history.
    cy.fixtureStaff().then((staff) => {
      staffId = staff.id;
      staffName = staff.name;
    });

    cy.api('POST', 'induction/v1/modules', {
      title: moduleTitle,
      status: 'publish',
      meta: {
        module_order: 0,
        quiz_pass_threshold: 50,
        module_blocks: JSON.stringify([{
          id: 'section-l4',
          heroImage: '',
          title: 'Beach safety',
          description: '',
          status: 'publish',
          quizStatus: 'publish',
          blocks: [{ id: 'b1', type: 'text', data: { html: '<p>Always wear a PFD.</p>' } }],
          quizTitle: 'Check',
          passingPercentage: 50,
          isModuleQuiz: true,
          quizBlocks: [{
            id: 'q1',
            type: 'true_false',
            data: { question: 'Should you wear a PFD?', correctAnswer: true },
          }],
        }]),
      },
    }).then(({ body }) => { moduleId = body.id; });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  it('assigns the module to a staff member from the admin UI', () => {
    cy.visitAs('admin', '/#/staff');
    cy.contains('h1', 'Staff').should('be.visible');

    cy.contains('tr', staffName).within(() => {
      cy.contains('button', 'Assign').click();
    });

    // Register before Save: the assign mutation is async and the read-back races it.
    cy.intercept('POST', '**/induction/v1/assignments/bulk').as('assign');

    // Scope by title — the Staff page mounts several dialogs, so a bare
    // [role="dialog"] can match more than one and makes within() throw.
    cy.contains('[role="dialog"]', 'Assign Modules').within(() => {
      // Exact title, not the shared prefix, or an earlier run's module matches first.
      cy.get('input[placeholder*="Search"]').type(moduleTitle);
      cy.contains(moduleTitle).click();
      cy.contains('button', /save|assign/i).click();
    });

    cy.wait('@assign').its('response.statusCode').should('eq', 200);

    cy.api('GET', `induction/v1/assignments/records/user/${staffId}`).then(({ body }) => {
      const ids = body.map((a: { moduleId?: number; module_id?: number }) => a.moduleId ?? a.module_id);
      expect(ids).to.include(moduleId);
    });
  });

  it('shows the module to the staff member and records progress', () => {
    // Opening the module fires a fire-and-forget progress upsert on mount; wait on it.
    cy.intercept('POST', '**/induction/v1/progress').as('startProgress');

    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains('Beach safety').should('be.visible');
    cy.contains('button', /Attempt Now|Review/).click();
    cy.contains('Always wear a PFD').should('be.visible');
    cy.wait('@startProgress').its('response.statusCode').should('eq', 200);

    cy.api('GET', `induction/v1/progress/user/${staffId}`).then(({ body }) => {
      const row = body.find(
        (p: { moduleId?: number; module_id?: number }) => (p.moduleId ?? p.module_id) === moduleId,
      );
      expect(row, 'opening the module started progress').to.exist;
    });
  });

  it('submits the quiz for review', () => {
    cy.loginAs('staff').then((token) => {
      const headers = { Authorization: `Bearer ${token}` };

      cy.request({
        method: 'POST', url: wp('induction/v1/quiz/save'), headers,
        // answer is a string on this route, so a true/false block sends "true".
        body: { user_id: staffId, module_id: moduleId, block_id: 'q1', answer: 'true' },
      }).its('status').should('eq', 200);

      cy.request({
        method: 'POST', url: wp('induction/v1/quiz/submit-for-review'), headers,
        body: { user_id: staffId, module_id: moduleId },
      }).its('status').should('eq', 200);
    });

    cy.api('GET', 'induction/v1/quiz/pending-review').then(({ body }) => {
      const pending = body.map((r: { moduleId?: number; module_id?: number }) => r.moduleId ?? r.module_id);
      expect(pending).to.include(moduleId);
    });
  });

  it('lets an admin grade it as passed from the review UI', () => {
    cy.visitAs('admin', '/#/quiz-reviews');
    // The Review control is a RouterLink (renders as <a>), not a button.
    cy.contains('tr', moduleTitle).within(() => {
      cy.contains('a', 'Review').click();
    });

    // Pass only sets form state; nothing is saved until Save Grade.
    cy.contains('button', 'Pass').click();
    cy.intercept('POST', '**/induction/v1/quiz/grade').as('grade');
    cy.contains('button', 'Save Grade').click();
    cy.wait('@grade').its('response.statusCode').should('eq', 200);

    cy.api('GET', `induction/v1/progress/user/${staffId}`).then(({ body }) => {
      const row = body.find(
        (p: { moduleId?: number; module_id?: number }) => (p.moduleId ?? p.module_id) === moduleId,
      );
      expect(row.status).to.eq('completed');
      expect(row.passed).to.eq(true);
    });
  });

  it('counts the completion in the reports summary', () => {
    cy.api('GET', 'induction/v1/reports/summary').then(({ body }) => {
      const report = body.module_reports.find(
        (r: { module_id: number }) => r.module_id === moduleId,
      );
      expect(report, 'the module appears in reporting').to.exist;

      // Check the breakdown row before the aggregate: total_completed is derived from
      // it, so this distinguishes "not counted as assigned" from "not recorded complete".
      const seen = JSON.stringify(report);
      const entry = report.staff_breakdown.find((s: { user_id: number }) => s.user_id === staffId);

      expect(entry, `staff ${staffId} is not listed as assigned — report was ${seen}`).to.exist;
      expect(entry.status, `graded as passed, but reporting says otherwise — ${seen}`).to.eq('completed');
      expect(report.total_completed, `breakdown and total disagree — ${seen}`).to.be.greaterThan(0);
    });
  });
});
