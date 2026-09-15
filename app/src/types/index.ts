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

export type PostStatus = "publish" | "draft";

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
  module_duration_days: number;
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
  module_duration_days: number;
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
  username: string;
  email: string;
  roles: string[];
  avatarUrl: string;
  firstName: string;
  lastName: string;
  dob: string;
  suburb: string;
  address: string;
  // One photo per person: the account page, the staff list avatar and the
  // Meet Our Team card all read this.
  profilePhotoUrl: string;
  teamPhotoUrl: string;
  teamTitle: string;
  teamRegion: string;
  teamBio: string;
  teamVisible: boolean;
  teamIsOwner: boolean;
  teamContactEmail: string;
  teamContactPhone: string;
}

export interface Role {
  value: string;
  label: string;
}

// A published "Meet Our Team" entry, as seen by any staff member on the portal.
// roleLabel is the free-text job title from the team profile, not a rendering of
// the member's WP roles — the two are deliberately unrelated.
export interface TeamMember {
  id: number;
  name: string;
  roleLabel: string;
  region: string;
  photoUrl: string;
  bio: string;
  isOwner: boolean;
  // Public business contact details, admin-maintained and only ever populated
  // for the featured owner.
  contactEmail: string;
  contactPhone: string;
}

// ─── Class locations ────────────────────────────────────────────────────────

// Palette key, not a CSS colour — resolved to a hex value in LocationMap and
// validated against INDUCTION_LOCATION_MARKER_COLORS in the plugin PHP.
export type MarkerColor = 'red' | 'amber' | 'blue' | 'green';

export interface LocationMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: MarkerColor;
}

// A line drawn on the map — "swim out to here", "walk around this way".
// Rendered dashed, so it reads as a route rather than a boundary.
export interface LocationPath {
  id: string;
  label: string;
  color: MarkerColor;
  points: [number, number][];
}

// Named ClassLocation rather than Location: the DOM already has a global of
// that name and shadowing it in a file that also uses react-router's useLocation
// is a trap worth avoiding.
export interface ClassLocation {
  id: number;
  title: string;
  status: 'publish' | 'draft';
  address: string;
  lat: number;
  lng: number;
  zoom: number;
  thumbnailId: number;
  thumbnailUrl: string;
  notes: string;
  markers: LocationMarker[];
  paths: LocationPath[];
}

export interface LocationFormValues {
  title: string;
  status: 'publish' | 'draft';
  address: string;
  lat: number;
  lng: number;
  zoom: number;
  thumbnailId: number;
  notes: string;
  markers: LocationMarker[];
  paths: LocationPath[];
}

export interface NewStaffInput {
  name: string;
  username: string;
  email: string;
  role: string;
  password: string;
}

export interface Assignment {
  moduleId: number;
  userId: number;
  dueDate: string | null;
  assignedAt: string;
  assignedBy: number;
}

export interface AssignmentRecord {
  moduleId: number;
  assignedAt: string;
  dueDate: string | null;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type ProgressStatus = "not_started" | "in_progress" | "completed";

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
  type: "multiple_choice" | "true_false" | "short_answer";
  question: string;
  options: string[] | null;
  correctIndex: number | null;
  correctAnswer: boolean | null;
  correctText: string | null;
  explanation: string;
  imageUrl: string | null;
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
    roles: string[];
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

export interface OverdueItem {
  userId: number;
  userName: string;
  moduleId: number;
  moduleTitle: string;
  dueDate: string;
  notCompletedCount: number;
}

// ─── WP Media ─────────────────────────────────────────────────────────────────

export interface WPMedia {
  id: number;
  sourceUrl: string;
  mimeType: string;
  title: string;
}

export type MediaType = "image" | "video" | "pdf" | "other";

export interface MediaUsage {
  kind: "module" | "document";
  id: number;
  title: string;
  where?: string;
}

export interface MediaItem {
  id: number;
  filename: string;
  url: string;
  mime: string;
  type: MediaType;
  size: number;
  uploadedAt: string;
  usage: MediaUsage[];
}

// ─── Blocks (Page Builder) ───────────────────────────────────────────────────

export type HeadingLevel = 1 | 2 | 3 | 4;
export type ListStyle = "ordered" | "unordered";

export type BlockAlign = "left" | "center" | "right";

export interface BlockLayout {
  align?: BlockAlign;
  width?: number;
}

export const MIN_BLOCK_WIDTH = 15;

export interface HeadingBlock {
  id: string;
  type: "heading";
  data: { level: HeadingLevel; text: string };
  layout?: BlockLayout;
  textAlign?: BlockAlign;
}

export interface TextBlock {
  id: string;
  type: "text";
  data: { html: string };
  layout?: BlockLayout;
  textAlign?: BlockAlign;
}

export interface ImageBlock {
  id: string;
  type: "image";
  data: {
    mediaId: number;
    url: string;
    alt: string;
    caption: string;
    width?: number;
  };
  layout?: BlockLayout;
}

export interface VideoBlock {
  id: string;
  type: "video";
  data: { mediaId: number; url: string; caption: string };
  layout?: BlockLayout;
}

export interface ListBlock {
  id: string;
  type: "list";
  data: { style: ListStyle; items: string[] };
  layout?: BlockLayout;
}

export interface MultipleChoiceBlock {
  id: string;
  type: "multiple_choice";
  data: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    imageMediaId?: number;
    imageUrl?: string;
  };
}

export interface TrueFalseBlock {
  id: string;
  type: "true_false";
  data: {
    question: string;
    correctAnswer: boolean;
    explanation: string;
  };
}

export interface ShortAnswerBlock {
  id: string;
  type: "short_answer";
  data: {
    question: string;
    correctAnswer: string;
    explanation: string;
  };
}

export type CalloutVariant = "info" | "warning" | "success" | "note";

export interface CalloutBlock {
  id: string;
  type: "callout";
  data: {
    variant: CalloutVariant;
    title?: string;
    body: string;
  };
  layout?: BlockLayout;
}

// A non-row, non-quiz content block placed inside a row at a specific column.
export type RowChildBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | ListBlock
  | CalloutBlock;

export interface PlacedBlock {
  block: RowChildBlock;
  colStart: number; // 1-indexed
  colSpan: number; // ≥ 1, ≤ columns - colStart + 1
}

export interface RowBlock {
  id: string;
  type: "row";
  data: {
    columns: number; // MIN_ROW_COLUMNS..MAX_ROW_COLUMNS
    children: PlacedBlock[]; // ordered left-to-right by colStart
  };
  layout?: BlockLayout;
}

export const MIN_ROW_COLUMNS = 2;
export const MAX_ROW_COLUMNS = 6;
export const DEFAULT_ROW_COLUMNS = 3;

export const ROW_COLUMN_PRESETS: { label: string; columns: number }[] = [
  { label: "Halves", columns: 2 },
  { label: "Thirds", columns: 3 },
  { label: "Quarters", columns: 4 },
];

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | ListBlock
  | MultipleChoiceBlock
  | TrueFalseBlock
  | ShortAnswerBlock
  | CalloutBlock
  | RowBlock;

export type BlockType = Block["type"];

export type QuizBlock = MultipleChoiceBlock | TrueFalseBlock | ShortAnswerBlock;

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
  // Section content visibility to staff, independent of the module's own
  // publish state. Undefined means 'publish' (legacy sections predate this).
  status?: PostStatus;
  // Quiz visibility, independent of `status` — content can go live while the
  // quiz is still being drafted, or vice versa. Undefined means 'publish'.
  quizStatus?: PostStatus;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface QuizResponse {
  blockId: string;
  answer: string;
  isCorrect: boolean | null;
}
