/// <reference types="cypress" />

// Shared spec fixtures. These live here rather than being redeclared per spec
// for two reasons: the section shape is long enough that copies drift, and a
// Cypress spec without imports is a script sharing one global scope, so
// same-named helpers in two specs collide at compile time.

export interface BlockFixture {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface SectionFixture {
  id: string;
  heroImage: string;
  title: string;
  description: string;
  status?: string;
  quizStatus?: string;
  blocks: BlockFixture[];
  quizTitle: string;
  passingPercentage: number;
  quizBlocks: BlockFixture[];
  isModuleQuiz: boolean;
}

/** One section holding a single text block — the smallest valid module body. */
export function textSection(html: string, overrides: Partial<SectionFixture> = {}): SectionFixture {
  return {
    id: 'section-fixture',
    heroImage: '',
    title: 'Fixture section',
    description: '',
    blocks: [{ id: 'block-1', type: 'text', data: { html } }],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
    ...overrides,
  };
}

/** Serialised for the module_blocks meta field. */
export function sectionsJson(html: string, overrides: Partial<SectionFixture> = {}): string {
  return JSON.stringify([textSection(html, overrides)]);
}

/** A published section with a one-question true/false module quiz. */
export function quizSectionJson(): string {
  return JSON.stringify([
    textSection('<p>Always wear a PFD.</p>', {
      id: 'section-quiz',
      title: 'Beach safety',
      status: 'publish',
      quizStatus: 'publish',
      quizTitle: 'Check',
      passingPercentage: 50,
      isModuleQuiz: true,
      quizBlocks: [{
        id: 'q1',
        type: 'true_false',
        data: { question: 'Should you wear a PFD?', correctAnswer: true, explanation: '' },
      }],
    }),
  ]);
}
