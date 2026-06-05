import client from './client';
import type { ProgressRecord, ProgressStatus } from '../types';

interface WPProgressRecord {
  id: number;
  user_id: number;
  module_id: number;
  status: ProgressStatus;
  started_at: string | null;
  completed_at: string | null;
  time_spent: number;
}

function normalise(r: WPProgressRecord): ProgressRecord {
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

export async function fetchUserProgress(userId: number): Promise<ProgressRecord[]> {
  const { data } = await client.get<WPProgressRecord[]>(
    `induction/v1/progress/user/${userId}`
  );
  return data.map(normalise);
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
  return normalise(data);
}
