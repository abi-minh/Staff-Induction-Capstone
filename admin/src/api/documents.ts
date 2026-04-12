import { wpClient } from './client';
import type { Document, DocumentFormValues, WPMedia } from '../types';

interface WPDocument {
  id: number;
  title: { rendered: string; raw?: string };
  status: 'publish' | 'draft';
  date: string;
  meta: {
    document_category: string;
    document_file_id: number;
    document_role_targets: string[];
  };
}

function normalise(wp: WPDocument, fileUrl?: string): Document {
  return {
    id: wp.id,
    title: wp.title.raw ?? wp.title.rendered,
    status: wp.status,
    date: wp.date,
    meta: {
      document_category: wp.meta?.document_category ?? '',
      document_file_id: wp.meta?.document_file_id ?? 0,
      document_role_targets: wp.meta?.document_role_targets ?? [],
    },
    fileUrl,
  };
}

export async function fetchDocuments(): Promise<Document[]> {
  const { data } = await wpClient.get<WPDocument[]>('wp/v2/induction_document', {
    params: { per_page: 100, status: 'any', context: 'edit' },
  });
  return data.map((wp) => normalise(wp));
}

export async function createDocument(values: DocumentFormValues): Promise<Document> {
  const { data } = await wpClient.post<WPDocument>('wp/v2/induction_document', {
    title: values.title,
    status: values.status,
    meta: {
      document_category: values.document_category,
      document_file_id: values.document_file_id,
      document_role_targets: values.document_role_targets,
    },
  });
  return normalise(data);
}

export async function updateDocument(id: number, values: Partial<DocumentFormValues>): Promise<Document> {
  const { data } = await wpClient.post<WPDocument>(`wp/v2/induction_document/${id}`, {
    ...(values.title !== undefined && { title: values.title }),
    ...(values.status !== undefined && { status: values.status }),
    meta: {
      ...(values.document_category !== undefined && { document_category: values.document_category }),
      ...(values.document_file_id !== undefined && { document_file_id: values.document_file_id }),
      ...(values.document_role_targets !== undefined && { document_role_targets: values.document_role_targets }),
    },
  });
  return normalise(data);
}

export async function deleteDocument(id: number): Promise<void> {
  await wpClient.delete(`wp/v2/induction_document/${id}`, { params: { force: true } });
}

// ── Media upload ──────────────────────────────────────────────────────────────

export async function uploadMedia(file: File): Promise<WPMedia> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name);

  const { data } = await wpClient.post<{ id: number; source_url: string; mime_type: string; title: { rendered: string } }>(
    'wp/v2/media',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );

  return {
    id: data.id,
    sourceUrl: data.source_url,
    mimeType: data.mime_type,
    title: data.title.rendered,
  };
}
