import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, TextField, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TextBlockEditor from '../blocks/editors/TextBlockEditor';
import { useReminderContext, useSendTrainingReminder } from '../hooks/useStaff';
import { defaultReminderBody, defaultReminderSubject } from '../util/reminderEmail';
import { stripHtml } from '../util/strings';
import type { StaffMember } from '../types';

const SUBJECT_MAX_LENGTH = 200;

interface Props {
  staff: StaffMember;
  onClose: () => void;
  onResult: (notice: { severity: 'success' | 'error'; message: string }) => void;
}

// Composes a training reminder and lets the admin edit it before it goes out.
// The draft starts from util/reminderEmail.ts and is fully editable — whatever
// is in the editor when Send is pressed is exactly what gets mailed.
export default function ReminderDialog({ staff, onClose, onResult }: Props) {
  const { data: context, isLoading, error } = useReminderContext(staff.id);
  const sendReminder = useSendTrainingReminder();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  // TipTap only reads its `content` prop when the editor is created, so
  // restoring the default draft needs a fresh instance, not a state change.
  const [editorKey, setEditorKey] = useState(0);

  const loadDefaults = useCallback(() => {
    if (!context) return;
    setSubject(defaultReminderSubject(context));
    setBody(defaultReminderBody(context));
    setEditorKey((key) => key + 1);
  }, [context]);

  useEffect(() => {
    loadDefaults();
  }, [loadDefaults]);

  const recipient = context?.email || staff.email;
  const bodyIsEmpty = !stripHtml(body);
  const canSend = !!recipient && !!subject.trim() && !bodyIsEmpty && !sendReminder.isLoading;

  async function handleSend() {
    try {
      const result = await sendReminder.mutateAsync({
        id: staff.id,
        draft: { subject: subject.trim(), body },
      });
      onResult({ severity: 'success', message: `Reminder sent to ${result.email}.` });
      onClose();
    } catch (err) {
      onResult({
        severity: 'error',
        message: err instanceof Error ? err.message : `Could not send a reminder to ${staff.name}.`,
      });
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Reminder for {staff.name}</DialogTitle>

      <DialogContent>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!!error && <Alert severity="error">{(error as Error).message}</Alert>}

        {context && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              To:{' '}
              {recipient || (
                <Box component="span" sx={{ color: 'error.main' }}>
                  no email address on file
                </Box>
              )}
            </Typography>

            {context.modules.length === 0 && (
              <Alert severity="info">
                {staff.name} has no outstanding training. You can still send a
                message, but the default draft has nothing to list.
              </Alert>
            )}

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
                block={{ id: 'reminder-body', type: 'text', data: { html: body } }}
                onChange={(data) => setBody(data.html)}
              />
              {bodyIsEmpty && (
                <Typography variant="caption" color="error">
                  The message can't be empty.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {context && (
          <Button
            startIcon={<RestartAltIcon />}
            onClick={loadDefaults}
            disabled={sendReminder.isLoading}
            sx={{ mr: 'auto', color: 'text.secondary' }}
          >
            Reset to default
          </Button>
        )}
        <Button onClick={onClose} disabled={sendReminder.isLoading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSend} disabled={!canSend}>
          {sendReminder.isLoading ? 'Sending…' : 'Send email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
