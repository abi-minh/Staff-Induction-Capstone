import client from './client';
import type { MediaItem } from '../types';

export async function fetchMedia(): Promise<MediaItem[]> {
  const { data } = await client.get<MediaItem[]>('induction/v1/media');
  return data;
}

export async function deleteMedia(id: number): Promise<{ deleted: number }> {
  const { data } = await client.delete<{ deleted: number }>(`induction/v1/media/${id}`);
  return data;
}
