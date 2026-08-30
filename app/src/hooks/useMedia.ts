import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMedia, deleteMedia } from '../api/media';

export function useMedia() {
  return useQuery({ queryKey: ['media'], queryFn: fetchMedia, staleTime: 1000 * 60 });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMedia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media'] });
    },
  });
}
