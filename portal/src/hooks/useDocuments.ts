import { useQuery } from '@tanstack/react-query';
import { fetchDocuments } from '../api/documents';

export function useDocuments(search?: string) {
  return useQuery({
    queryKey: ['documents', search ?? ''],
    queryFn: () => fetchDocuments(search),
    staleTime: 1000 * 60 * 5,
    keepPreviousData: true,
  });
}
