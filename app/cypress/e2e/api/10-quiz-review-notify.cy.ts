/// <reference types="cypress" />
import { wp } from '../../support/testEnv';

// Submitting a module-level quiz mails everyone who can grade it. These specs
// send email — see the note in 05-reminders.cy.ts about running them against a
// mail catcher rather than a real SMTP transport.

describe('Quiz review notifications', () => {
  let moduleId: number;
  let staffId: number;
  let staffToken: string;

  before(() => {
    cy.loginAs('staff').then((token) => {
      staffToken = token;
      cy.request({
        method: 'GET',
        url: wp('induction/v1/me'),
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ body }) => { staffId = body.id; });
    });

    cy.api('POST', 'induction/v1/modules', {
      title: `Notify fixture ${Date.now()}`,
      status: 'publish',
      meta: {
        module_blocks: JSON.stringify([{
          id: 'section-notify',
          heroImage: '',
          title: 'Notify',
          description: '',
          status: 'publish',
          quizStatus: 'publish',
          blocks: [],
          quizTitle: 'Check',
          passingPercentage: 50,
          isModuleQuiz: true,
          quizBlocks: [{
            id: 'q1',
            type: 'true_false',
            data: { question: 'Ready?', correctAnswer: true },
          }],
        }]),
      },
    }).then(({ body }) => { moduleId = body.id; });
  });

  after(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  function submit() {
    return cy.request({
      method: 'POST',
      url: wp('induction/v1/quiz/submit-for-review'),
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { user_id: staffId, module_id: moduleId },
      failOnStatusCode: false,
    });
  }

  it('mails the graders when a submission arrives', () => {
    submit().then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.reviewersNotified, 'at least the admin account was mailed')
        .to.be.greaterThan(0);
    });

    cy.api('GET', 'induction/v1/quiz/pending-review').then(({ body }) => {
      const pending = body.map((r: { moduleId: number }) => r.moduleId);
      expect(pending).to.include(moduleId);
    });
  });

  it('does not mail again while the same submission is still pending', () => {
    submit().then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.reviewersNotified, 'a re-submission is not a second alert').to.eq(0);
    });
  });

  it('mails again once the submission has been graded and resubmitted', () => {
    cy.api('POST', 'induction/v1/quiz/grade', {
      user_id: staffId,
      module_id: moduleId,
      results: { q1: false },
      passed: false,
    }).its('status').should('eq', 200);

    submit().then(({ body }) => {
      expect(body.reviewersNotified, 'a retake is a fresh thing to grade')
        .to.be.greaterThan(0);
    });
  });

  it('refuses a module with no published module-level quiz', () => {
    cy.api('POST', 'induction/v1/modules', {
      title: `No quiz ${Date.now()}`,
      status: 'publish',
    }).then(({ body: mod }) => {
      cy.request({
        method: 'POST',
        url: wp('induction/v1/quiz/submit-for-review'),
        headers: { Authorization: `Bearer ${staffToken}` },
        body: { user_id: staffId, module_id: mod.id },
        failOnStatusCode: false,
      }).its('status').should('eq', 404);

      cy.api('DELETE', `induction/v1/modules/${mod.id}`);
    });
  });
});
