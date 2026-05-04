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
  module_blocks: string; // JSON-encoded Block[]
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

export type Block = HeadingBlock | TextBlock | ImageBlock | VideoBlock | ListBlock | MultipleChoiceBlock | TrueFalseBlock;

export type BlockType = Block['type'];

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizResponse {
  blockId: string;
  answer: string;
  isCorrect: boolean | null;
}
