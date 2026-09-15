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
