// ─── WordPress context injected via wp_localize_script ───────────────────────

declare global {
  interface Window {
    InductionApp?: { restUrl: string };
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthToken {
  token: string;
  userEmail: string;
  userNicename: string;
  userDisplayName: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export type PostStatus = 'publish' | 'draft';

export interface Module {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  status: PostStatus;
  date: string;
  modified: string;
  meta: ModuleMeta;
  heroImageUrl?: string;
}

export interface ModuleMeta {
  module_role_targets: string[];
  module_estimated_minutes: number;
  module_order: number;
  module_blocks: string; // JSON-encoded Section[]
  module_icon: string;
  module_hero_image: number;
}

export interface ModuleFormValues {
  title: string;
  content: string;
  excerpt: string;
  status: PostStatus;
  module_role_targets: string[];
  module_estimated_minutes: number;
  module_order: number;
  module_blocks?: string;
  module_icon: string;
  module_hero_image: number;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  title: string;
  status: PostStatus;
  date: string;
  meta: DocumentMeta;
  fileUrl?: string;
}

export interface DocumentMeta {
  document_category: string;
  document_file_id: number;
  document_role_targets: string[];
}

export interface DocumentFormValues {
  title: string;
  status: PostStatus;
  document_category: string;
  document_role_targets: string[];
  document_file_id: number;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  roles: string[];
  avatarUrl: string;
}

export interface Assignment {
  moduleId: number;
  userId: number;
  dueDate: string | null;
  assignedAt: string;
  assignedBy: number;
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
  timeSpent: number;
  score: number | null;
  passed: boolean | null;
  quizSubmittedAt: string | null;
}

// ─── Quiz review (admin grading of the module-level quiz) ────────────────────

export interface PendingQuizReview {
  userId: number;
  userName: string;
  moduleId: number;
  moduleTitle: string;
  quizSubmittedAt: string;
}

export interface QuizReviewQuestion {
  blockId: string;
  type: 'multiple_choice' | 'true_false';
  question: string;
  options: string[] | null;
  correctIndex: number | null;
  correctAnswer: boolean | null;
  explanation: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
}

export interface QuizReviewDetail {
  questions: QuizReviewQuestion[];
  quizSubmittedAt: string | null;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ModuleCompletionReport {
  moduleId: number;
  moduleTitle: string;
  totalAssigned: number;
  totalCompleted: number;
  completionPct: number;
  staffBreakdown: {
    userId: number;
    name: string;
    status: ProgressStatus;
    completedAt: string | null;
  }[];
}

export interface ReportSummary {
  totalModules: number;
  totalStaff: number;
  overallCompletionPct: number;
  moduleReports: ModuleCompletionReport[];
  completionOverTime: { date: string; completed: number }[];
}

// ─── WP Media ─────────────────────────────────────────────────────────────────

export interface WPMedia {
  id: number;
  sourceUrl: string;
  mimeType: string;
  title: string;
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
    correctIndex: number;
    explanation: string;
  };
}

export interface TrueFalseBlock {
  id: string;
  type: 'true_false';
  data: {
    question: string;
    correctAnswer: boolean;
    explanation: string;
  };
}

export type CalloutVariant = 'info' | 'warning' | 'success' | 'note';

export interface CalloutBlock {
  id: string;
  type: 'callout';
  data: {
    variant: CalloutVariant;
    title?: string;
    body: string;
  };
}

// A non-row, non-quiz content block placed inside a row at a specific column.
export type RowChildBlock = HeadingBlock | TextBlock | ImageBlock | VideoBlock | ListBlock | CalloutBlock;

export interface PlacedBlock {
  block:    RowChildBlock;
  colStart: number;  // 1-indexed
  colSpan:  number;  // ≥ 1, ≤ columns - colStart + 1
}

export interface RowBlock {
  id: string;
  type: 'row';
  data: {
    columns:  number;          // MIN_ROW_COLUMNS..MAX_ROW_COLUMNS
    children: PlacedBlock[];   // ordered left-to-right by colStart
  };
}

export const MIN_ROW_COLUMNS = 2;
export const MAX_ROW_COLUMNS = 6;
export const DEFAULT_ROW_COLUMNS = 3;

export const ROW_COLUMN_PRESETS: { label: string; columns: number }[] = [
  { label: 'Halves',   columns: 2 },
  { label: 'Thirds',   columns: 3 },
  { label: 'Quarters', columns: 4 },
];

export type Block =
  | HeadingBlock | TextBlock | ImageBlock | VideoBlock | ListBlock
  | MultipleChoiceBlock | TrueFalseBlock
  | CalloutBlock | RowBlock;

export type BlockType = Block['type'];

export type QuizBlock = MultipleChoiceBlock | TrueFalseBlock;

export interface Section {
  id: string;
  heroImage: string;
  title: string;
  description: string;
  blocks: Block[];
  quizTitle: string;
  passingPercentage: number;
  quizBlocks: QuizBlock[];
  // When true, this section's quizBlocks are the module-level quiz — gated
  // behind completion of every other section. At most one section per module.
  isModuleQuiz?: boolean;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizResponse {
  blockId: string;
  answer: string;
  isCorrect: boolean | null;
}
