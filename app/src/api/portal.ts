// Staff-facing portal APIs — used by both staff users and admin preview mode.

import client from './client';
import type { Module, ProgressRecord, ProgressStatus, Document, QuizResponse, TeamMember } from '../types';
import { stripHtml } from '../util/strings';
import { mediaTypeFromMime } from '../util/mediaType';

interface WPPortalModule {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: 'publish' | 'draft';
  date: string;
  modified: string;
  hero_image_url?: string;
  image_sources?: Record<string, { srcset: string; sizes: string }>;
  meta: {
    module_role_targets: string[];
    module_estimated_minutes: number;
    module_order: number;
    module_duration_days: number;
    module_blocks: string;
    module_icon: string;
    module_hero_image: number;
  };
}

interface WPProgressRecord {
  id: number;
  completed_sections?: string[];
  user_id: number;
  module_id: number;
  status: ProgressStatus;
  started_at: string | null;
  completed_at: string | null;
  time_spent: number;
  score: number | null;
  passed: boolean | null;
  quiz_submitted_at: string | null;
}

interface WPDocument {
  id: number;
  title: { rendered: string };
  status: 'publish' | 'draft';
  date: string;
  meta: {
    document_category: string;
    document_file_id: number;
    document_role_targets: string[];
  };
}

interface WPMedia {
  source_url: string;
  mime_type: string;
}

function normaliseModule(wp: WPPortalModule): Module {
  return {
    id: wp.id,
    title: wp.title.rendered,
    content: wp.content.rendered,
    excerpt: wp.excerpt.rendered,
    status: wp.status,
    date: wp.date,
    modified: wp.modified,
    heroImageUrl: wp.hero_image_url ?? '',
    imageSources: wp.image_sources ?? {},
    meta: {
      module_role_targets: wp.meta.module_role_targets ?? [],
      module_estimated_minutes: wp.meta.module_estimated_minutes ?? 0,
      module_order: wp.meta.module_order ?? 0,
      module_duration_days: wp.meta.module_duration_days ?? 0,
      module_blocks: wp.meta.module_blocks ?? '[]',
      module_icon: wp.meta.module_icon ?? '',
      module_hero_image: wp.meta.module_hero_image ?? 0,
    },
  };
}

function normaliseProgress(r: WPProgressRecord): ProgressRecord {
  return {
    id: r.id,
    userId: r.user_id,
    moduleId: r.module_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    timeSpent: r.time_spent,
    score: r.score,
    passed: r.passed,
    quizSubmittedAt: r.quiz_submitted_at,
    completedSections: r.completed_sections ?? [],
  };
}

// The mime type comes back in the same request as the URL, so naming the
// file's kind on screen costs nothing extra.
async function resolveFile(attachmentId: number): Promise<{ url?: string; mime?: string }> {
  if (!attachmentId) return {};
  try {
    const { data } = await client.get<WPMedia>(`wp/v2/media/${attachmentId}`);
    return { url: data.source_url, mime: data.mime_type };
  } catch {
    return {};
  }
}

export async function fetchAssignedModules(userId: number): Promise<Module[]> {
  const { data } = await client.get<WPPortalModule[]>(
    `induction/v1/assignments/user/${userId}`
  );
  return data.map(normaliseModule).sort((a, b) => a.meta.module_order - b.meta.module_order);
}

export async function fetchPortalModule(id: number): Promise<Module> {
  const { data } = await client.get<WPPortalModule>(`wp/v2/induction_module/${id}`);
  return normaliseModule(data);
}

export async function fetchUserProgress(userId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/user/${userId}`
  );
  return data.map(normaliseProgress);
}

export async function upsertProgress(
  userId: number,
  moduleId: number,
  status: ProgressStatus,
  timeSpent?: number
): Promise<ProgressRecord> {
  const { data } = await client.post<WPProgressRecord>('induction/v1/progress', {
    user_id: userId,
    module_id: moduleId,
    status,
    time_spent: timeSpent ?? 0,
  });
  return normaliseProgress(data);
}

export async function saveQuizAnswer(
  userId: number,
  moduleId: number,
  blockId: string,
  answer: string
): Promise<void> {
  await client.post('induction/v1/quiz/save', {
    user_id: userId,
    module_id: moduleId,
    block_id: blockId,
    answer,
  });
}

export interface QuizCheckResult {
  /** null for a short answer: recorded, deliberately not judged. */
  isCorrect: boolean | null;
  /** What a complete short answer covers. Absent for graded question types. */
  guidance?: string;
  explanation: string;
}

export async function checkQuizAnswer(
  userId: number,
  moduleId: number,
  blockId: string,
  answer: string
): Promise<QuizCheckResult> {
  const { data } = await client.post<QuizCheckResult>('induction/v1/quiz/check', {
    user_id: userId,
    module_id: moduleId,
    block_id: blockId,
    answer,
  });
  return data;
}

export async function submitQuizForReview(
  userId: number,
  moduleId: number
): Promise<ProgressRecord> {
  const { data } = await client.post<WPProgressRecord>('induction/v1/quiz/submit-for-review', {
    user_id: userId,
    module_id: moduleId,
  });
  return normaliseProgress(data);
}

export async function fetchQuizResponses(
  userId: number,
  moduleId: number
): Promise<QuizResponse[]> {
  const { data } = await client.get<QuizResponse[]>(
    `induction/v1/quiz/responses/user/${userId}/module/${moduleId}`
  );
  return data;
}

export async function fetchPortalDocuments(search?: string): Promise<Document[]> {
  const params: Record<string, string | number> = {
    per_page: 100,
    status: 'publish',
  };
  if (search) params.search = search;

  const { data } = await client.get<WPDocument[]>('wp/v2/induction_document', { params });

  const resolved = await Promise.all(
    data.map(async (wp) => {
      const file = await resolveFile(wp.meta.document_file_id);
      return {
        id: wp.id,
        // Flattened, not raw: this is shown as text, and WordPress returns a
        // texturised title, so "Do's and Don'ts" arrives as character
        // references and would be read out literally.
        title: stripHtml(wp.title.rendered),
        fileType: mediaTypeFromMime(file.mime),
        status: wp.status,
        date: wp.date,
        meta: {
          document_category: wp.meta.document_category ?? '',
          document_file_id: wp.meta.document_file_id ?? 0,
          document_role_targets: wp.meta.document_role_targets ?? [],
        },
        fileUrl: file.url,
      } as Document;
    })
  );

  // A document whose attachment has gone — deleted from the media library,
  // or never attached — renders as a card with nothing to open. There is
  // nothing a staff member can do with one, so it is left out rather than
  // shown as a dead end. The record still appears on the admin Documents
  // screen, which is where it can be repointed or removed.
  return resolved.filter((doc) => Boolean(doc.fileUrl));
}

interface WPTeamMember {
  id: number;
  name: string;
  roleLabel: string;
  region: string;
  photoUrl: string;
  bio: string;
  isOwner: boolean;
  contactEmail: string;
  contactPhone: string;
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data } = await client.get<WPTeamMember[]>('induction/v1/team');
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    roleLabel: t.roleLabel ?? '',
    region: t.region ?? '',
    photoUrl: t.photoUrl ?? '',
    bio: t.bio ?? '',
    isOwner: t.isOwner ?? false,
    contactEmail: t.contactEmail ?? '',
    contactPhone: t.contactPhone ?? '',
  }));
}

/**
 * Replace the set of sections this person has worked through.
 *
 * Sends the whole set rather than one id: unmarking needs no second endpoint,
 * and a dropped response cannot leave client and server disagreeing about
 * which sections are done.
 */
export async function setCompletedSections(
  userId: number,
  moduleId: number,
  sectionIds: string[],
): Promise<ProgressRecord> {
  const { data } = await client.post<WPProgressRecord>('induction/v1/progress/sections', {
    user_id: userId,
    module_id: moduleId,
    section_ids: sectionIds,
  });
  return normaliseProgress(data);
}
