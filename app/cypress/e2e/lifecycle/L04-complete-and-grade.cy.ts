/// <reference types="cypress" />
import { wp } from '../../support/testEnv';

// L4 from the test plan: the core loop, and the one journey no lower layer can
// express — it crosses two roles, four pages and the reporting aggregate.
//
//   admin assigns -> staff completes -> staff submits quiz
//   -> admin grades -> completion appears in reports

describe('L4 · assign, complete, grade, report', () => {
  let moduleId: number;
  let staffId: number;
  let staffName: string;

  before(() => {
    cy.api('GET', 'induction/v1/staff').then(({ body }) => {
      const staff = body.find((s: { roles: string[] }) => s.roles.includes('staff'));
      expect(staff, 'the test site needs a staff-role account').to.exist;
      staffId = staff.id;
      staffName = staff.name;
    });

    cy.api('POST', 'induction/v1/modules', {
      title: `L4 lifecycle ${Date.now()}`,
      status: 'publish',
      meta: {
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

    cy.get('[role="dialog"]').within(() => {
      cy.contains('L4 lifecycle').click();
      cy.contains('button', /save|assign/i).click();
    });

    // The UI is the subject here, but the assignment row is the assertion.
    cy.api('GET', `induction/v1/assignments/records/user/${staffId}`).then(({ body }) => {
      const ids = body.map((a: { moduleId?: number; module_id?: number }) => a.moduleId ?? a.module_id);
      expect(ids).to.include(moduleId);
    });
  });

  it('shows the module to the staff member and records progress', () => {
    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    cy.contains('Beach safety').should('be.visible');
    cy.contains('Always wear a PFD').should('be.visible');

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

      // user_id is a required arg on both routes — omitting it is a 400 from
      // WordPress before either callback runs, not a 200 with an inferred user.
      cy.request({
        method: 'POST', url: wp('induction/v1/quiz/save'), headers,
        body: { user_id: staffId, module_id: moduleId, block_id: 'q1', answer: true },
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
    cy.contains('L4 lifecycle').click();
    cy.contains('button', /pass|approve/i).click();

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
      expect(report.total_completed).to.be.greaterThan(0);

      const entry = report.staff_breakdown.find((s: { user_id: number }) => s.user_id === staffId);
      expect(entry.status).to.eq('completed');
    });
  });
});
