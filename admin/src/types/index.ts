// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  name: string;
  email?: string;
  roles: string[];
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export type PostStatus = 'publish' | 'draft';

export interface Module {
  id: number;
  title: string;
  content: string;   // HTML
  excerpt: string;
  status: PostStatus;
  date: string;
  modified: string;
  meta: ModuleMeta;
}

export interface ModuleMeta {
  module_role_targets: string[];
  module_estimated_minutes: number;
  module_order: number;
}

export interface ModuleFormValues {
  title: string;
  content: string;
  excerpt: string;
  status: PostStatus;
  module_role_targets: string[];
  module_estimated_minutes: number;
  module_order: number;
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
