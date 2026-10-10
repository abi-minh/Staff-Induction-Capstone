import { describe, it, expect } from 'vitest';
import { alignedListSx, blockLayoutSx, calloutBodyHtml, clampRowColumns, createBlock, createSection, isQuizBlock, layoutOf, moveItem, parseSections, visibleSections } from './utils';
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

// What a staff member is actually shown. The dashboard and the module view
// both call this; they used to each decide for themselves, and disagreed.
describe('visibleSections', () => {
  const quizBlock = {
    id: 'q1', type: 'true_false' as const,
    data: { question: 'Wear a PFD?', correctAnswer: true, explanation: '' },
  };

  function raw(...sections: Section[]): string {
    return JSON.stringify(sections);
  }

  it('drops draft sections and keeps published ones', () => {
    const result = visibleSections(raw(
      section({ id: 'live', status: 'publish' }),
      section({ id: 'hidden', status: 'draft' }),
    ));
    expect(result.map((s) => s.id)).to.deep.eq(['live']);
  });

  // Sections authored before the status field existed carry no status at all,
  // and must not silently vanish from every module.
  it('treats a missing status as published', () => {
    const legacy = section({ id: 'old' });
    delete (legacy as Partial<Section>).status;
    expect(visibleSections(raw(legacy)).map((s) => s.id)).to.deep.eq(['old']);
  });

  it('keeps a quiz-draft section but strips the quiz from it', () => {
    const [result] = visibleSections(raw(section({
      id: 's1', status: 'publish', quizStatus: 'draft',
      quizBlocks: [quizBlock], isModuleQuiz: true,
    })));

    expect(result.blocks, 'the reading content stays').to.have.length(1);
    expect(result.quizBlocks).to.deep.eq([]);
    // Left set, this would gate module completion on a quiz no one can see.
    expect(result.isModuleQuiz, 'and it stops being the module quiz').to.eq(false);
  });

  it('leaves a published quiz alone', () => {
    const [result] = visibleSections(raw(section({
      status: 'publish', quizStatus: 'publish',
      quizBlocks: [quizBlock], isModuleQuiz: true,
    })));
    expect(result.quizBlocks).to.have.length(1);
    expect(result.isModuleQuiz).to.eq(true);
  });

  it('returns an empty array for unusable input', () => {
    expect(visibleSections(undefined)).to.deep.eq([]);
    expect(visibleSections('not json')).to.deep.eq([]);
  });
});

// The callout body became rich text. Every callout written before that holds
// plain text, and the reader now treats the field as markup — so this is the
// one piece of client content the change could damage.
describe('calloutBodyHtml', () => {
  it('passes existing markup through untouched', () => {
    const html = '<p>Already <strong>rich</strong> text.</p>';
    expect(calloutBodyHtml(html)).to.eq(html);
  });

  it('wraps a plain line in a paragraph', () => {
    expect(calloutBodyHtml('Mind the rope.')).to.eq('<p>Mind the rope.</p>');
  });

  // The point of the exercise: a blank line was a paragraph break the old
  // renderer threw away.
  it('turns a blank line into a new paragraph', () => {
    expect(calloutBodyHtml('First.\n\nFirst again.')).to.eq('<p>First.</p><p>First again.</p>');
  });

  it('turns a single newline into a line break', () => {
    expect(calloutBodyHtml('Line one.\nLine two.')).to.eq('<p>Line one.<br>Line two.</p>');
  });

  // Plain text is not markup: a stray angle bracket in someone's safety note
  // must reach the screen, not be swallowed as a tag.
  it('escapes plain text rather than trusting it', () => {
    expect(calloutBodyHtml('Keep load < 20kg & stay clear'))
      .to.eq('<p>Keep load &lt; 20kg &amp; stay clear</p>');
  });

  it('is empty for an empty or missing body', () => {
    expect(calloutBodyHtml('')).to.eq('');
    expect(calloutBodyHtml(undefined)).to.eq('');
  });

  it('drops trailing blank lines instead of emitting empty paragraphs', () => {
    expect(calloutBodyHtml('Only line.\n\n\n')).to.eq('<p>Only line.</p>');
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

// Reordering sections in the module editor. The editor's dirty check compares a
// serialised snapshot of `sections`, so identity matters as much as contents:
// a move that changes nothing must hand back the same array, or an untouched
// module starts claiming it has unsaved changes.
describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item later in the list', () => {
    expect(moveItem(list, 0, 2)).to.deep.eq(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier in the list', () => {
    expect(moveItem(list, 3, 1)).to.deep.eq(['a', 'd', 'b', 'c']);
  });

  it('nudges by one in both directions', () => {
    expect(moveItem(list, 1, 0)).to.deep.eq(['b', 'a', 'c', 'd']);
    expect(moveItem(list, 1, 2)).to.deep.eq(['a', 'c', 'b', 'd']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...list];
    moveItem(list, 0, 3);
    expect(list).to.deep.eq(original);
  });

  // The controls at the ends of the list are disabled, but a keyboard repeat or
  // a future drag can still ask for an out-of-range move.
  it('returns the same array for a no-op or out-of-range move', () => {
    expect(moveItem(list, 2, 2)).to.eq(list);
    expect(moveItem(list, -1, 1)).to.eq(list);
    expect(moveItem(list, 0, 4)).to.eq(list);
    expect(moveItem(list, 9, 0)).to.eq(list);
  });

  it('handles empty and single-item lists', () => {
    expect(moveItem([], 0, 0)).to.deep.eq([]);
    expect(moveItem(['only'], 0, 1)).to.deep.eq(['only']);
  });

  it('reorders sections, which is what it exists for', () => {
    const sections = [section({ id: 's1' }), section({ id: 's2' }), section({ id: 's3' })];
    const moved = moveItem(sections, 2, 0);
    expect(moved.map((s) => s.id)).to.deep.eq(['s3', 's1', 's2']);
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

// Centring a bullet list used to move the words and leave the markers pinned
// to the far left, because a list marker is placed by the list's box rather
// than by the text inside each item.
describe('alignedListSx', () => {
  it('adds nothing for left-aligned text', () => {
    expect(alignedListSx('left')).to.deep.eq({});
    expect(alignedListSx(undefined), 'left is the default').to.deep.eq({});
  });

  it('brings the marker inside the content box when centred', () => {
    expect(alignedListSx('center')).to.deep.eq({
      listStylePosition: 'inside',
      paddingLeft: 0,
      '& li > p:first-of-type': { display: 'inline' },
    });
  });

  it('does the same for right-aligned text', () => {
    expect(alignedListSx('right')).to.deep.eq({
      listStylePosition: 'inside',
      paddingLeft: 0,
      '& li > p:first-of-type': { display: 'inline' },
    });
  });

  // A marker moved inside the item's box shares a line with whatever starts
  // that box — and TipTap starts it with a <p>, which is a block. Without
  // this every bullet sat on its own row above its text.
  it('puts the item paragraph back inline so the marker shares its line', () => {
    for (const align of ['center', 'right'] as const) {
      const sx = alignedListSx(align) as unknown as Record<string, { display?: string }>;
      expect(sx['& li > p:first-of-type'].display, align).to.eq('inline');
    }
  });

  // Only the first: a second paragraph in one item is a deliberate new line.
  it('leaves later paragraphs in an item as blocks', () => {
    expect(Object.keys(alignedListSx('center'))).to.not.include('& li > p');
  });

  // The indent matters as much as the marker: leaving a list's default
  // padding would centre the line inside a box that is itself offset, which
  // reads as a near-miss rather than a bug.
  it('always clears the indent when it moves the marker', () => {
    for (const align of ['center', 'right'] as const) {
      expect(alignedListSx(align)).to.have.property('paddingLeft', 0);
    }
  });
});
