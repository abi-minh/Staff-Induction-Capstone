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
    // The fixture account, not the first staff-role record: this journey
    // assigns a module, completes it and files a graded quiz result, so running
    // it against whoever happens to sort first writes a real colleague's
    // training history.
    cy.fixtureStaff().then((staff) => {
      staffId = staff.id;
      staffName = staff.name;
    });

    cy.api('POST', 'induction/v1/modules', {
      title: `L4 lifecycle ${Date.now()}`,
      status: 'publish',
      meta: {
        // Mirrors what the module editor sends on create, so the fixture is a
        // module a real admin could have made. Omitting it used to make the
        // module invisible to every list query — the plugin no longer drops
        // modules without this meta, but matching the UI keeps the fixture
        // honest rather than relying on that.
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

    // Scoped by title: the Staff page mounts several Dialogs (assign, add staff,
    // reminder, bulk reminder), and a bare [role="dialog"] can match more than
    // one, which makes within() throw rather than fail on the assertion.
    cy.contains('[role="dialog"]', 'Assign Modules').within(() => {
      // Search rather than scan: the dialog renders a capped list, and a module
      // created seconds ago is not necessarily in the part of it that is
      // visible. Typing is also what an admin does on a site with more than a
      // screenful of modules, so the test stops depending on list ordering.
      cy.get('input[placeholder*="Search"]').type('L4 lifecycle');
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
    // Opening the module fires a fire-and-forget progress upsert from an effect
    // (StaffModuleViewPage), so the row does not exist the instant the content
    // renders. Waiting on the request is deterministic; polling the API and
    // hoping is not. Registered before the visit because the effect runs on
    // mount, ahead of any interaction.
    cy.intercept('POST', '**/induction/v1/progress').as('startProgress');

    cy.visitAs('staff', `/#/portal/training/${moduleId}`);
    // The section title is on the module's index page; the block content is not.
    // Opening the section is what the staff member actually does, and what
    // starts the progress row asserted below.
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

      // user_id is a required arg on both routes — omitting it is a 400 from
      // WordPress before either callback runs, not a 200 with an inferred user.
      cy.request({
        method: 'POST', url: wp('induction/v1/quiz/save'), headers,
        // A string, not a boolean. The route declares answer as a string and
        // saveQuizAnswer() in the app types it the same way, so a true/false
        // block sends "true" — the spec was the thing that was wrong here, and
        // the block's correctAnswer being a real boolean in the fixture is what
        // made the mistake look plausible.
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
    // The module name is a plain table cell — clicking it does nothing. Each
    // row carries its own Review button, which is the way in.
    // An anchor, not a button: the control is <Button component={RouterLink}>,
    // which MUI renders as <a href>. Matching on 'button' could never succeed.
    cy.contains('tr', 'L4 lifecycle').within(() => {
      cy.contains('a', 'Review').click();
    });

    // Two steps, not one: Pass only sets local state in the review form, and
    // nothing reaches the server until Save Grade is pressed. The spec was
    // asserting on a grade it had never submitted.
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

      // Breakdown before aggregate, deliberately. total_completed is derived
      // from staff_breakdown, and only counts staff the module is targeted at
      // — so a bare "expected 0 to be above 0" cannot distinguish "not counted
      // as assigned" from "not recorded as complete". Checking the row first
      // names which of the two it is, and the report is in the message because
      // that is the evidence needed either way.
      const seen = JSON.stringify(report);
      const entry = report.staff_breakdown.find((s: { user_id: number }) => s.user_id === staffId);

      expect(entry, `staff ${staffId} is not listed as assigned — report was ${seen}`).to.exist;
      expect(entry.status, `graded as passed, but reporting says otherwise — ${seen}`).to.eq('completed');
      expect(report.total_completed, `breakdown and total disagree — ${seen}`).to.be.greaterThan(0);
    });
  });
});
