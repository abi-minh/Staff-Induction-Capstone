import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchResourceCategories,
  createResourceCategory,
  renameResourceCategory,
  deleteResourceCategory,
  setMediaCategory,
  setResourceCategoryVisibility,
} from '../api/resourceCategories';

export function useResourceCategories() {
  return useQuery({
    queryKey: ['resourceCategories'],
    queryFn: fetchResourceCategories,
    staleTime: 1000 * 60 * 5,
  });
}

// Every mutation here changes the counts the list carries, so they all
// invalidate the list itself as well as whatever they touched.
export function useCreateResourceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createResourceCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resourceCategories'] }),
  });
}

export function useRenameResourceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, name }: { value: string; name: string }) =>
      renameResourceCategory(value, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resourceCategories'] });
      qc.invalidateQueries({ queryKey: ['media'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteResourceCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => deleteResourceCategory(value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resourceCategories'] }),
  });
}

export function useSetResourceCategoryVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, hidden }: { value: string; hidden: boolean }) =>
      setResourceCategoryVisibility(value, hidden),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resourceCategories'] });
      // What staff can see has changed, so an open portal must not keep
      // showing a shelf that has been taken down.
      qc.invalidateQueries({ queryKey: ['portal', 'documents'] });
    },
  });
}

export function useSetMediaCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: number; category: string }) =>
      setMediaCategory(id, category),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['portal', 'documents'] });
      qc.invalidateQueries({ queryKey: ['resourceCategories'] });
    },
  });
}
