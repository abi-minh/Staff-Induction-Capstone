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
