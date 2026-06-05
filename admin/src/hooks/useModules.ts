import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchModules, fetchModule, createModule, updateModule, deleteModule } from '../api/modules';
import type { ModuleFormValues } from '../types';

export function useModules() {
  return useQuery({ queryKey: ['modules'], queryFn: fetchModules, staleTime: 1000 * 60 * 2 });
}

export function useModule(id: number) {
  return useQuery({ queryKey: ['module', id], queryFn: () => fetchModule(id), enabled: id > 0 });
}

export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ModuleFormValues) => createModule(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules'] }),
  });
}

export function useUpdateModule(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<ModuleFormValues>) => updateModule(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modules'] });
      qc.invalidateQueries({ queryKey: ['module', id] });
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteModule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules'] }),
  });
}
