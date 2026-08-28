// Staff-facing portal APIs — used by both staff users and admin preview mode.

import client from './client';
import type { Module, ProgressRecord, ProgressStatus, Document, QuizResponse, TeamMember } from '../types';

interface WPPortalModule {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: 'publish' | 'draft';
  date: string;
  modified: string;
  hero_image_url?: string;
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
  };
}

async function resolveFileUrl(attachmentId: number): Promise<string | undefined> {
  if (!attachmentId) return undefined;
  try {
    const { data } = await client.get<WPMedia>(`wp/v2/media/${attachmentId}`);
    return data.source_url;
  } catch {
    return undefined;
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
  isCorrect: boolean;
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

  return Promise.all(
    data.map(async (wp) => {
      const fileUrl = await resolveFileUrl(wp.meta.document_file_id);
      return {
        id: wp.id,
        title: wp.title.rendered,
        status: wp.status,
        date: wp.date,
        meta: {
          document_category: wp.meta.document_category ?? '',
          document_file_id: wp.meta.document_file_id ?? 0,
          document_role_targets: wp.meta.document_role_targets ?? [],
        },
        fileUrl,
      } as Document;
    })
  );
}

interface WPTeamMember {
  id: number;
  name: string;
  roleLabel: string;
  region: string;
  photoUrl: string;
  bio: string;
  isOwner: boolean;
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
  }));
}
