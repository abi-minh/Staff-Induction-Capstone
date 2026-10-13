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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['media'] });
    },
  });
}

export function useUpdateDocument(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<DocumentFormValues>) => updateDocument(id, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

/**
 * Set who can see a batch of documents.
 *
 * Takes the ids rather than being bound to one, because the Documents screen
 * applies this to a selection. Sequential rather than parallel: the host's
 * firewall counts bursts of writes, and a handful of documents is not worth
 * racing.
 */
export function useSetDocumentVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, roles }: { ids: number[]; roles: string[] }) => {
      for (const id of ids) {
        await updateDocument(id, { document_role_targets: roles });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['media'] });
    },
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
