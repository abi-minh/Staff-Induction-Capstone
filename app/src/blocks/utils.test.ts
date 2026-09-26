import { describe, it, expect } from 'vitest';
import { blockLayoutSx, clampRowColumns, createBlock, createSection, isQuizBlock, layoutOf, parseSections } from './utils';
import { MAX_ROW_COLUMNS, MIN_ROW_COLUMNS } from '../types';
import type { Block, PlacedBlock, RowChildBlock, Section } from '../types';

// Typed as RowChildBlock, not Block: a PlacedBlock inside a row only accepts
// the subset of block types a column can hold.
function textBlock(id: string): RowChildBlock {
  return { id, type: 'text', data: { html: `<p>${id}</p>` } };
}

function section(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    heroImage: '',
    title: 'Safety',
    description: '',
    blocks: [textBlock('b1')],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
    ...overrides,
  };
}

describe('parseSections', () => {
  it('round-trips a section array', () => {
    const parsed = parseSections(JSON.stringify([section()]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Safety');
    expect(parsed[0].blocks).toHaveLength(1);
  });

  // This is the guard that stops a corrupt or empty meta value from being
  // presented as "this module has no content" — the shape of two separate
  // content-loss bugs found in production.
  it('returns an empty array rather than throwing on unusable input', () => {
    expect(parseSections(undefined)).toEqual([]);
    expect(parseSections('')).toEqual([]);
    expect(parseSections('[]')).toEqual([]);
    expect(parseSections('not json at all')).toEqual([]);
    expect(parseSections('{"not":"an array"}')).toEqual([]);
    expect(parseSections('[{"blocks":[]},')).toEqual([]);
  });

  // Legacy migration used to happen here; sprint4 moved it server-side into
  // induction_normalize_sections(). What this parser must still guarantee is
  // that an old flat Block[] doesn't throw or produce undefined blocks — the
  // migration itself is covered by the endpoint suite.
  it('survives the legacy flat Block[] shape without throwing', () => {
    const legacy: Block[] = [
      textBlock('b1'),
      { id: 'q1', type: 'true_false', data: { question: 'Wear a PFD?', correctAnswer: true, explanation: '' } },
    ];
    const parsed = parseSections(JSON.stringify(legacy));

    expect(Array.isArray(parsed)).toBe(true);
    parsed.forEach((s) => expect(Array.isArray(s.blocks)).toBe(true));
  });

  it('leaves a well-formed row block untouched', () => {
    const row: Block = {
      id: 'row-1',
      type: 'row',
      data: {
        columns: 2,
        children: [{ block: textBlock('child-1'), colStart: 1, colSpan: 1 }],
      },
    };
    const parsed = parseSections(JSON.stringify([section({ blocks: [row] })]));
    const parsedRow = parsed[0].blocks[0];

    expect(parsedRow.type).toBe('row');
    if (parsedRow.type === 'row') {
      expect(parsedRow.data.columns).toBe(2);
      expect(parsedRow.data.children).toHaveLength(1);
    }
  });
});

describe('clampRowColumns', () => {
  const children: PlacedBlock[] = [
    { block: textBlock('a'), colStart: 1, colSpan: 1 },
    { block: textBlock('b'), colStart: 2, colSpan: 1 },
    { block: textBlock('c'), colStart: 3, colSpan: 1 },
  ];

  it('keeps everything when the column count is unchanged', () => {
    const result = clampRowColumns({ columns: 3, children }, 3);
    expect(result.row.children).toHaveLength(3);
    expect(result.droppedChildren).toHaveLength(0);
    expect(result.clampedAny).toBe(false);
  });

  it('reports which children are dropped when narrowing', () => {
    const result = clampRowColumns({ columns: 3, children }, 2);
    expect(result.row.columns).toBe(2);
    // The third child has nowhere to go and is surfaced, not silently binned.
    expect(result.droppedChildren.map((c) => c.block.id)).toEqual(['c']);
    expect(result.row.children).toHaveLength(2);
  });

  it('clamps a span that would overflow the new width', () => {
    const wide: PlacedBlock[] = [{ block: textBlock('wide'), colStart: 1, colSpan: 4 }];
    const result = clampRowColumns({ columns: 4, children: wide }, 2);
    expect(result.row.children[0].colSpan).toBe(2);
    expect(result.clampedAny).toBe(true);
  });

  // MIN_ROW_COLUMNS = 2, MAX_ROW_COLUMNS = 6.
  it('refuses column counts outside the supported range', () => {
    expect(clampRowColumns({ columns: 2, children: [] }, 99).row.columns).toBe(MAX_ROW_COLUMNS);
    expect(clampRowColumns({ columns: 2, children: [] }, 0).row.columns).toBe(MIN_ROW_COLUMNS);
  });
});

describe('block and section factories', () => {
  it('gives every new block a distinct id', () => {
    const ids = new Set([
      createBlock('text').id,
      createBlock('text').id,
      createBlock('heading').id,
    ]);
    expect(ids.size).toBe(3);
  });

  it('starts a new section hidden from staff', () => {
    const fresh = createSection();
    expect(fresh.status).toBe('draft');
    expect(fresh.quizStatus).toBe('draft');
    expect(fresh.blocks).toEqual([]);
  });

  it('recognises quiz blocks and only quiz blocks', () => {
    expect(isQuizBlock(createBlock('multiple_choice'))).toBe(true);
    expect(isQuizBlock(createBlock('true_false'))).toBe(true);
    expect(isQuizBlock(createBlock('short_answer'))).toBe(true);
    expect(isQuizBlock(createBlock('text'))).toBe(false);
    expect(isQuizBlock(createBlock('row'))).toBe(false);
  });
});

describe('layoutOf', () => {
  it('returns a block\'s layout when it has one', () => {
    const text: Block = { id: 't', type: 'text', data: { html: '<p>x</p>' }, layout: { align: 'right', width: 50 } };
    expect(layoutOf(text)).toEqual({ align: 'right', width: 50 });
  });

  it('returns undefined for a block type that carries no layout (a quiz block)', () => {
    const quiz: Block = { id: 'q', type: 'true_false', data: { question: 'ok?', correctAnswer: true, explanation: '' } };
    expect(layoutOf(quiz)).toBeUndefined();
  });

  it('folds a legacy image data.width into the layout when there is no layout.width', () => {
    const legacy: Block = { id: 'i', type: 'image', data: { mediaId: 1, url: 'u', alt: '', caption: '', width: 60 } };
    expect(layoutOf(legacy)).toEqual({ width: 60 });
  });

  it('prefers layout.width over the legacy image data.width', () => {
    const img: Block = {
      id: 'i', type: 'image',
      data: { mediaId: 1, url: 'u', alt: '', caption: '', width: 60 },
      layout: { align: 'center', width: 40 },
    };
    expect(layoutOf(img)).toEqual({ align: 'center', width: 40 });
  });

  it('keeps a set align while folding in the legacy width', () => {
    const img: Block = {
      id: 'i', type: 'image',
      data: { mediaId: 1, url: 'u', alt: '', caption: '', width: 60 },
      layout: { align: 'center' },
    };
    expect(layoutOf(img)).toEqual({ align: 'center', width: 60 });
  });
});

describe('blockLayoutSx', () => {
  it('defaults to left-aligned, full width', () => {
    expect(blockLayoutSx()).toEqual({ marginLeft: 0, marginRight: 'auto' });
  });

  it('centres by pushing both margins to auto', () => {
    expect(blockLayoutSx({ align: 'center' })).toEqual({ marginLeft: 'auto', marginRight: 'auto' });
  });

  it('right-aligns by pinning the right margin', () => {
    expect(blockLayoutSx({ align: 'right' })).toEqual({ marginLeft: 'auto', marginRight: 0 });
  });

  it('constrains a sub-100 width, staying full-width on mobile', () => {
    expect(blockLayoutSx({ width: 50 })).toEqual({
      maxWidth: { xs: '100%', sm: '50%' },
      marginLeft: 0,
      marginRight: 'auto',
    });
  });

  it('applies no max-width at full (100) width', () => {
    expect(blockLayoutSx({ width: 100 })).toEqual({ marginLeft: 0, marginRight: 'auto' });
  });

  it('combines a centred position with a set width', () => {
    expect(blockLayoutSx({ align: 'center', width: 50 })).toEqual({
      maxWidth: { xs: '100%', sm: '50%' },
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });
});
