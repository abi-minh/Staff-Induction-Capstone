import client from './client';
import type { MediaItem } from '../types';

export async function fetchMedia(): Promise<MediaItem[]> {
  const { data } = await client.get<MediaItem[]>('induction/v1/media');
  return data;
}

export interface MediaDeletion {
  deleted: number;
  /**
   * Documents that pointed at the file and have been unhooked from it. The
   * records survive — only the file is gone — so an admin can repoint or
   * remove them rather than discovering a title with nothing behind it.
   */
  documentsUnlinked: number;
}

export async function deleteMedia(id: number): Promise<MediaDeletion> {
  const { data } = await client.delete<MediaDeletion>(`induction/v1/media/${id}`);
  return { deleted: data.deleted, documentsUnlinked: data.documentsUnlinked ?? 0 };
}
