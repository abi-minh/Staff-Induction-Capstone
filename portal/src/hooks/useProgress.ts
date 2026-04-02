import { useQuery } from '@tanstack/react-query';
import { fetchUserProgress } from '../api/progress';
import { usePortalStore } from '../store/portalStore';
import type { ProgressRecord } from '../types';

export function useProgress() {
  const userId = usePortalStore((s) => s.user.id);
  return useQuery({
    queryKey: ['progress', userId],
    queryFn: () => fetchUserProgress(userId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useModuleProgress(moduleId: number): ProgressRecord | undefined {
  const { data } = useProgress();
  return data?.find((p) => p.moduleId === moduleId);
}
