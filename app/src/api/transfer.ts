import client from './client';

export interface ImportSummary {
  modules: number;
  locations: number;
  documents: number;
  media: number;
  progress: number;
  assignments: number;
  quiz_responses: number;
  media_failed: number;
  records_skipped_unknown_user: number;
}

export interface ExportEnvelope {
  format: string;
  format_version: number;
  exported_at: string;
  site?: { name?: string; url?: string };
  modules?: unknown[];
  locations?: unknown[];
  documents?: unknown[];
  media?: Record<string, unknown>;
  records?: {
    progress?: unknown[];
    assignments?: unknown[];
    quiz_responses?: unknown[];
  };
  notes?: { media_bytes_embedded?: number; media_not_embedded?: string[] };
}

export async function fetchExport(): Promise<ExportEnvelope> {
  const { data } = await client.get<ExportEnvelope>('induction/v1/transfer/export');
  return data;
}

export async function runImport(payload: unknown): Promise<ImportSummary> {
  const { data } = await client.post<{ imported: boolean; summary: ImportSummary }>(
    'induction/v1/transfer/import',
    payload,
  );
  return data.summary;
}

// Hands the export to the browser as a file. Kept out of the page component so
// the page stays about presentation.
export function downloadExport(envelope: ExportEnvelope, siteName: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (siteName || 'induction').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${slug}-export-${stamp}.json`;

  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return filename;
}
