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

export interface ExportPreflight {
  mediaCount: number;
  mediaBytes: number;
  contentBytes: number;
  estimatedBytes: number;
  missing: number;
  largest: { name: string; bytes: number }[];
  freeBytes: number | null;
}

/** What to do about media. Omitted means everything, as before. */
export interface ExportOptions {
  includeMedia?: boolean;
  /** Leave out any single file larger than this. 0 or absent means no limit. */
  maxFileMb?: number;
}

// Past this, a single download on a host that buffers responses has been seen
// to come back truncated. Not a hard rule — a number at which to suggest
// building on the server and fetching the file directly instead.
export const RISKY_ARCHIVE_BYTES = 500 * 1024 * 1024;

export type ExportVerdict = { level: 'ok' | 'warning' | 'error'; text: string };

/**
 * Whether an export of this size is likely to work, and what to do if not.
 *
 * Separate from the panel so the thresholds can be read and tested rather than
 * buried in a render.
 */
export function assessExport(pre: ExportPreflight): ExportVerdict {
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(1)} GB`;
  const mb = (n: number) => `${Math.round(n / 1024 ** 2)} MB`;
  const size = pre.estimatedBytes >= 1024 ** 3 ? gb(pre.estimatedBytes) : mb(pre.estimatedBytes);

  // Needs room for the archive beside the files it copies.
  if (pre.freeBytes !== null && pre.freeBytes < pre.estimatedBytes) {
    return {
      level: 'error',
      text: `The archive would be about ${size}, and the server reports only `
        + `${mb(pre.freeBytes)} free. Leave the largest media out, or free up space first.`,
    };
  }

  if (pre.estimatedBytes > RISKY_ARCHIVE_BYTES) {
    return {
      level: 'warning',
      text: `The archive would be about ${size}. Downloads over roughly 500 MB have come `
        + 'back truncated on this host — use "Build on server only" and collect the file '
        + 'over FTP, or leave the largest media out.',
    };
  }

  return { level: 'ok', text: `The archive would be about ${size}. That should download normally.` };
}

export async function fetchExportPreflight(): Promise<ExportPreflight> {
  const res = await transferFetch('export/preflight');
  if (!res.ok) throw new Error(await messageFrom(res, 'Could not work out the export size.'));
  return (await res.json()) as ExportPreflight;
}

export interface ExportResult {
  files: number;
  size: number;
  skippedMedia: number; // missing from the server's disk, so exported by URL only
  // Where the finished archive sits on the server. Only of interest when the
  // file is being collected by hand rather than downloaded.
  path?: string;
}

export type ExportStatus =
  | { phase: 'collecting' }
  | { phase: 'zipping'; progress: number }
  | { phase: 'ready'; size: number }
  | { phase: 'sending'; sent: number; size: number };

type ServerExportStatus =
  | ExportStatus
  // 'paused' is an interrupted transfer whose bytes are still good: the zip is
  // kept and the link stays live so the browser can resume. 'cancelled' only
  // still appears from a server older than this build.
  | { phase: 'done' | 'cancelled' | 'paused'; sent: number; size: number }
  | { phase: 'unknown' };

const EXPORT_POLL_MS = 700;
// A poll queued behind the export request is dropped so the next can reach a free worker.
const EXPORT_POLL_TIMEOUT_MS = 2000;
const DOWNLOAD_START_TIMEOUT_MS = 30_000;
// How long the byte count may sit still before the transfer is called dead.
// The server writes a final status when it finishes or is disconnected — but
// not when the host kills the worker outright, which is exactly what happens
// to a large export on a shared host. Without this the page waits for a status
// that is never written.
const DOWNLOAD_STALL_MS = 45_000;

// How much of the archive to ask for per request.
//
// A single response carrying the whole file does not survive this host: the
// body is cut at a fixed point a little over 500MB and the connection is then
// closed cleanly, so the browser reports a completed download of a truncated
// zip — no error, no resumable state, and a file that opens nowhere. Slices
// keep every response far below that, and a slice that fails costs one retry
// rather than the whole transfer.
const SLICE_BYTES = 32 * 1024 * 1024;
const SLICE_ATTEMPTS = 4;

const RESUME_MESSAGE =
  'The download stopped before it finished. Your browser can resume it from its '
  + 'downloads list — the part already transferred is kept, so it will carry on '
  + 'from where it stopped rather than start again.';

let downloadFrame: HTMLIFrameElement | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function newJobId(): string {
  // crypto.randomUUID() only exists on https or localhost.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function getExportStatus(job: string): Promise<ServerExportStatus> {
  try {
    const res = await transferFetch(`export/status?job=${job}`, { signal: AbortSignal.timeout(EXPORT_POLL_TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as ServerExportStatus) : { phase: 'unknown' };
  } catch {
    return { phase: 'unknown' };
  }
}

// ── Sliced download ───────────────────────────────────────────────────────────

// The File System Access API, which only Chrome and Edge implement. Declared
// here because it is not in the standard DOM lib yet.
interface FileWriter {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}
interface SaveTarget {
  createWritable(): Promise<FileWriter>;
}
type SavePicker = (options?: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<SaveTarget>;

function savePicker(): SavePicker | null {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  return typeof picker === 'function' ? picker : null;
}

export function canStreamToDisk(): boolean {
  return savePicker() !== null;
}

/**
 * Ask where to save the backup.
 *
 * Must be called straight from the click that starts the export: the picker
 * needs an active user gesture, and building the archive takes long enough to
 * lose one.
 */
export async function pickSaveLocation(): Promise<SaveTarget | null> {
  const picker = savePicker();
  if (!picker) return null;
  try {
    return await picker({
      suggestedName: `induction-export-${new Date().toISOString().slice(0, 10)}.zip`,
      types: [{ description: 'Backup archive', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch {
    return null; // the dialog was dismissed
  }
}

// Not worth retrying: the server is answering correctly, it just cannot do
// what is being asked. Its own type rather than a recognisable message, so
// rewording the text for the user cannot quietly turn it back into a retry.
class RangeUnsupportedError extends Error {}

/** One slice, with retries. Returns the bytes, or throws once it has given up. */
async function fetchSlice(path: string, start: number, end: number): Promise<ArrayBuffer> {
  let lastError = 'the connection failed';
  for (let attempt = 0; attempt < SLICE_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
    try {
      const res = await transferFetch(path, { headers: { Range: `bytes=${start}-${end}` } });

      // 200 means the server ignored the Range and is sending the whole file —
      // an older plugin build. Carrying on would write the first slice-worth of
      // a fresh copy at every offset and produce a plausible-looking ruin.
      if (res.status === 200) {
        throw new RangeUnsupportedError(
          'The plugin on this site does not support part-by-part downloads. Update '
          + 'the Induction Platform plugin to the current version and export again.',
        );
      }
      if (res.status !== 206) {
        lastError = `the server answered ${res.status}`;
        continue;
      }
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength !== end - start + 1) {
        lastError = `a part arrived short (${buffer.byteLength} of ${end - start + 1} bytes)`;
        continue;
      }
      return buffer;
    } catch (err) {
      if (err instanceof RangeUnsupportedError) throw err;
      lastError = err instanceof Error ? err.message : 'the connection failed';
    }
  }
  throw new Error(`The backup could not be downloaded in full: ${lastError}.`);
}

/**
 * Download the prepared archive a slice at a time, straight to disk.
 *
 * Written through a file handle rather than collected into a Blob: these
 * archives run to hundreds of megabytes and holding one in memory to hand it
 * over at the end is its own way to fail.
 */
async function downloadInSlices(
  target: SaveTarget,
  job: string,
  token: string,
  size: number,
  onProgress: (sent: number) => void,
): Promise<void> {
  // Both parameters: the token authorises an otherwise unauthenticated request,
  // and the job names the file when the request already carries an admin token.
  const path = `export?job=${encodeURIComponent(job)}&token=${encodeURIComponent(token)}`;
  const writer = await target.createWritable();
  let written = 0;

  try {
    while (written < size) {
      const end = Math.min(written + SLICE_BYTES, size) - 1;
      const slice = await fetchSlice(path, written, end);
      await writer.write(slice);
      written += slice.byteLength;
      onProgress(written);
    }
  } catch (err) {
    await writer.abort?.().catch(() => {});
    throw err;
  }

  await writer.close();

  // The whole point of the exercise: a short archive that still opens in some
  // tools is worse than a clear failure, because it looks like a backup.
  if (written !== size) {
    throw new Error(`The backup came back incomplete (${written} of ${size} bytes). Export again.`);
  }
}

interface PreparedExport extends ExportResult {
  job: string;
  token: string;
}

/**
 * Collect the content and build the archive on the server.
 *
 * The slow half, and the half that is the same whether the file is then
 * downloaded or left on the server to be collected by hand.
 */
async function prepareExport(
  onStatus: (status: ExportStatus) => void,
  options: ExportOptions = {},
): Promise<PreparedExport> {
  const job = newJobId();
  let building = true;
  void (async () => {
    while (building) {
      await sleep(EXPORT_POLL_MS);
      const status = await getExportStatus(job);
      if (building && (status.phase === 'collecting' || status.phase === 'zipping')) onStatus(status);
    }
  })();

  let res: Response;
  try {
    onStatus({ phase: 'collecting' });
    res = await transferFetch('export/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, ...options }),
    });
  } finally {
    building = false;
  }
  if (!res.ok) throw new Error(await messageFrom(res, 'Export failed.'));
  const prepared = (await res.json()) as ExportResult & { token: string };
  onStatus({ phase: 'ready', size: prepared.size });
  return { ...prepared, job };
}

/**
 * Build the archive and leave it on the server.
 *
 * For a site whose host mangles a large download: collecting the file over FTP
 * or a file manager touches neither PHP nor the web server's response
 * handling, so nothing can truncate it. The archive stays until it is
 * downloaded through the app or swept, which the plugin does after a day.
 */
export async function buildExportOnServer(
  onStatus: (status: ExportStatus) => void,
  options: ExportOptions = {},
): Promise<ExportResult & { path: string }> {
  const { files, size, skippedMedia, path } = await prepareExport(onStatus, options);
  // An older plugin answers prepare without a path. Reporting "built on the
  // server" with nowhere to go would be worse than saying so plainly.
  if (!path) {
    throw new Error(
      'The server did not say where it put the file. Update the Induction Platform '
      + 'plugin to the current version and try again.',
    );
  }
  return { files, size, skippedMedia, path };
}

// The browser downloads from a one-time link, not a fetched Blob that would sit in memory.
// The iframe keeps a failed link from navigating the app away.
export async function runExport(
  onStatus: (status: ExportStatus) => void,
  // Where to write the archive. Supplied when the browser can stream to disk,
  // in which case the app fetches the file in slices instead of handing the
  // whole download to the browser — see downloadInSlices.
  saveTo?: SaveTarget | null,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const { job, token, files, size, skippedMedia } = await prepareExport(onStatus, options);

  if (saveTo) {
    await downloadInSlices(saveTo, job, token, size, (sent) =>
      onStatus({ phase: 'sending', sent, size }),
    );
    return { files, size, skippedMedia };
  }

  if (!downloadFrame) {
    downloadFrame = document.createElement('iframe');
    downloadFrame.style.display = 'none';
    document.body.appendChild(downloadFrame);
  }
  downloadFrame.src = transferUrl(`export?token=${encodeURIComponent(token)}`);

  const linkOpened = Date.now();
  let lastSent = -1;
  let lastProgress = Date.now();
  for (;;) {
    await sleep(EXPORT_POLL_MS);
    const status = await getExportStatus(job);
    if (status.phase === 'sending') {
      onStatus(status);
      if (status.sent !== lastSent) {
        lastSent = status.sent;
        lastProgress = Date.now();
      } else if (Date.now() - lastProgress > DOWNLOAD_STALL_MS) {
        // The worker was killed mid-send, so no final status is coming. The
        // bytes written so far are still on disk and still resumable.
        throw new Error(RESUME_MESSAGE);
      }
    }
    if (status.phase === 'done') return { files, size, skippedMedia };
    if (status.phase === 'paused') {
      throw new Error(RESUME_MESSAGE);
    }
    if (status.phase === 'cancelled') {
      throw new Error('The download stopped before it finished. Export again to get a complete copy.');
    }
    if (status.phase === 'ready' && Date.now() - linkOpened > DOWNLOAD_START_TIMEOUT_MS) {
      void transferFetch('export/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      throw new Error("The download didn't start. Check the browser isn't blocking downloads from this site, then export again.");
    }
  }
}

// ── Import ────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 5 * 1024 * 1024; // under any realistic upload_max_filesize
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const REQUEST_TIMEOUT_MS = 180_000; // steps take ~5s; this catches a silent connection

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
    onProgress?.(data.total > 0 ? data.processed / data.total : 0);
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
    onProgress?.((index + 1) / chunks);
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
  return driveSteps(sessionId, onProgress, signal);
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
