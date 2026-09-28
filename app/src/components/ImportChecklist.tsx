import { Box, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material';
import type { BackupContents, ImportSelection } from '../api/transfer';

const GROUPS: { key: keyof BackupContents; label: string }[] = [
  { key: 'modules', label: 'Modules' },
  { key: 'locations', label: 'Locations' },
  { key: 'documents', label: 'Documents' },
];

interface Props {
  contents: BackupContents;
  selection: ImportSelection;
  onChange: (selection: ImportSelection) => void;
}

export default function ImportChecklist({ contents, selection, onChange }: Props) {
  function toggle(group: keyof BackupContents, index: number) {
    const picked = selection[group];
    const next = picked.includes(index) ? picked.filter((i) => i !== index) : [...picked, index];
    onChange({ ...selection, [group]: next });
  }

  function toggleGroup(group: keyof BackupContents) {
    const all = contents[group].map((item) => item.index);
    onChange({ ...selection, [group]: selection[group].length === all.length ? [] : all });
  }

  return (
    <Box sx={{ mt: 2 }}>
      {GROUPS.filter(({ key }) => contents[key].length > 0).map(({ key, label }) => {
        const count = selection[key].length;
        const total = contents[key].length;
        return (
          <Box key={key} sx={{ mb: 1.5 }}>
            <FormControlLabel
              label={<Typography sx={{ fontWeight: 700 }}>{label} ({count} of {total})</Typography>}
              control={
                <Checkbox
                  checked={count === total}
                  indeterminate={count > 0 && count < total}
                  onChange={() => toggleGroup(key)}
                />
              }
            />
            <Box sx={{ maxHeight: 200, overflowY: 'auto', pl: 3.5, borderLeft: 1, borderColor: 'divider' }}>
              {contents[key].map((item) => (
                <FormControlLabel
                  key={item.index}
                  sx={{ display: 'flex' }}
                  control={
                    <Checkbox size="small" checked={selection[key].includes(item.index)} onChange={() => toggle(key, item.index)} />
                  }
                  label={
                    <Typography variant="body2">
                      {item.title || '(untitled)'}
                      {item.status === 'draft' && <Chip label="Draft" size="small" sx={{ ml: 1 }} />}
                    </Typography>
                  }
                />
              ))}
            </Box>
          </Box>
        );
      })}
      <Typography variant="caption" color="text.secondary">
        Media used by the ticked items comes with them, and so do the ticked modules&apos; staff
        progress, assignments and quiz results. An item whose title already exists here is
        imported as a draft copy marked &quot;restored&quot;, so you can review it before staff see it.
      </Typography>
    </Box>
  );
}
