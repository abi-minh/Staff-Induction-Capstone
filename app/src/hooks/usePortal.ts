import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import {
  fetchAssignedModules,
  fetchPortalModule,
  fetchUserProgress,
  upsertProgress,
  fetchPortalDocuments,
} from '../api/portal';
import type { ProgressRecord } from '../types';

export function useAssignedModules() {
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    queryKey: ['portal', 'modules', 'assigned', userId],
    queryFn: () => fetchAssignedModules(userId),
    enabled: userId > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePortalModule(id: number) {
  return useQuery({
    queryKey: ['portal', 'module', id],
    queryFn: () => fetchPortalModule(id),
    staleTime: 1000 * 60 * 10,
  });
}

export function useUserProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    queryKey: ['portal', 'progress', userId],
    queryFn: () => fetchUserProgress(userId),
    enabled: userId > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export function useModuleProgress(moduleId: number): ProgressRecord | undefined {
  const { data } = useUserProgress();
  return data?.find((p) => p.moduleId === moduleId);
}

export function useMarkComplete() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? 0);

  return useMutation({
    mutationFn: ({ moduleId, timeSpent }: { moduleId: number; timeSpent: number }) =>
      upsertProgress(userId, moduleId, 'completed', timeSpent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'progress', userId] });
    },
  });
}

export function usePortalDocuments(search?: string) {
  return useQuery({
    queryKey: ['portal', 'documents', search ?? ''],
    queryFn: () => fetchPortalDocuments(search),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true,
  });
}
