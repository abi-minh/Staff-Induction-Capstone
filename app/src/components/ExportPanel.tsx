import { useState } from 'react';
import { Alert, Button, CircularProgress, Paper, Typography } from '@mui/material';
import type { AlertColor } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { startExportDownload } from '../api/transfer';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function ExportPanel() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ severity: AlertColor; text: string } | null>(null);

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const { files, bytes, skippedMedia } = await startExportDownload();
      const skipped = skippedMedia
        ? ` ${skippedMedia} media file(s) were missing from this server and are included as links only.`
        : '';
      setMessage({
        severity: skippedMedia ? 'warning' : 'success',
        text: `Your download is starting (about ${formatBytes(bytes)}, ${files} media file(s)). Your browser's downloads show its progress.${skipped}`,
      });
    } catch (err) {
      setMessage({ severity: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    } finally {
      setExporting(false);
    }
  }

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
      <Button
        variant="contained"
        startIcon={exporting ? <CircularProgress size={16} /> : <DownloadOutlinedIcon />}
        onClick={handleExport}
        disabled={exporting}
        sx={{ borderRadius: 999 }}
      >
        {exporting ? 'Preparing…' : 'Export everything'}
      </Button>
      {message && <Alert severity={message.severity} sx={{ mt: 2 }}>{message.text}</Alert>}
    </Paper>
  );
}
