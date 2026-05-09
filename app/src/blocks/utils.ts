import type { Block, BlockType, QuizBlock, Section } from '../types';

let blockCounter = 0;
let sectionCounter = 0;

export function generateBlockId(): string {
  return `block-${Date.now()}-${blockCounter++}`;
}

export function isQuizBlock(block: Block): block is QuizBlock {
  return block.type === 'multiple_choice' || block.type === 'true_false';
}

export function parseSections(raw: string | undefined): Section[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // New Section[] format has a 'blocks' property on each element
    if ('blocks' in parsed[0]) {
      return parsed as Section[];
    }

    // Old flat Block[] — migrate to a single section
    const allBlocks = parsed as Block[];
    return [{
      id: `section-${Date.now()}-migrated`,
      heroImage: '',
      title: '',
      description: '',
      blocks: allBlocks.filter((b) => !isQuizBlock(b)),
      quizTitle: '',
      passingPercentage: 80,
      quizBlocks: allBlocks.filter(isQuizBlock) as QuizBlock[],
    }];
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
};

export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
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
        case 'multiple_choice':
          return `<p><strong>${block.data.question}</strong></p>`;
        case 'true_false':
          return `<p><strong>${block.data.question}</strong></p>`;
      }
    })
    .join('\n');
}
