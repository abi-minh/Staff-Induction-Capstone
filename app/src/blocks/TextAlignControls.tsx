import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import type { BlockAlign } from '../types';

interface Props {
  value?: BlockAlign;
  onChange: (align: BlockAlign) => void;
}

export default function TextAlignControls({ value, onChange }: Props) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value ?? 'left'}
      onChange={(_, next: BlockAlign | null) => next && onChange(next)}
    >
      <ToggleButton value="left" sx={{ p: 0.5 }}>
        <Tooltip title="Align text left"><FormatAlignLeftIcon sx={{ fontSize: 16 }} /></Tooltip>
      </ToggleButton>
      <ToggleButton value="center" sx={{ p: 0.5 }}>
        <Tooltip title="Align text centre"><FormatAlignCenterIcon sx={{ fontSize: 16 }} /></Tooltip>
      </ToggleButton>
      <ToggleButton value="right" sx={{ p: 0.5 }}>
        <Tooltip title="Align text right"><FormatAlignRightIcon sx={{ fontSize: 16 }} /></Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
