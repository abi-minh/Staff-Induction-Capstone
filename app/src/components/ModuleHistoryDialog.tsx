import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { useModuleVersions, useRestoreModuleVersion } from '../hooks/useModuleVersions';
import type { ModuleVersion } from '../api/moduleVersions';

// Mirrors INDUCTION_MODULE_VERSION_LIMIT in the plugin; shown as guidance only.
const VERSION_LIMIT_HINT = 30;

interface Props {
  moduleId: number;
  open: boolean;
  onClose: () => void;
  /** Called after a successful restore so the editor can reload its state. */
  onRestored: () => void;
}

function formatWhen(mysqlDate: string): string {
  // Stored as WP-local 'Y-m-d H:i:s'; the space needs replacing for Safari.
  const d = new Date(mysqlDate.replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? mysqlDate
    : d.toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ModuleHistoryDialog({ moduleId, open, onClose, onRestored }: Props) {
  const { data: versions = [], isLoading, error } = useModuleVersions(moduleId, open);
  const restore = useRestoreModuleVersion(moduleId);

  const [confirming, setConfirming] = useState<ModuleVersion | null>(null);
  const [restoreError, setRestoreError] = useState('');

  async function handleRestore() {
    if (!confirming) return;
    setRestoreError('');
    try {
      await restore.mutateAsync(confirming.version);
      setConfirming(null);
      onRestored();
      onClose();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not restore that version.');
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Content history</DialogTitle>
        <DialogContent>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!!error && <Alert severity="error">{(error as Error).message}</Alert>}

          {!isLoading && !error && versions.length === 0 && (
            <Typography color="text.secondary">
              No history yet. A version is recorded each time this module's sections
              change, so the first entry will appear after your next save.
            </Typography>
          )}

          {versions.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Restoring brings back a previous state as a new version — nothing is
                deleted, so a restore can itself be undone. The last{' '}
                {VERSION_LIMIT_HINT} versions are kept.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Version', 'Saved', 'By', 'Sections', 'Size', ''].map((h, i) => (
                      <TableCell key={h || i} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.version} hover>
                      <TableCell>
                        v{v.version}
                        {v.isCurrent && (
                          <Chip label="current" size="small" color="success" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>{formatWhen(v.createdAt)}</TableCell>
                      <TableCell>{v.authorName || '—'}</TableCell>
                      <TableCell>{v.sectionCount}</TableCell>
                      <TableCell>{formatSize(v.sizeBytes)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<RestoreIcon />}
                          disabled={v.isCurrent || restore.isLoading}
                          onClick={() => setConfirming(v)}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirming} onClose={() => setConfirming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Restore v{confirming?.version}?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This replaces the module's current sections with the {confirming?.sectionCount}{' '}
            section{confirming?.sectionCount === 1 ? '' : 's'} saved on{' '}
            {confirming ? formatWhen(confirming.createdAt) : ''}. The current content is
            kept in history, so you can restore back to it.
          </Typography>
          {restoreError && <Alert severity="error" sx={{ mt: 2 }}>{restoreError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirming(null)} disabled={restore.isLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleRestore} disabled={restore.isLoading}>
            {restore.isLoading ? 'Restoring…' : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

