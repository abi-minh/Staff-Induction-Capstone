import client from './client';
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
  const { data } = await client.get<WPDocument[]>('wp/v2/induction_document', {
    params: { per_page: 100, status: 'any', context: 'edit' },
  });
  return data.map((wp) => normalise(wp));
}

export async function createDocument(values: DocumentFormValues): Promise<Document> {
  const { data } = await client.post<WPDocument>('wp/v2/induction_document', {
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
  const { data } = await client.post<WPDocument>(`wp/v2/induction_document/${id}`, {
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
  await client.delete(`wp/v2/induction_document/${id}`, { params: { force: true } });
}

export async function uploadMedia(file: File): Promise<WPMedia> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', file.name);

  const { data } = await client.post<{ id: number; source_url: string; mime_type: string; title: { rendered: string } }>(
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

export interface SectionImageFailure {
  url: string;
  module: string;
  error: string;
}

export async function countLinkedSectionImages(): Promise<number> {
  const { data } = await client.get<{ count: number }>('induction/v1/media/section-images');
  return data.count;
}

// Failed URLs go back as `skip` so one dead link can't stall the loop.
export async function copyLinkedSectionImages(
  onProgress: (done: number) => void,
): Promise<{ copied: number; failed: SectionImageFailure[] }> {
  let copied = 0;
  const failed: SectionImageFailure[] = [];
  for (;;) {
    const { data } = await client.post<{ copied: number; failed: SectionImageFailure[]; remaining: number }>(
      'induction/v1/media/section-images/copy',
      { skip: failed.map((f) => f.url) },
    );
    copied += data.copied;
    failed.push(...data.failed);
    onProgress(copied + failed.length);
    if (data.remaining === 0 || data.copied + data.failed.length === 0) {
      return { copied, failed };
    }
  }
}
