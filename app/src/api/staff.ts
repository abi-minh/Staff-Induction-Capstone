import client from './client';
import type { StaffMember, ProgressRecord } from '../types';

interface InductionUser {
  id: number;
  name: string;
  slug: string;
  email: string;
  roles: string[];
  avatar_urls: Record<string, string>;
}

function normaliseUser(u: InductionUser): StaffMember {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? '',
    roles: u.roles ?? [],
    avatarUrl: u.avatar_urls?.['48'] ?? u.avatar_urls?.['96'] ?? '',
  };
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data } = await client.get<InductionUser[]>('induction/v1/staff');
  return data.map(normaliseUser);
}

export async function fetchStaffMember(id: number): Promise<StaffMember> {
  const { data } = await client.get<InductionUser>(`induction/v1/staff/${id}`);
  return normaliseUser(data);
}

export async function bulkAssign(
  moduleId: number,
  userIds: number[],
  dueDate?: string
): Promise<{ assigned: number }> {
  const { data } = await client.post<{ assigned: number }>('induction/v1/assignments/bulk', {
    module_id: moduleId,
    user_ids: userIds,
    due_date: dueDate ?? null,
  });
  return data;
}

export async function unassign(
  moduleId: number,
  userIds: number[]
): Promise<{ removed: number }> {
  const { data } = await client.post<{ removed: number }>('induction/v1/assignments/remove', {
    module_id: moduleId,
    user_ids: userIds,
  });
  return data;
}

interface WPProgressRecord {
  id: number;
  user_id: number;
  module_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  time_spent: number;
  score: number | null;
  passed: boolean | null;
  quiz_submitted_at: string | null;
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

export async function fetchStaffProgress(userId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/user/${userId}`
  );
  return data.map(normaliseProgress);
}

export async function fetchModuleProgress(moduleId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/module/${moduleId}`
  );
  return data.map(normaliseProgress);
}
