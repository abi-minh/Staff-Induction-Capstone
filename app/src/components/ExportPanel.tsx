import { useState } from 'react';
import { Alert, Box, Button, LinearProgress, Paper, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { runExport } from '../api/transfer';
import type { ExportStatus } from '../api/transfer';

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

export default function ExportPanel() {
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [message, setMessage] = useState<{ severity: AlertColor; text: string } | null>(null);

  async function handleExport() {
    setMessage(null);
    setStatus({ phase: 'collecting' });
    try {
      const { files, size, skippedMedia } = await runExport(setStatus);
      const skipped = skippedMedia
        ? ` ${skippedMedia} media file(s) were missing from this server and are included as links only.`
        : '';
      setMessage({
        severity: skippedMedia ? 'warning' : 'success',
        text: `Export downloaded (${formatBytes(size)}, ${files} media file(s)). It's in your browser's downloads.${skipped}`,
      });
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    } finally {
      setStatus(null);
    }
  }

  const progress = status ? describe(status) : null;

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
        <Button
          variant="contained"
          startIcon={<DownloadOutlinedIcon />}
          onClick={handleExport}
          sx={{ borderRadius: 999 }}
        >
          Export everything
        </Button>
      )}
      {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}
    </Paper>
  );
}
