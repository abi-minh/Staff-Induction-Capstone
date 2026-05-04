import client from './client';
import type { StaffMember, ProgressRecord } from '../types';

interface WPUser {
  id: number;
  name: string;
  slug: string;
  avatar_urls: Record<string, string>;
  roles: string[];
  user_email?: string;
}

function normaliseUser(wp: WPUser): StaffMember {
  return {
    id: wp.id,
    name: wp.name,
    email: wp.user_email ?? '',
    roles: wp.roles ?? [],
    avatarUrl: wp.avatar_urls?.['48'] ?? wp.avatar_urls?.['96'] ?? '',
  };
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data } = await client.get<WPUser[]>('wp/v2/users', {
    params: { per_page: 100, roles: 'staff', context: 'edit' },
  });
  return data.map(normaliseUser);
}

export async function fetchStaffMember(id: number): Promise<StaffMember> {
  const { data } = await client.get<WPUser>(`wp/v2/users/${id}`, {
    params: { context: 'edit' },
  });
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

interface WPProgressRecord {
  id: number;
  user_id: number;
  module_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  time_spent: number;
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
