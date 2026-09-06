import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchModuleVersions, restoreModuleVersion } from '../api/moduleVersions';

// `enabled` lets the history panel fetch only when it's actually opened.
export function useModuleVersions(moduleId: number, enabled = true) {
  return useQuery({
    queryKey: ['moduleVersions', moduleId],
    queryFn: () => fetchModuleVersions(moduleId),
    enabled: enabled && moduleId > 0,
    staleTime: 0,
  });
}

export function useRestoreModuleVersion(moduleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => restoreModuleVersion(moduleId, version),
    onSuccess: () => {
      // Restoring appends a version and changes the module, so both the history
      // and the module itself are stale.
      qc.invalidateQueries({ queryKey: ['moduleVersions', moduleId] });
      qc.invalidateQueries({ queryKey: ['module', moduleId] });
      qc.invalidateQueries({ queryKey: ['modules'] });
    },
  });
}
