import { useState } from 'react';
import {
  Alert, Box, Button, LinearProgress, MenuItem, Paper, TextField, Typography,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import {
  assessExport, buildExportOnServer, canStreamToDisk, fetchExportPreflight, pickSaveLocation, runExport,
} from '../api/transfer';
import type { ExportOptions, ExportPreflight, ExportStatus } from '../api/transfer';

// Presets rather than a free number box: the point is to drop the handful of
// very large files, and an exact threshold is not worth getting wrong.
const MEDIA_CHOICES = [
  { value: 'all', label: 'Include all media', options: {} as ExportOptions },
  { value: '50', label: 'Skip media over 50 MB', options: { maxFileMb: 50 } },
  { value: '100', label: 'Skip media over 100 MB', options: { maxFileMb: 100 } },
  { value: 'none', label: 'Content only, no media files', options: { includeMedia: false } },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function describe(status: ExportStatus): { step: string; label: string; value: number | null } {
  switch (status.phase) {
    case 'collecting':
      return { step: 'Step 1 of 2', label: 'Gathering content', value: null };
    case 'zipping':
      return { step: 'Step 1 of 2', label: `Building the archive… ${Math.round(status.progress * 100)}%`, value: status.progress };
    case 'ready':
      return { step: 'Step 2 of 2', label: `Starting the download (${formatBytes(status.size)})`, value: null };
    case 'sending':
      return {
        step: 'Step 2 of 2',
        label: `Downloading… ${formatBytes(status.sent)} of ${formatBytes(status.size)}`,
        value: status.size ? status.sent / status.size : null,
      };
  }
}

function PreflightReport({ preflight }: { preflight: ExportPreflight }) {
  const verdict = assessExport(preflight);
  return (
    <Alert severity={verdict.level === 'ok' ? 'info' : verdict.level} sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>{verdict.text}</Typography>
      <Typography variant="body2" color="text.secondary">
        {preflight.mediaCount} media file(s), {formatBytes(preflight.mediaBytes)} in total.
        {preflight.missing > 0 && ` ${preflight.missing} missing from this server, exported as links only.`}
        {preflight.freeBytes !== null && ` Server reports ${formatBytes(preflight.freeBytes)} free.`}
      </Typography>
      {preflight.largest.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {/* The few files that decide whether this works. Naming them is the
              difference between "the backup is too big" and knowing which
              video to leave out. */}
          <Typography variant="caption" color="text.secondary">Largest files:</Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {preflight.largest.slice(0, 5).map((file) => (
              <Typography component="li" variant="caption" key={file.name} sx={{ wordBreak: 'break-all' }}>
                {file.name} — {formatBytes(file.bytes)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Alert>
  );
}

export default function ExportPanel() {
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [message, setMessage] = useState<{ severity: AlertColor; text: string } | null>(null);
  const [serverCopy, setServerCopy] = useState<{ path: string; size: number; files: number } | null>(null);
  const [preflight, setPreflight] = useState<ExportPreflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [mediaChoice, setMediaChoice] = useState('all');

  const mediaOptions = MEDIA_CHOICES.find((c) => c.value === mediaChoice)?.options ?? {};

  async function handleCheck() {
    setMessage(null);
    setChecking(true);
    try {
      setPreflight(await fetchExportPreflight());
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Could not check the export.' });
    } finally {
      setChecking(false);
    }
  }

  /**
   * Build the archive and leave it where it was built.
   *
   * The escape hatch for a host that will not let a large file through: the
   * download is where this breaks, so skip it and collect the file over FTP or
   * a file manager, which goes nowhere near PHP.
   */
  async function handleBuildOnServer() {
    setMessage(null);
    setServerCopy(null);
    setStatus({ phase: 'collecting' });
    try {
      const { files, size, skippedMedia, path } = await buildExportOnServer(setStatus, mediaOptions);
      setServerCopy({ path, size, files });
      if (skippedMedia) {
        setMessage({
          severity: 'warning',
          text: `${skippedMedia} media file(s) were missing from this server and are included as links only.`,
        });
      }
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    } finally {
      setStatus(null);
    }
  }

  async function handleExport() {
    setServerCopy(null);
    // Asked before anything else, because the file picker needs the click that
    // is still in hand — building the archive takes minutes and the gesture
    // does not survive it.
    let saveTo = null;
    if (canStreamToDisk()) {
      saveTo = await pickSaveLocation();
      if (!saveTo) return; // dialog dismissed
    }

    setMessage(null);
    setStatus({ phase: 'collecting' });
    try {
      const { files, size, skippedMedia } = await runExport(setStatus, saveTo, mediaOptions);
      const skipped = skippedMedia
        ? ` ${skippedMedia} media file(s) were missing from this server and are included as links only.`
        : '';
      setMessage({
        severity: skippedMedia ? 'warning' : 'success',
        text: saveTo
          ? `Export saved (${formatBytes(size)}, ${files} media file(s)).${skipped}`
          : `Export downloaded (${formatBytes(size)}, ${files} media file(s)). It's in your browser's downloads.${skipped}`,
      });
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    } finally {
      setStatus(null);
    }
  }

  // The size check does the same collection an export does, which on a site
  // with a lot of media is slow enough to look like nothing happened. There is
  // no progress to report — it is one pass over the content — so an
  // indeterminate bar is the honest shape rather than a percentage made up to
  // fill the space.
  const progress = status
    ? describe(status)
    : checking
      ? { step: 'Checking', label: 'Working out what the export contains', value: null }
      : null;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3, maxWidth: 820 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>Export</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Downloads a <strong>.zip</strong> archive containing every module, location
        and document, the media files they use, and staff progress, assignments and
        quiz responses. Staff accounts are not included — records are matched to
        existing users by username and email when the file is imported.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        The file contains staff names, emails and their training results. Treat it
        as personal data: store it somewhere access-controlled.
      </Alert>
      {progress ? (
        <Box>
          <LinearProgress
            variant={progress.value === null ? 'indeterminate' : 'determinate'}
            value={(progress.value ?? 0) * 100}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {progress.step}: {progress.label}. Stay on this page until it finishes.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label="Media"
            value={mediaChoice}
            onChange={(e) => setMediaChoice(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {MEDIA_CHOICES.map((choice) => (
              <MenuItem key={choice.value} value={choice.value}>{choice.label}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<FactCheckOutlinedIcon />}
            onClick={handleCheck}
            sx={{ borderRadius: 999 }}
          >
            Check size first
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon />}
            onClick={handleExport}
            sx={{ borderRadius: 999 }}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<StorageOutlinedIcon />}
            onClick={handleBuildOnServer}
            sx={{ borderRadius: 999 }}
          >
            Build on server only
          </Button>
        </Box>
      )}

      {preflight && <PreflightReport preflight={preflight} />}

      {serverCopy && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Built on the server ({formatBytes(serverCopy.size)}, {serverCopy.files} media file(s)).
            Nothing was downloaded. Collect it with your host&rsquo;s file manager or over FTP:
          </Typography>
          <Box
            component="code"
            sx={{
              display: 'block',
              p: 1,
              borderRadius: 1,
              bgcolor: 'action.hover',
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {serverCopy.path}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            The file is deleted automatically after 24 hours, so move it somewhere safe.
          </Typography>
        </Alert>
      )}

      {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}
    </Paper>
  );
}
