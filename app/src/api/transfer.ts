import client from './client';
import { useAuthStore } from '../store/authStore';

export interface ImportSummary {
  modules: number;
  locations: number;
  documents: number;
  media: number;
  progress: number;
  assignments: number;
  quiz_responses: number;
  media_failed: number;
  items_failed: number;
  records_skipped_unknown_user: number;
}

const transferUrl = (path: string) => `${client.defaults.baseURL ?? ''}induction/v1/transfer/${path}`;

// fetch, not the axios client: its default JSON Content-Type would rewrite raw upload
// bodies. Mirrors its interceptors (JWT header, expire on 401).
async function transferFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('induction_token');
  const res = await fetch(transferUrl(path), {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (res.status === 401 && useAuthStore.getState().token) {
    useAuthStore.getState().expireSession();
  }
  return res;
}

async function messageFrom(res: Response, fallback: string): Promise<string> {
  try {
    const err = (await res.json()) as { message?: string };
    if (err.message) return err.message;
  } catch {
    /* non-JSON error body */
  }
  return fallback;
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface ExportResult {
  files: number;
  bytes: number; // approximate: the media files, before zip overhead
  skippedMedia: number; // missing from the server's disk, so exported by URL only
}

let downloadFrame: HTMLIFrameElement | null = null;

// The browser downloads the export from a short-lived link (a fetched Blob would sit in
// memory). The hidden iframe keeps a failed link from navigating the app away.
export async function startExportDownload(): Promise<ExportResult> {
  const res = await transferFetch('export/prepare', { method: 'POST' });
  if (!res.ok) throw new Error(await messageFrom(res, 'Export failed.'));
  const { token, files, bytes, skippedMedia } = (await res.json()) as ExportResult & { token: string };

  if (!downloadFrame) {
    downloadFrame = document.createElement('iframe');
    downloadFrame.style.display = 'none';
    document.body.appendChild(downloadFrame);
  }
  downloadFrame.src = transferUrl(`export?token=${encodeURIComponent(token)}`);

  return { files, bytes, skippedMedia };
}

// ── Import ────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5 * 1024 * 1024; // under any realistic upload_max_filesize
const UPLOAD_WEIGHT = 0.15; // share of the progress bar given to the upload
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 180_000; // steps take ~15s; this catches a silent connection

// Network errors, timeouts and 5xx are retried with backoff; a 4xx is returned as-is.
// Safe only because the server makes every stage idempotent (chunk offsets, session lock).

async function postWithRetry(path: string, body: BodyInit, contentType = 'application/json'): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await transferFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
        signal: controller.signal,
      });
      // 507: the server's disk is full, so retrying can't help.
      if (res.status < 500 || res.status === 507 || attempt >= RETRY_DELAYS_MS.length) return res;
    } catch {
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw new Error('Lost connection to the server.');
      }
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

// An unfinished import is remembered across reloads so the page can offer resume or undo.
const PENDING_KEY = 'induction_pending_import';

export interface PendingImport {
  sessionId: string;
  fileName: string;
}

export function getPendingImport(): PendingImport | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Partial<PendingImport> | null;
    // A corrupt entry would otherwise lock the page behind an import that can't exist.
    if (typeof saved?.sessionId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(saved.sessionId)) return null;
    return { sessionId: saved.sessionId, fileName: String(saved.fileName ?? 'An import') };
  } catch {
    return null;
  }
}

export function clearPendingImport(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

function setPendingImport(pending: PendingImport): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable: the import still runs, just not recoverable after a reload */
  }
}

// Thrown once a server session exists, i.e. there is something to resume or undo.
export class ImportInterruptedError extends Error {
  constructor(message: string, readonly sessionId: string) {
    super(message);
    this.name = 'ImportInterruptedError';
  }
}

// Thrown when the user cancels. sessionId is null if nothing was imported yet.
export class ImportCancelledError extends Error {
  constructor(readonly sessionId: string | null) {
    super('Import cancelled.');
    this.name = 'ImportCancelledError';
  }
}

// `offset` and `weight` place this stage on the overall progress bar.
async function driveSteps(
  sessionId: string,
  onProgress?: (fraction: number) => void,
  offset = 0,
  weight = 1,
  signal?: AbortSignal,
): Promise<ImportSummary> {
  for (;;) {
    // Checked between requests: a step already running finishes before the cancel lands.
    if (signal?.aborted) throw new ImportCancelledError(sessionId);
    let res: Response;
    try {
      res = await postWithRetry('import/step', JSON.stringify({ sessionId }));
    } catch (err) {
      throw new ImportInterruptedError(err instanceof Error ? err.message : 'Import failed.', sessionId);
    }
    if (!res.ok) throw new ImportInterruptedError(await messageFrom(res, 'Import failed.'), sessionId);
    let data: { done: true; summary: ImportSummary } | { done: false; processed: number; total: number };
    try {
      data = await res.json();
    } catch {
      // A non-JSON 200 (PHP warning, firewall page) stays resumable, not a duplicate-inviting error.
      throw new ImportInterruptedError('The server sent an unexpected response.', sessionId);
    }
    if (data.done) {
      clearPendingImport();
      onProgress?.(1);
      return data.summary;
    }
    onProgress?.(offset + (data.total > 0 ? data.processed / data.total : 0) * weight);
  }
}

export interface BackupItem {
  index: number;
  title: string;
  status: 'publish' | 'draft';
}

export interface BackupContents {
  modules: BackupItem[];
  locations: BackupItem[];
  documents: BackupItem[];
}

export type ImportSelection = Record<keyof BackupContents, number[]>;

export function selectEverything(contents: BackupContents): ImportSelection {
  return {
    modules: contents.modules.map((item) => item.index),
    locations: contents.locations.map((item) => item.index),
    documents: contents.documents.map((item) => item.index),
  };
}

// Nothing is imported until importSelected().
export async function uploadImport(
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ sessionId: string; contents: BackupContents }> {
  const uploadId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  for (let index = 0; index < chunks; index++) {
    if (signal?.aborted) throw new ImportCancelledError(null);
    const offset = index * CHUNK_SIZE;
    const res = await postWithRetry(
      `import/chunk?uploadId=${encodeURIComponent(uploadId)}&index=${index}&offset=${offset}&total=${file.size}`,
      file.slice(offset, offset + CHUNK_SIZE),
      'application/octet-stream',
    );
    if (!res.ok) throw new Error(await messageFrom(res, 'Upload failed.'));
    onProgress?.(((index + 1) / chunks) * UPLOAD_WEIGHT);
  }

  if (signal?.aborted) throw new ImportCancelledError(null);
  const beginRes = await postWithRetry('import/begin', JSON.stringify({ uploadId, size: file.size }));
  if (!beginRes.ok) throw new Error(await messageFrom(beginRes, 'Import failed.'));
  const { sessionId, contents } = (await beginRes.json()) as { sessionId: string; contents: BackupContents };
  return { sessionId, contents };
}

export async function importSelected(
  sessionId: string,
  fileName: string,
  selection: ImportSelection,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ImportSummary> {
  const res = await postWithRetry('import/select', JSON.stringify({ sessionId, ...selection }));
  if (!res.ok) throw new Error(await messageFrom(res, 'Import failed.'));
  setPendingImport({ sessionId, fileName });
  return driveSteps(sessionId, onProgress, UPLOAD_WEIGHT, 1 - UPLOAD_WEIGHT, signal);
}

export interface ImportStatus {
  phase: string;
  done: boolean;
  // False once the uploaded archive is gone: only undo is possible.
  resumable: boolean;
  processed: number;
  total: number;
  summary: ImportSummary;
}

export async function getImportStatus(sessionId: string): Promise<ImportStatus | null> {
  const res = await postWithRetry('import/status', JSON.stringify({ sessionId }));
  // 400 is a malformed id: there is no such session either way.
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(await messageFrom(res, 'Could not check the import.'));
  return (await res.json()) as ImportStatus;
}

export function resumeImport(sessionId: string, onProgress?: (fraction: number) => void): Promise<ImportSummary> {
  return driveSteps(sessionId, onProgress);
}

export interface UndoResult {
  attachments: number;
  modules: number;
  posts: number;
  rows: number;
}

// null if the session was already gone (the final call's response was lost).
export async function undoImport(sessionId: string, onProgress?: (fraction: number) => void): Promise<UndoResult | null> {
  for (;;) {
    const res = await postWithRetry('import/undo', JSON.stringify({ sessionId }));
    if (res.status === 404) {
      clearPendingImport();
      onProgress?.(1);
      return null;
    }
    if (!res.ok) throw new Error(await messageFrom(res, 'Undo failed.'));
    const data = (await res.json()) as { done: boolean; remaining?: number; removed: UndoResult };
    if (data.done) {
      clearPendingImport();
      onProgress?.(1);
      return data.removed;
    }
    const removed = data.removed.attachments + data.removed.modules + data.removed.posts;
    onProgress?.(removed / (removed + (data.remaining ?? 0)));
  }
}
