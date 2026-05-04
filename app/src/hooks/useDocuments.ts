import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDocuments, createDocument, updateDocument, deleteDocument, uploadMedia } from '../api/documents';
import type { DocumentFormValues } from '../types';

export function useDocuments() {
  return useQuery({ queryKey: ['documents'], queryFn: fetchDocuments, staleTime: 1000 * 60 * 2 });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: DocumentFormValues) => createDocument(values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocument(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<DocumentFormValues>) => updateDocument(id, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUploadMedia() {
  return useMutation({ mutationFn: (file: File) => uploadMedia(file) });
}
