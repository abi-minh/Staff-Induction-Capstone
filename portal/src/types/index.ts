// ─── WordPress context injected via wp_localize_script ───────────────────────

export interface WPContext {
  nonce: string;
  restUrl: string;
  currentUser: WPUser;
}

declare global {
  interface Window {
    InductionPortal: WPContext;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface WPUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  avatarUrl: string;
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export interface Module {
  id: number;
  title: string;          // rendered HTML string from WP
  content: string;        // rendered HTML string from WP
  excerpt: string;
  status: 'publish' | 'draft';
  date: string;
  modified: string;
  meta: ModuleMeta;
}

export interface ModuleMeta {
  module_role_targets: string[];
  module_estimated_minutes: number;
  module_order: number;
  module_blocks: string; // JSON-encoded Block[]
}

// ─── Documents (Reference Library) ───────────────────────────────────────────

export interface Document {
  id: number;
  title: string;
  status: 'publish' | 'draft';
  date: string;
  meta: DocumentMeta;
  fileUrl?: string;       // resolved at query time from attachment ID
}

export interface DocumentMeta {
  document_category: string;
  document_file_id: number;
  document_role_targets: string[];
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProgressRecord {
  id: number;
  userId: number;
  moduleId: number;
  status: ProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  timeSpent: number; // seconds
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export interface Assignment {
  moduleId: number;
  dueDate: string | null;
}

// ─── API response shape from custom endpoints ─────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}

export interface WPRestError {
  code: string;
  message: string;
  data: { status: number };
}

// ─── Blocks (Page Builder) ───────────────────────────────────────────────────

export type HeadingLevel = 1 | 2 | 3 | 4;
export type ListStyle = 'ordered' | 'unordered';

export interface HeadingBlock {
  id: string;
  type: 'heading';
  data: { level: HeadingLevel; text: string };
}

export interface TextBlock {
  id: string;
  type: 'text';
  data: { html: string };
}

export interface ImageBlock {
  id: string;
  type: 'image';
  data: { mediaId: number; url: string; alt: string; caption: string };
}

export interface VideoBlock {
  id: string;
  type: 'video';
  data: { mediaId: number; url: string; caption: string };
}

export interface ListBlock {
  id: string;
  type: 'list';
  data: { style: ListStyle; items: string[] };
}

export interface MultipleChoiceBlock {
  id: string;
  type: 'multiple_choice';
  data: {
    question: string;
    options: string[];
    explanation: string;
  };
}

export interface TrueFalseBlock {
  id: string;
  type: 'true_false';
  data: {
    question: string;
    explanation: string;
  };
}

export type Block = HeadingBlock | TextBlock | ImageBlock | VideoBlock | ListBlock | MultipleChoiceBlock | TrueFalseBlock;

export type BlockType = Block['type'];

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizResponse {
  blockId: string;
  answer: string;
  isCorrect: boolean | null;
}
