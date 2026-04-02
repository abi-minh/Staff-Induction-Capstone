import client from './client';
import type { Document } from '../types';

interface WPDocument {
  id: number;
  title: { rendered: string };
  status: 'publish' | 'draft';
  date: string;
  meta: {
    document_category: string;
    document_file_id: number;
    document_role_targets: string[];
  };
}

interface WPMedia {
  source_url: string;
}

async function resolveFileUrl(attachmentId: number): Promise<string | undefined> {
  if (!attachmentId) return undefined;
  try {
    const { data } = await client.get<WPMedia>(`wp/v2/media/${attachmentId}`);
    return data.source_url;
  } catch {
    return undefined;
  }
}

function normalise(wp: WPDocument, fileUrl?: string): Document {
  return {
    id: wp.id,
    title: wp.title.rendered,
    status: wp.status,
    date: wp.date,
    meta: {
      document_category: wp.meta.document_category ?? '',
      document_file_id: wp.meta.document_file_id ?? 0,
      document_role_targets: wp.meta.document_role_targets ?? [],
    },
    fileUrl,
  };
}

export async function fetchDocuments(search?: string): Promise<Document[]> {
  const params: Record<string, string | number> = {
    per_page: 100,
    status: 'publish',
  };
  if (search) params.search = search;

  const { data } = await client.get<WPDocument[]>('wp/v2/induction_document', { params });

  // Resolve file URLs in parallel.
  const docs = await Promise.all(
    data.map(async (wp) => {
      const fileUrl = await resolveFileUrl(wp.meta.document_file_id);
      return normalise(wp, fileUrl);
    })
  );

  return docs;
}
