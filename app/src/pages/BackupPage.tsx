import { useEffect, useRef, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableRow, Typography,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ExportPanel from '../components/ExportPanel';
import ImportChecklist from '../components/ImportChecklist';
import {
  ImportCancelledError, ImportInterruptedError, clearPendingImport, getImportStatus, getPendingImport,
  importSelected, resumeImport, selectEverything, undoImport, uploadImport,
} from '../api/transfer';
import type { BackupContents, ImportSelection, ImportStatus, ImportSummary, UndoResult } from '../api/transfer';

interface Interrupted {
  sessionId: string;
  fileName: string;
  status: ImportStatus | null;
  message: string;
}

type Stage = 'uploading' | 'choosing' | 'importing';

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [backup, setBackup] = useState<{ sessionId: string; contents: BackupContents } | null>(null);
  const [selection, setSelection] = useState<ImportSelection | null>(null);
  const [progress, setProgress] = useState(0);
  const [cancelling, setCancelling] = useState<'waiting' | 'undoing' | null>(null);
  const [importError, setImportError] = useState('');
  const [importNote, setImportNote] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
  const [recovering, setRecovering] = useState<'resume' | 'undo' | null>(null);
  const [recoverProgress, setRecoverProgress] = useState(0);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undone, setUndone] = useState<UndoResult | 'done' | null>(null);

  async function loadInterrupted(sessionId: string, fileName: string, message: string) {
    let status: ImportStatus | null;
    try {
      status = await getImportStatus(sessionId);
    } catch (err) {
      // Unreachable: keep the import on record rather than forget it.
      setInterrupted({ sessionId, fileName, status: null, message: message || (err instanceof Error ? err.message : '') });
      return;
    }
    if (status === null || status.done) {
      clearPendingImport();
      setInterrupted(null);
      if (status?.done) setSummary(status.summary);
      return;
    }
    setInterrupted({ sessionId, fileName, status, message });
  }

  useEffect(() => {
    const saved = getPendingImport();
    if (saved) void loadInterrupted(saved.sessionId, saved.fileName, '');
  }, []);

  function closeDialog(note = '') {
    setFile(null);
    setStage(null);
    setBackup(null);
    setSelection(null);
    setCancelling(null);
    cancelRef.current = null;
    setImportNote(note);
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a failure
    if (!chosen) return;

    setImportError('');
    setImportNote('');
    setSummary(null);
    setUndone(null);
    if (!/\.zip$/i.test(chosen.name)) {
      setImportError('Choose the .zip export file.');
      return;
    }
    void handleUpload(chosen);
  }

  async function handleUpload(chosen: File) {
    const controller = new AbortController();
    cancelRef.current = controller;
    setFile(chosen);
    setStage('uploading');
    setProgress(0);
    try {
      const uploaded = await uploadImport(chosen, setProgress, controller.signal);
      setBackup(uploaded);
      setSelection(selectEverything(uploaded.contents));
      setCancelling(null);
      setStage('choosing');
    } catch (err) {
      if (err instanceof ImportCancelledError) {
        closeDialog('Import cancelled. Nothing was imported.');
      } else {
        closeDialog();
        setImportError(err instanceof Error ? err.message : 'Upload failed.');
      }
    }
  }

  async function handleImport() {
    if (!file || !backup || !selection) return;
    const controller = new AbortController();
    cancelRef.current = controller;
    setStage('importing');
    try {
      setSummary(await importSelected(backup.sessionId, file.name, selection, setProgress, controller.signal));
      closeDialog();
    } catch (err) {
      if (err instanceof ImportCancelledError) {
        await undoCancelledImport(backup.sessionId, file.name);
      } else if (err instanceof ImportInterruptedError) {
        closeDialog();
        await loadInterrupted(err.sessionId, file.name, err.message);
      } else {
        closeDialog();
        setImportError(err instanceof Error ? err.message : 'Import failed.');
      }
    }
  }

  // Cancel means "take this round back": undo whatever it added.
  async function undoCancelledImport(sessionId: string, fileName: string) {
    setCancelling('undoing');
    setProgress(0);
    try {
      await undoImport(sessionId, setProgress);
      closeDialog('Import cancelled. Everything it added has been removed.');
    } catch (err) {
      closeDialog();
      await loadInterrupted(sessionId, fileName, err instanceof Error ? err.message : 'Undo failed.');
    }
  }

  function handleCancel() {
    if (stage === 'choosing' && backup) {
      // Nothing is imported yet; undo just throws the uploaded backup away.
      void undoImport(backup.sessionId).catch(() => undefined);
      closeDialog('Import cancelled. Nothing was imported.');
      return;
    }
    cancelRef.current?.abort();
    setCancelling('waiting');
  }

  async function recover(kind: 'resume' | 'undo') {
    if (!interrupted || recovering) return;
    setConfirmUndo(false);
    setRecovering(kind);
    setRecoverProgress(0);
    try {
      if (kind === 'resume') {
        setSummary(await resumeImport(interrupted.sessionId, setRecoverProgress));
      } else {
        setUndone((await undoImport(interrupted.sessionId, setRecoverProgress)) ?? 'done');
      }
      setInterrupted(null);
    } catch (err) {
      const fallback = kind === 'resume' ? 'Import failed.' : 'Undo failed.';
      await loadInterrupted(interrupted.sessionId, interrupted.fileName, err instanceof Error ? err.message : fallback);
    } finally {
      setRecovering(null);
    }
  }

  const busy = stage !== null || recovering !== null;
  const pickedCount = selection ? selection.modules.length + selection.locations.length + selection.documents.length : 0;
  const progressLabel = cancelling === 'waiting'
    ? 'Cancelling, finishing the current step'
    : cancelling === 'undoing'
      ? 'Cancelling, removing what was imported'
      : stage === 'uploading' ? 'Uploading' : 'Importing';

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 0.5 }}>Backup &amp; Migration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Move training content between sites, or take a copy you can restore from.
      </Typography>

      <ExportPanel />

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, maxWidth: 820 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>Import</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Import <strong>adds</strong> content — it never overwrites or deletes what is
          already here. After choosing a file you pick which modules, locations and
          documents to bring in, so you can restore just the ones you need.
        </Typography>

        {interrupted && (
          <InterruptedImportAlert
            interrupted={interrupted}
            recovering={recovering}
            progress={recoverProgress}
            onResume={() => recover('resume')}
            onUndo={() => setConfirmUndo(true)}
          />
        )}

        <Button
          variant="outlined"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={() => fileRef.current?.click()}
          disabled={busy || interrupted !== null}
          sx={{ borderRadius: 999 }}
        >
          Choose export file
        </Button>
        {interrupted && !busy && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>
            Resume or undo the unfinished import first.
          </Typography>
        )}
        <input ref={fileRef} type="file" hidden accept="application/zip,.zip" onChange={handleFileChosen} />
        {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
        {importNote && <Alert severity="info" sx={{ mt: 2 }}>{importNote}</Alert>}

        {undone && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {undone === 'done'
              ? 'Undone. The site is as it was before that import.'
              : `Undone: removed ${undone.modules} module(s), ${undone.posts} location(s) and document(s), ` +
                `${undone.attachments} media file(s) and ${undone.rows} record(s). The site is as it was before that import.`}
          </Alert>
        )}
        {summary && <ImportSummaryAlert summary={summary} />}
      </Paper>

      {/* Not dismissable mid-upload or mid-import: the progress bar is the only sign it is running. */}
      <Dialog open={file !== null} onClose={() => { if (stage === 'choosing') handleCancel(); }} maxWidth="sm" fullWidth>
        <DialogTitle>Import {file?.name}</DialogTitle>
        <DialogContent>
          {stage === 'choosing' && backup && selection ? (
            <>
              <Alert severity="info">
                Everything is ticked. Untick anything you don&apos;t want. Nothing already on
                this site is changed.
              </Alert>
              <ImportChecklist contents={backup.contents} selection={selection} onChange={setSelection} />
            </>
          ) : (
            <ProgressLine value={progress} label={progressLabel} note={cancelling ? '' : '(large backups can take a while)'} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button color="warning" onClick={handleCancel} disabled={cancelling !== null}>Cancel import</Button>
          {stage === 'choosing' && (
            <Button variant="contained" onClick={handleImport} disabled={pickedCount === 0}>
              Import {pickedCount} item{pickedCount === 1 ? '' : 's'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={confirmUndo} onClose={() => setConfirmUndo(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Undo this import?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes every module, location, document, media file and
            record that {interrupted?.fileName ?? 'this import'} added, including any edits made to
            them since. Nothing that was on the site before the import is touched.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmUndo(false)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={() => recover('undo')}>Undo import</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ProgressLine({ value, label, note = '' }: { value: number; label: string; note?: string }) {
  const percent = Math.round(value * 100);
  return (
    <Box sx={{ mt: 2 }}>
      <LinearProgress variant="determinate" value={percent} />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {label}… {percent}% {note}
      </Typography>
    </Box>
  );
}

interface InterruptedImportAlertProps {
  interrupted: Interrupted;
  recovering: 'resume' | 'undo' | null;
  progress: number;
  onResume: () => void;
  onUndo: () => void;
}

function InterruptedImportAlert({ interrupted, recovering, progress, onResume, onUndo }: InterruptedImportAlertProps) {
  const { status, fileName, message } = interrupted;
  const canResume = status?.resumable !== false;
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>An import did not finish</AlertTitle>
      <Typography variant="body2">
        {fileName}
        {status ? `: ${status.processed} of ${status.total} items were imported before it stopped.` : '.'}
        {message ? ` ${message}` : ''}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {canResume
          ? 'Resume to finish it, or undo to remove everything it added so far. Importing the file again instead would create duplicates.'
          : 'The uploaded file is no longer on the server, so it cannot be resumed. Undo what it added, then import the file again.'}
      </Typography>
      {recovering ? (
        <ProgressLine value={progress} label={recovering === 'resume' ? 'Resuming' : 'Undoing'} />
      ) : (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          {canResume && <Button size="small" variant="contained" onClick={onResume}>Resume import</Button>}
          <Button size="small" color="warning" variant="outlined" onClick={onUndo}>Undo what it added</Button>
        </Stack>
      )}
    </Alert>
  );
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

function ImportSummaryAlert({ summary }: { summary: ImportSummary }) {
  return (
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
          {summary.media_failed} media file(s) could not be recreated — any content
          referencing them will show a missing image.
        </Typography>
      )}
      {summary.items_failed > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {summary.items_failed} item(s) were skipped because the server failed while
          creating them.
        </Typography>
      )}
      {summary.records_skipped_unknown_user > 0 && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {summary.records_skipped_unknown_user} record(s) skipped: no matching staff
          account on this site. Create those accounts and re-import to bring their
          history across.
        </Typography>
      )}
    </Alert>
  );
}
