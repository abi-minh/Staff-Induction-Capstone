import client from './client';
import type { Module } from '../types';

// WP REST returns title/content as { rendered: string } objects.
interface WPModule {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: 'publish' | 'draft';
  date: string;
  modified: string;
  meta: {
    module_role_targets: string[];
    module_estimated_minutes: number;
    module_order: number;
  };
}

function normalise(wp: WPModule): Module {
  return {
    id: wp.id,
    title: wp.title.rendered,
    content: wp.content.rendered,
    excerpt: wp.excerpt.rendered,
    status: wp.status,
    date: wp.date,
    modified: wp.modified,
    meta: {
      module_role_targets: wp.meta.module_role_targets ?? [],
      module_estimated_minutes: wp.meta.module_estimated_minutes ?? 0,
      module_order: wp.meta.module_order ?? 0,
    },
  };
}

export async function fetchAssignedModules(userId: number): Promise<Module[]> {
  // Custom endpoint returns only modules assigned to this user.
  const { data } = await client.get<WPModule[]>(
    `induction/v1/assignments/user/${userId}`
  );
  return data.map(normalise).sort((a, b) => a.meta.module_order - b.meta.module_order);
}

export async function fetchModule(id: number): Promise<Module> {
  const { data } = await client.get<WPModule>(`wp/v2/induction_module/${id}`);
  return normalise(data);
}
