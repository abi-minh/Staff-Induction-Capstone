import { Box, MenuItem, TextField } from '@mui/material';
import type { CalloutBlock, CalloutVariant } from '../../types';

interface Props {
  block: CalloutBlock;
  onChange: (data: CalloutBlock['data']) => void;
}

const VARIANT_LABELS: Record<CalloutVariant, string> = {
  info:    'Info',
  warning: 'Warning',
  success: 'Success',
  note:    'Note',
};

export default function CalloutBlockEditor({ block, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          select
          size="small"
          label="Variant"
          value={block.data.variant}
          onChange={(e) => onChange({ ...block.data, variant: e.target.value as CalloutVariant })}
          sx={{ minWidth: 120 }}
        >
          {(Object.keys(VARIANT_LABELS) as CalloutVariant[]).map((v) => (
            <MenuItem key={v} value={v}>{VARIANT_LABELS[v]}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Title (optional)"
          value={block.data.title ?? ''}
          onChange={(e) => onChange({ ...block.data, title: e.target.value })}
          sx={{ flex: 1 }}
        />
      </Box>
      <TextField
        size="small"
        label="Body"
        value={block.data.body}
        onChange={(e) => onChange({ ...block.data, body: e.target.value })}
        multiline
        minRows={3}
      />
    </Box>
  );
}
