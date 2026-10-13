// The managed category list every uploaded file is filed under. Readable by
// any signed-in user — the staff Resources page filters on the same list the
// admin library does — but only an admin may change it.

import client from './client';
import type { ResourceCategory } from '../types';

export async function fetchResourceCategories(): Promise<ResourceCategory[]> {
  const { data } = await client.get<ResourceCategory[]>('induction/v1/resource-categories');
  return data;
}

export async function createResourceCategory(name: string): Promise<ResourceCategory> {
  const { data } = await client.post<ResourceCategory>('induction/v1/resource-categories', { name });
  return data;
}

export async function renameResourceCategory(value: string, name: string): Promise<ResourceCategory> {
  const { data } = await client.post<ResourceCategory>(
    `induction/v1/resource-categories/${value}`,
    { name },
  );
  return data;
}

export async function deleteResourceCategory(value: string): Promise<{ removed: string }> {
  const { data } = await client.delete<{ removed: string }>(
    `induction/v1/resource-categories/${value}`,
  );
  return data;
}

export async function setResourceCategoryVisibility(
  value: string,
  hidden: boolean,
): Promise<{ value: string; hidden: boolean }> {
  const { data } = await client.post<{ value: string; hidden: boolean }>(
    `induction/v1/resource-categories/${value}/visibility`,
    { hidden },
  );
  return data;
}

// Moving one file. The server also carries any document record in front of the
// file across, so the staff portal and the library stay in step.
export async function setMediaCategory(
  id: number,
  category: string,
): Promise<{ id: number; category: string; categoryLabel: string }> {
  const { data } = await client.post<{ id: number; category: string; categoryLabel: string }>(
    `induction/v1/media/${id}/category`,
    { category },
  );
  return data;
}
