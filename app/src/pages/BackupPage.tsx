import { useRef, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Paper, Table, TableBody, TableCell, TableRow,
  Typography,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { fetchExport, runImport, downloadExport } from '../api/transfer';
import type { ExportEnvelope, ImportSummary } from '../api/transfer';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SUMMARY_LABELS: { key: keyof ImportSummary; label: string }[] = [
  { key: 'modules', label: 'Modules' },
  { key: 'locations', label: 'Locations' },
  { key: 'documents', label: 'Documents' },
  { key: 'media', label: 'Media files' },
  { key: 'progress', label: 'Progress records' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'quiz_responses', label: 'Quiz responses' },
];

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportNote, setExportNote] = useState('');

  const [pending, setPending] = useState<{ envelope: ExportEnvelope; filename: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError('');
    setExportNote('');
    try {
      const envelope = await fetchExport();
      const filename = downloadExport(envelope, envelope.site?.name ?? '');
      const skipped = envelope.notes?.media_not_embedded ?? [];
      setExportNote(
        `${filename} — ${envelope.modules?.length ?? 0} modules, ` +
          `${envelope.locations?.length ?? 0} locations, ` +
          `${envelope.documents?.length ?? 0} documents, ` +
          `${Object.keys(envelope.media ?? {}).length} media files ` +
          `(${formatBytes(envelope.notes?.media_bytes_embedded ?? 0)} embedded)` +
          (skipped.length ? ` — ${skipped.length} file(s) too large to embed, exported by link only` : ''),
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a failure
    if (!file) return;

    setImportError('');
    setSummary(null);
    try {
      const envelope = JSON.parse(await file.text()) as ExportEnvelope;
      if (envelope.format !== 'induction-platform-export') {
        setImportError('That file is not an induction platform export.');
        return;
      }
      setPending({ envelope, filename: file.name });
    } catch {
      setImportError(`${file.name} could not be read as JSON.`);
    }
  }

  async function handleImport() {
    if (!pending) return;
    setImporting(true);
    setImportError('');
    try {
      setSummary(await runImport(pending.envelope));
      setPending(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  const counts = pending
    ? {
        modules: pending.envelope.modules?.length ?? 0,
        locations: pending.envelope.locations?.length ?? 0,
        documents: pending.envelope.documents?.length ?? 0,
        media: Object.keys(pending.envelope.media ?? {}).length,
        records:
          (pending.envelope.records?.progress?.length ?? 0) +
          (pending.envelope.records?.assignments?.length ?? 0) +
          (pending.envelope.records?.quiz_responses?.length ?? 0),
      }
    : null;

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 0.5 }}>Backup &amp; Migration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Move training content between sites, or take a copy you can restore from.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3, maxWidth: 820 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>Export</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Downloads one JSON file containing every module, location and document,
          the media they use, and staff progress, assignments and quiz responses.
          Staff accounts are not included — records are matched to existing users
          by username and email when the file is imported.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          The file contains staff names, emails and their training results. Treat
          it as personal data: store it somewhere access-controlled.
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
        {exportNote && <Alert severity="success" sx={{ mt: 2 }}>{exportNote}</Alert>}
        {exportError && <Alert severity="error" sx={{ mt: 2 }}>{exportError}</Alert>}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, maxWidth: 820 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>Import</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Import <strong>adds</strong> content — it never overwrites or deletes what
          is already here. Importing the same file twice creates a second copy of
          everything in it.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          sx={{ borderRadius: 999 }}
        >
          Choose export file
        </Button>
        <input ref={fileRef} type="file" hidden accept="application/json,.json" onChange={handleFileChosen} />
        {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}

        {summary && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <AlertTitle>Import complete</AlertTitle>
            <Table size="small">
              <TableBody>
                {SUMMARY_LABELS.map(({ key, label }) => (
                  <TableRow key={key}>
                    <TableCell sx={{ border: 0, py: 0.25 }}>{label}</TableCell>
                    <TableCell sx={{ border: 0, py: 0.25, fontWeight: 700 }}>{summary[key]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {summary.media_failed > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {summary.media_failed} media file(s) could not be recreated — any
                content referencing them will show a missing image.
              </Typography>
            )}
            {summary.records_skipped_unknown_user > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {summary.records_skipped_unknown_user} record(s) skipped: no matching
                staff account on this site. Create those accounts and re-import to
                bring their history across.
              </Typography>
            )}
          </Alert>
        )}
      </Paper>

      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Import {pending?.filename}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Exported from <strong>{pending?.envelope.site?.name || 'an unknown site'}</strong>
            {pending?.envelope.exported_at ? ` on ${pending.envelope.exported_at}` : ''}.
          </Typography>
          {counts && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={`${counts.modules} modules`} size="small" />
              <Chip label={`${counts.locations} locations`} size="small" />
              <Chip label={`${counts.documents} documents`} size="small" />
              <Chip label={`${counts.media} media files`} size="small" />
              <Chip label={`${counts.records} records`} size="small" />
            </Box>
          )}
          <Divider sx={{ mb: 2 }} />
          <Alert severity="warning">
            This adds all of the above to this site. Nothing is overwritten, so if
            some of it is already here you will end up with duplicates.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPending(null)} disabled={importing}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
