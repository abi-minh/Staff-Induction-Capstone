import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAssignedModules, fetchModule } from '../api/modules';
import { upsertProgress } from '../api/progress';
import { usePortalStore } from '../store/portalStore';

export function useAssignedModules() {
  const userId = usePortalStore((s) => s.user.id);
  return useQuery({
    queryKey: ['modules', 'assigned', userId],
    queryFn: () => fetchAssignedModules(userId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useModule(id: number) {
  return useQuery({
    queryKey: ['module', id],
    queryFn: () => fetchModule(id),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMarkComplete() {
  const queryClient = useQueryClient();
  const userId = usePortalStore((s) => s.user.id);

  return useMutation({
    mutationFn: ({
      moduleId,
      timeSpent,
    }: {
      moduleId: number;
      timeSpent: number;
    }) => upsertProgress(userId, moduleId, 'completed', timeSpent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', userId] });
    },
  });
}
