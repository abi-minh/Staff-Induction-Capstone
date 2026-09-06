import client from './client';

// A saved state of a module's sections. `blocks` is fetched separately — the
// list endpoint omits it so the history panel isn't pulling 30 large payloads.
export interface ModuleVersion {
  version: number;
  sectionCount: number;
  sizeBytes: number;
  authorName: string;
  createdAt: string;
  isCurrent: boolean;
}

interface WPModuleVersion {
  version: number;
  section_count?: number;
  size_bytes?: number;
  author_name?: string;
  created_at?: string;
  is_current?: boolean;
}

export async function fetchModuleVersions(moduleId: number): Promise<ModuleVersion[]> {
  const { data } = await client.get<WPModuleVersion[]>(
    `induction/v1/modules/${moduleId}/versions`,
  );
  return data.map((v) => ({
    version: v.version,
    sectionCount: v.section_count ?? 0,
    sizeBytes: v.size_bytes ?? 0,
    authorName: v.author_name ?? '',
    createdAt: v.created_at ?? '',
    isCurrent: v.is_current ?? false,
  }));
}

export async function fetchModuleVersionBlocks(
  moduleId: number,
  version: number,
): Promise<string> {
  const { data } = await client.get<{ version: number; blocks: string }>(
    `induction/v1/modules/${moduleId}/versions/${version}`,
  );
  return data.blocks;
}

export async function restoreModuleVersion(
  moduleId: number,
  version: number,
): Promise<void> {
  await client.post(`induction/v1/modules/${moduleId}/versions/${version}/restore`, {});
}
