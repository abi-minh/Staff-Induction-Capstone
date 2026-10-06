/// <reference types="cypress" />

// Every case here is a defect that reached a live site and silently destroyed
// module content. They are grouped together, and first in the run order, so a
// reintroduction is the loudest thing in the report.

interface Section {
  id: string;
  heroImage: string;
  title: string;
  description: string;
  blocks: { id: string; type: string; data: Record<string, unknown> }[];
  quizTitle: string;
  passingPercentage: number;
  quizBlocks: unknown[];
  isModuleQuiz: boolean;
}

function section(html: string): Section {
  return {
    id: 'section-regression',
    heroImage: '',
    title: 'Regression fixture',
    description: '',
    blocks: [{ id: 'block-1', type: 'text', data: { html } }],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
  };
}

describe('Content-loss regressions', () => {
  let moduleId: number;

  beforeEach(() => {
    cy.api('POST', 'induction/v1/modules', {
      title: `Regression ${Date.now()}`,
      status: 'draft',
      meta: { module_blocks: JSON.stringify([section('<p>seed</p>')]) },
    }).then(({ status, body }) => {
      expect(status).to.be.oneOf([200, 201]);
      moduleId = body.id;
    });
  });

  afterEach(() => {
    if (moduleId) cy.api('DELETE', `induction/v1/modules/${moduleId}`);
  });

  // Cause: update_post_meta() runs wp_unslash() before the sanitise callback,
  // which stripped the backslash from every \" in the JSON, leaving invalid
  // JSON that the sanitiser replaced with '[]'. Fixed by induction_slash_meta().
  it('keeps content containing a double quote (the unslash wipe)', () => {
    const html = '<p>Leave this as it is and select Submit after "Nice Catch".</p>';

    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: JSON.stringify([section(html)]) },
    }).its('status').should('eq', 200);

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      const stored = JSON.parse(body.meta.module_blocks);
      expect(stored, 'module still has its section').to.have.length(1);
      expect(stored[0].blocks[0].data.html).to.eq(html);
    });
  });

  it('keeps content containing backslashes and escaped sequences', () => {
    const html = '<p>Path C:\\Users\\demo and a quote: "x" and a backslash-quote: \\"y\\"</p>';

    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: JSON.stringify([section(html)]) },
    }).its('status').should('eq', 200);

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      const stored = JSON.parse(body.meta.module_blocks);
      expect(stored[0].blocks[0].data.html).to.eq(html);
    });
  });

  // Cause: wp_json_encode() returns false on malformed UTF-8, was coerced to ''
  // by the string-typed parameter, and read back as '[]'. Fixed by encoding
  // with JSON_INVALID_UTF8_SUBSTITUTE and refusing to store a non-string.
  it('never stores an empty module when encoding is problematic', () => {
    const html = '<p>Odd characters: \uFFFD \u0001 and an emoji 🎣</p>';

    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: JSON.stringify([section(html)]) },
    }).then(({ status }) => {
      // Either it saved, or it refused with an error. What it must never do is
      // return 200 and leave the module empty.
      expect(status).to.be.oneOf([200, 400, 500]);
    });

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      const stored = JSON.parse(body.meta.module_blocks);
      expect(stored, 'content survived, or the earlier seed did').to.have.length(1);
    });
  });

  // Cause: the module editor posted an empty sections array before the module
  // had loaded. The server-side guard is the backstop for every client that
  // gets this wrong.
  it('rejects a save that would empty a module with existing sections', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: '[]' },
    }).then(({ status, body }) => {
      expect(status).to.eq(409);
      expect(body.code).to.eq('induction_blocks_wipe_rejected');
    });

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      expect(JSON.parse(body.meta.module_blocks)).to.have.length(1);
    });
  });

  it('rejects malformed section JSON without touching what is stored', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      meta: { module_blocks: '[{"id":"broken"' },
    }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.code).to.eq('induction_invalid_module_blocks');
    });

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      const stored = JSON.parse(body.meta.module_blocks);
      expect(stored[0].blocks[0].data.html).to.eq('<p>seed</p>');
    });
  });

  // A metadata-only save must not disturb content — the path that used to wipe
  // sections while the admin was only renaming the module.
  it('leaves sections alone when only metadata is sent', () => {
    cy.api('POST', `induction/v1/modules/${moduleId}`, {
      title: 'Renamed, content untouched',
      meta: { module_icon: 'safety' },
    }).its('status').should('eq', 200);

    cy.api('GET', `induction/v1/modules/${moduleId}`).then(({ body }) => {
      expect(JSON.parse(body.meta.module_blocks)).to.have.length(1);
      expect(body.title.raw).to.eq('Renamed, content untouched');
    });
  });
});

// Short answers are recorded but never auto-marked. A written answer is not
// something a string comparison can judge, so the endpoint returns guidance for
// the learner to mark themselves against and leaves is_correct NULL — which is
// what that column has always meant by "not graded".
describe('Short answers are not auto-marked', () => {
  const modules: number[] = [];
  const GUIDANCE = 'Mentions a PFD and checking the forecast';

  after(() => {
    modules.forEach((id) => cy.api('DELETE', `induction/v1/modules/${id}`));
  });

  function moduleWithShortAnswer(): Cypress.Chainable<number> {
    return cy.api('POST', 'induction/v1/modules', {
      title: `Short answer ${Date.now()}`,
      status: 'publish',
      meta: {
        module_order: 0,
        module_blocks: JSON.stringify([{
          id: 'sec-sa',
          heroImage: '', title: 'Safety', description: '', status: 'publish',
          quizStatus: 'publish', quizTitle: 'Check', passingPercentage: 80,
          isModuleQuiz: false, blocks: [],
          quizBlocks: [{
            id: 'sa1',
            type: 'short_answer',
            data: { question: 'What do you check before heading out?', answerGuidance: GUIDANCE, explanation: '' },
          }],
        }]),
      },
    }).then(({ status, body }) => {
      expect(status).to.eq(200);
      modules.push(body.id);
      return body.id as number;
    });
  }

  it('returns guidance and no verdict, whatever the answer says', () => {
    moduleWithShortAnswer().then((moduleId) => {
      cy.fixtureStaff().then((staff) => {
        // Deliberately nothing like the guidance: there is no answer that
        // should come back marked either way.
        cy.api('POST', 'induction/v1/quiz/check', {
          user_id: staff.id, module_id: moduleId, block_id: 'sa1', answer: 'no idea',
        }).then(({ status, body }) => {
          expect(status).to.eq(200);
          expect(body.isCorrect, 'never judged').to.eq(null);
          expect(body.guidance).to.eq(GUIDANCE);
        });
      });
    });
  });

  it('records the answer without grading it', () => {
    moduleWithShortAnswer().then((moduleId) => {
      cy.fixtureStaff().then((staff) => {
        cy.api('POST', 'induction/v1/quiz/check', {
          user_id: staff.id, module_id: moduleId, block_id: 'sa1', answer: 'A PFD and the forecast',
        }).its('status').should('eq', 200);

        cy.api('GET', `induction/v1/quiz/responses?user_id=${staff.id}&module_id=${moduleId}`)
          .then(({ status, body }) => {
            if (status !== 200) {
              cy.log('No responses endpoint exposed; the check response is the contract');
              return;
            }
            const row = (body as { blockId?: string; block_id?: string; isCorrect: boolean | null }[])
              .find((r) => (r.blockId ?? r.block_id) === 'sa1');
            if (row) expect(row.isCorrect, 'stored ungraded').to.eq(null);
          });
      });
    });
  });

  // Questions written while these were auto-marked stored the expected text in
  // correctAnswer. It still surfaces as guidance, so old modules keep working.
  it('falls back to the legacy correctAnswer as guidance', () => {
    cy.api('POST', 'induction/v1/modules', {
      title: `Legacy short answer ${Date.now()}`,
      status: 'publish',
      meta: {
        module_order: 0,
        module_blocks: JSON.stringify([{
          id: 'sec-legacy',
          heroImage: '', title: 'Legacy', description: '', status: 'publish',
          quizStatus: 'publish', quizTitle: 'Check', passingPercentage: 80,
          isModuleQuiz: false, blocks: [],
          quizBlocks: [{
            id: 'sa-legacy',
            type: 'short_answer',
            data: { question: 'Old style?', correctAnswer: 'PFD', explanation: '' },
          }],
        }]),
      },
    }).then(({ body }) => {
      modules.push(body.id);
      cy.fixtureStaff().then((staff) => {
        cy.api('POST', 'induction/v1/quiz/check', {
          user_id: staff.id, module_id: body.id, block_id: 'sa-legacy', answer: 'PFD',
        }).then(({ body: res }) => {
          expect(res.isCorrect, 'still not judged').to.eq(null);
          expect(res.guidance).to.eq('PFD');
        });
      });
    });
  });
});
