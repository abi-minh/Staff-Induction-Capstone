import { useEffect, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, TextField, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import TextBlockEditor from '../blocks/editors/TextBlockEditor';
import { useReminderContexts, useSendBulkReminders } from '../hooks/useStaff';
import {
  REMINDER_TOKENS, defaultBulkBody, defaultBulkSubject, renderReminder,
} from '../util/reminderEmail';
import { stripHtml } from '../util/strings';
import type { BulkReminderOutcome } from '../api/staff';

const SUBJECT_MAX_LENGTH = 200;

interface Props {
  staffIds: number[];
  onClose: () => void;
  onResult: (notice: { severity: 'success' | 'info' | 'error'; message: string }) => void;
}

// One template, sent to many. Each recipient's copy is rendered from the
// template in the browser, so the module list is theirs and the wording is the
// admin's — the server composes nothing either way.
export default function BulkReminderDialog({ staffIds, onClose, onResult }: Props) {
  const { data: contexts = [], isLoading, error } = useReminderContexts(staffIds);
  const send = useSendBulkReminders();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(defaultBulkBody());
  const [editorKey, setEditorKey] = useState(0);
  const [sendError, setSendError] = useState('');
  const [outcome, setOutcome] = useState<BulkReminderOutcome | null>(null);

  // The subject carries the site name, which only arrives with the contexts.
  useEffect(() => {
    if (!contexts.length) return;
    setSubject(defaultBulkSubject(contexts[0].siteName));
  }, [contexts]);

  function resetTemplate() {
    setSubject(defaultBulkSubject(contexts[0]?.siteName ?? ''));
    setBody(defaultBulkBody());
    setEditorKey((k) => k + 1);
  }

  const sendable = contexts.filter((c) => !!c.email);
  const missingEmail = contexts.filter((c) => !c.email);
  const preview = sendable[0] ? renderReminder(body, sendable[0]) : '';
  const bodyIsEmpty = !stripHtml(body);
  const canSend = sendable.length > 0 && !!subject.trim() && !bodyIsEmpty && !send.isLoading;

  async function handleSend() {
    setSendError('');
    try {
      const result = await send.mutateAsync(
        sendable.map((context) => ({
          userId: context.userId,
          subject: subject.trim(),
          body: renderReminder(body, context),
        })),
      );
      setOutcome(result);
      // Kept open on partial failure so the per-recipient list can be read;
      // a clean run reports upward and closes.
      if (result.failed === 0) {
        onResult({
          severity: 'success',
          message: `Reminder sent to ${result.sent} staff member${result.sent === 1 ? '' : 's'}.`,
        });
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send the reminders.');
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Remind {staffIds.length} staff member{staffIds.length === 1 ? '' : 's'}
      </DialogTitle>

      <DialogContent>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!!error && <Alert severity="error">{(error as Error).message}</Alert>}

        {outcome && (
          <Alert severity={outcome.failed ? 'warning' : 'success'} sx={{ mb: 2 }}>
            <AlertTitle>
              {outcome.sent} sent{outcome.failed ? `, ${outcome.failed} failed` : ''}
            </AlertTitle>
            {outcome.results
              .filter((r) => !r.sent)
              .map((r) => (
                <Typography key={r.userId} variant="body2">
                  {r.name || `#${r.userId}`} — {r.reason}
                </Typography>
              ))}
          </Alert>
        )}

        {!isLoading && !error && !outcome && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Sending to {sendable.length} of {contexts.length} selected:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {sendable.map((c) => (
                  <Chip
                    key={c.userId}
                    size="small"
                    label={`${c.name}${c.modules.length ? ` · ${c.modules.length}` : ' · up to date'}`}
                  />
                ))}
              </Box>
              {missingEmail.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  Skipping {missingEmail.length}: no email address on file for{' '}
                  {missingEmail.map((c) => c.name).join(', ')}.
                </Alert>
              )}
            </Box>

            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX_LENGTH))}
              fullWidth
              size="small"
            />

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                Message
              </Typography>
              <TextBlockEditor
                key={editorKey}
                block={{ id: 'bulk-reminder-body', type: 'text', data: { html: body } }}
                onChange={(data) => setBody(data.html)}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Placeholders filled in per person:{' '}
                {Object.values(REMINDER_TOKENS).join('  ')}
              </Typography>
              {bodyIsEmpty && (
                <Typography variant="caption" color="error">
                  The message can't be empty.
                </Typography>
              )}
            </Box>

            {sendable[0] && (
              <Box>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                  Preview — as {sendable[0].name} will receive it
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'chipInfo.bg',
                    '& ul': { pl: 3, my: 0.5 },
                    '& p': { my: 0.5 },
                  }}
                  // Rendered from the admin's own template; sanitised again by
                  // wp_kses_post() before anything is mailed.
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              </Box>
            )}

            {sendError && <Alert severity="error">{sendError}</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!outcome && contexts.length > 0 && (
          <Button
            startIcon={<RestartAltIcon />}
            onClick={resetTemplate}
            disabled={send.isLoading}
            sx={{ mr: 'auto', color: 'text.secondary' }}
          >
            Reset to default
          </Button>
        )}
        <Button onClick={onClose} disabled={send.isLoading}>
          {outcome ? 'Close' : 'Cancel'}
        </Button>
        {!outcome && (
          <Button
            variant="contained"
            startIcon={<MailOutlinedIcon />}
            onClick={handleSend}
            disabled={!canSend}
          >
            {send.isLoading ? 'Sending…' : `Send ${sendable.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
