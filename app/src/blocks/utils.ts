import {
  DEFAULT_ROW_COLUMNS,
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
} from '../types';
import type {
  Block, BlockType, PlacedBlock, QuizBlock, RowBlock, RowChildBlock, Section,
} from '../types';
import { stripHtml } from '../util/strings';

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

export function createSection(): Section {
  return {
    id: `section-${Date.now()}-${sectionCounter++}`,
    heroImage: '',
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
      return { id, type, data: { question: '', correctAnswer: '', explanation: '' } };
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
      return `<aside class="callout callout-${block.data.variant}">${title}${block.data.body}</aside>`;
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
      return [block.data.title, block.data.body].filter(Boolean).join('. ');
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
