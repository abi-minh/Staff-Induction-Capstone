import client from './client';
import type { Module, ModuleFormValues } from '../types';

interface WPModule {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  status: 'publish' | 'draft';
  date: string;
  modified: string;
  meta: {
    module_role_targets: string[];
    module_estimated_minutes: number;
    module_order: number;
    module_duration_days: number;
    module_blocks: string;
    module_icon: string;
    module_hero_image: number;
  };
}

function normalise(wp: WPModule): Module {
  return {
    id: wp.id,
    title: wp.title.raw ?? wp.title.rendered,
    content: wp.content.raw ?? wp.content.rendered,
    excerpt: wp.excerpt.raw ?? wp.excerpt.rendered,
    status: wp.status,
    date: wp.date,
    modified: wp.modified,
    meta: {
      module_role_targets: wp.meta?.module_role_targets ?? [],
      module_estimated_minutes: wp.meta?.module_estimated_minutes ?? 0,
      module_order: wp.meta?.module_order ?? 0,
      module_duration_days: wp.meta?.module_duration_days ?? 0,
      module_blocks: wp.meta?.module_blocks ?? '[]',
      module_icon: wp.meta?.module_icon ?? '',
      module_hero_image: wp.meta?.module_hero_image ?? 0,
    },
  };
}

export async function fetchModules(): Promise<Module[]> {
  const { data } = await client.get<WPModule[]>('induction/v1/modules');
  return data.map(normalise).sort((a, b) => a.meta.module_order - b.meta.module_order);
}

export async function fetchModule(id: number): Promise<Module> {
  const { data } = await client.get<WPModule>(`induction/v1/modules/${id}`);
  return normalise(data);
}

export async function createModule(values: ModuleFormValues): Promise<Module> {
  const { data } = await client.post<WPModule>('induction/v1/modules', {
    title: values.title,
    content: values.content,
    excerpt: values.excerpt,
    status: values.status,
    meta: {
      module_role_targets: values.module_role_targets,
      module_estimated_minutes: values.module_estimated_minutes,
      module_order: values.module_order,
      module_duration_days: values.module_duration_days,
      module_icon: values.module_icon,
      module_hero_image: values.module_hero_image,
      ...(values.module_blocks !== undefined && { module_blocks: values.module_blocks }),
    },
  });
  return normalise(data);
}

export async function updateModule(id: number, values: Partial<ModuleFormValues>): Promise<Module> {
  const { data } = await client.post<WPModule>(`induction/v1/modules/${id}`, {
    ...(values.title !== undefined && { title: values.title }),
    ...(values.content !== undefined && { content: values.content }),
    ...(values.excerpt !== undefined && { excerpt: values.excerpt }),
    ...(values.status !== undefined && { status: values.status }),
    meta: {
      ...(values.module_role_targets !== undefined && { module_role_targets: values.module_role_targets }),
      ...(values.module_estimated_minutes !== undefined && { module_estimated_minutes: values.module_estimated_minutes }),
      ...(values.module_order !== undefined && { module_order: values.module_order }),
      ...(values.module_duration_days !== undefined && { module_duration_days: values.module_duration_days }),
      ...(values.module_blocks !== undefined && { module_blocks: values.module_blocks }),
      ...(values.module_icon !== undefined && { module_icon: values.module_icon }),
      ...(values.module_hero_image !== undefined && { module_hero_image: values.module_hero_image }),
    },
  });
  return normalise(data);
}

export async function deleteModule(id: number): Promise<void> {
  await client.delete(`induction/v1/modules/${id}`);
}
