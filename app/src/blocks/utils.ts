import {
  DEFAULT_ROW_COLUMNS,
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
} from '../types';
import type {
  Block, BlockAlign, BlockLayout, BlockType, PlacedBlock, QuizBlock, RowBlock, RowChildBlock, Section,
} from '../types';
import { escapeHtml, stripHtml } from '../util/strings';

export function layoutOf(block: Block): BlockLayout | undefined {
  const layout = 'layout' in block ? block.layout : undefined;
  if (block.type === 'image' && block.data.width && layout?.width === undefined) {
    return { ...layout, width: block.data.width };
  }
  return layout;
}

/**
 * Extra rules a `ul`/`ol` needs when the text around it is not left-aligned.
 *
 * A list marker is positioned by the list's own box, not by the text inside
 * each item — so `text-align: center` moves the words and leaves the bullets
 * pinned to the far left. Pulling the marker inside the content box makes it
 * travel with its text.
 *
 * The indent has to go with it: a `ul` carries a default
 * `padding-inline-start`, and leaving it would centre the line within a box
 * that is itself offset, which looks like a near-miss rather than a mistake.
 *
 * And the item's paragraph has to come back inline. TipTap writes each item as
 * `<li><p>text</p></li>`, and a marker placed inside a box whose first child is
 * a block gets a line to itself — which put every bullet on its own row above
 * its text. Only the first paragraph: a second one in the same item is a
 * deliberate new line and should stay one.
 *
 * Returned as properties to merge into an existing `ul, ol` rule rather than a
 * whole selector, so the editor and the reader can each apply it at their own
 * nesting depth and stay in step.
 */
export function alignedListSx(align?: BlockAlign) {
  return align && align !== 'left'
    ? {
        listStylePosition: 'inside' as const,
        paddingLeft: 0,
        '& li > p:first-of-type': { display: 'inline' },
      }
    : {};
}

export function blockLayoutSx(layout?: BlockLayout) {
  const width = layout?.width;
  const align = layout?.align ?? 'left';
  return {
    ...(width && width < 100 ? { maxWidth: { xs: '100%', sm: `${width}%` } } : null),
    marginLeft: align === 'left' ? 0 : ('auto' as const),
    marginRight: align === 'right' ? 0 : ('auto' as const),
  };
}

let blockCounter = 0;
let sectionCounter = 0;

export function generateBlockId(): string {
  return `block-${Date.now()}-${blockCounter++}`;
}

export function isQuizBlock(block: Block): block is QuizBlock {
  return block.type === 'multiple_choice' || block.type === 'true_false' || block.type === 'short_answer';
}

const ROW_CHILD_TYPES: BlockType[] = ['heading', 'text', 'image', 'video', 'list', 'callout'];

export function isRowChildType(type: BlockType): type is RowChildBlock['type'] {
  return ROW_CHILD_TYPES.includes(type);
}

// Clamps malformed row data so the editor and renderer never see invalid layouts.
// Returns kept/dropped/clamped flag so callers can prompt the user when destructive.
export function clampRowColumns(
  row: RowBlock['data'],
  newColumns: number,
): { row: RowBlock['data']; droppedChildren: PlacedBlock[]; clampedAny: boolean } {
  const clamped = Math.max(MIN_ROW_COLUMNS, Math.min(MAX_ROW_COLUMNS, newColumns));
  const dropped: PlacedBlock[] = [];
  const kept: PlacedBlock[] = [];
  let clampedAny = false;
  let lastEnd = 0;

  for (const child of row.children) {
    const newStart = Math.min(child.colStart, clamped);
    const maxSpan = clamped - newStart + 1;
    const newSpan = Math.min(child.colSpan, maxSpan);

    if (newStart <= lastEnd) {
      dropped.push(child);
      continue;
    }
    if (newStart !== child.colStart || newSpan !== child.colSpan) {
      clampedAny = true;
    }
    kept.push({ ...child, colStart: newStart, colSpan: newSpan });
    lastEnd = newStart + newSpan - 1;
  }

  return {
    row: { columns: clamped, children: kept },
    droppedChildren: dropped,
    clampedAny,
  };
}

// Applied when reading module_blocks from the API. Silent migrations; the next
// admin save persists the fixes.
export function sanitizeBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type !== 'row') return b;
    const { row } = clampRowColumns(b.data, b.data.columns);
    return { ...b, data: row };
  });
}

export function parseSections(raw: string | undefined): Section[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const sections = parsed as Section[];
    return sections.map((s) => ({ ...s, blocks: sanitizeBlocks(s.blocks ?? []) }));
  } catch {
    return [];
  }
}

/**
 * A callout's body as HTML.
 *
 * The body used to be a plain string typed into a textarea, rendered into a
 * single paragraph — so a line break did nothing and there was no way to bold
 * a word. It is rich text now, but every callout written before that holds
 * plain text, and handing plain text to a renderer that treats it as markup
 * would both swallow the line breaks and read a stray `<` as a tag.
 *
 * So: anything that already looks like markup is passed through, and anything
 * else is escaped and given the paragraphs and line breaks its blank lines and
 * newlines were always meant to produce. A callout converts for good the first
 * time it is opened in the editor and saved; until then it converts on the way
 * to the screen, so nothing has to be migrated in the database.
 */
export function calloutBodyHtml(body: string | undefined): string {
  if (!body) return '';
  if (/<[a-z][^>]*>/i.test(body)) return body;

  return body
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * The sections a staff member is actually shown, from a module's raw meta.
 *
 * Draft sections are dropped, and a section whose quiz is still draft keeps
 * its content but loses the quiz — including its claim to be the module-level
 * quiz, which would otherwise gate completion on a quiz nobody can see.
 *
 * Shared because the dashboard and the module view both have to agree on what
 * "all sections" means. They did not: the dashboard counted draft sections
 * when working out a percentage, so a module with one draft section could sit
 * at 80% on the card and 100% inside, and the card's resume link could point
 * at a section the module view then refuses to render.
 */
export function visibleSections(raw: string | undefined): Section[] {
  return parseSections(raw)
    .filter((s) => (s.status ?? 'publish') === 'publish')
    .map((s) =>
      (s.quizStatus ?? 'publish') === 'publish'
        ? s
        : { ...s, quizBlocks: [], isModuleQuiz: false },
    );
}

/**
 * Move one item to a new index, returning a new array.
 *
 * Splice rather than swap, so the same function serves a single-step nudge and
 * a drag across several positions. Any move that would fall outside the list
 * returns the original array untouched: the callers are controls at the ends of
 * a list, where doing nothing is the correct answer rather than an error.
 *
 * Returning the input array unchanged also matters for the editor's dirty
 * check, which compares a serialised snapshot — a no-op move must not make an
 * unmodified module look edited.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function createSection(): Section {
  return {
    id: `section-${Date.now()}-${sectionCounter++}`,
    heroImage: '',
    heroImageMediaId: 0,
    title: '',
    description: '',
    blocks: [],
    quizTitle: '',
    passingPercentage: 80,
    quizBlocks: [],
    isModuleQuiz: false,
    // New sections start hidden from staff until deliberately published.
    status: 'draft',
    quizStatus: 'draft',
  };
}

export function createBlock(type: BlockType): Block {
  const id = generateBlockId();

  switch (type) {
    case 'heading':
      return { id, type, data: { level: 2, text: '' } };
    case 'text':
      return { id, type, data: { html: '' } };
    case 'image':
      return { id, type, data: { mediaId: 0, url: '', alt: '', caption: '' } };
    case 'video':
      return { id, type, data: { mediaId: 0, url: '', caption: '' } };
    case 'list':
      return { id, type, data: { style: 'unordered', items: [''] } };
    case 'multiple_choice':
      return { id, type, data: { question: '', options: ['', ''], correctIndex: 0, explanation: '' } };
    case 'true_false':
      return { id, type, data: { question: '', correctAnswer: true, explanation: '' } };
    case 'short_answer':
      return { id, type, data: { question: '', answerGuidance: '', explanation: '' } };
    case 'callout':
      return { id, type, data: { variant: 'info', title: '', body: '' } };
    case 'row':
      return { id, type, data: { columns: DEFAULT_ROW_COLUMNS, children: [] } };
  }
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  video: 'Video',
  list: 'List',
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  callout: 'Callout',
  row: 'Row',
};

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
    case 'text':
      return block.data.html;
    case 'image': {
      const caption = block.data.caption
        ? `<figcaption>${block.data.caption}</figcaption>`
        : '';
      return `<figure><img src="${block.data.url}" alt="${block.data.alt}" />${caption}</figure>`;
    }
    case 'video':
      return `<video src="${block.data.url}" controls></video>`;
    case 'list': {
      const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
      const items = block.data.items.map((item) => `<li>${item}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'callout': {
      const title = block.data.title ? `<strong>${block.data.title}</strong> ` : '';
      return `<aside class="callout callout-${block.data.variant}">${title}${calloutBodyHtml(block.data.body)}</aside>`;
    }
    case 'row': {
      const cells = block.data.children
        .map((p) => `<div style="grid-column: ${p.colStart} / span ${p.colSpan}">${blockToHtml(p.block)}</div>`)
        .join('');
      return `<div class="row" style="display:grid;grid-template-columns:repeat(${block.data.columns},1fr);gap:16px">${cells}</div>`;
    }
    case 'multiple_choice':
      return `<p><strong>${block.data.question}</strong></p>`;
    case 'true_false':
      return `<p><strong>${block.data.question}</strong></p>`;
    case 'short_answer':
      return `<p><strong>${block.data.question}</strong></p>`;
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join('\n');
}

// Plain-text extraction for text-to-speech — quiz blocks are skipped since
// question/answer content isn't meant to be read aloud as prose.
function blockToSpeechText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.data.text;
    case 'text':
      return stripHtml(block.data.html);
    case 'image':
      return block.data.caption ?? '';
    case 'video':
      return block.data.caption ?? '';
    case 'list':
      return block.data.items.filter(Boolean).join('. ');
    case 'callout':
      // Read aloud as words, not as markup, now that the body carries tags.
      return [block.data.title, stripHtml(calloutBodyHtml(block.data.body))]
        .filter(Boolean)
        .join('. ');
    case 'row':
      return block.data.children.map((p) => blockToSpeechText(p.block)).filter(Boolean).join('. ');
    case 'multiple_choice':
    case 'true_false':
    case 'short_answer':
      return '';
  }
}

export function sectionToSpeechText(section: Section): string {
  return [section.title, section.description, ...section.blocks.map(blockToSpeechText)]
    .filter(Boolean)
    .join('. ');
}
