import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import type { BlockAlign, BlockLayout } from '../types';

const WIDTH_PRESETS = [25, 50, 75, 100];

interface Props {
  layout?: BlockLayout;
  onChange: (layout: BlockLayout) => void;
}

export default function LayoutControls({ layout, onChange }: Props) {
  const align: BlockAlign = layout?.align ?? 'left';
  const width = layout?.width ?? 100;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={align}
        onChange={(_, next: BlockAlign | null) => next && onChange({ ...layout, align: next })}
      >
        <ToggleButton value="left" sx={{ p: 0.5 }}>
          <Tooltip title="Position block left"><FormatAlignLeftIcon sx={{ fontSize: 16 }} /></Tooltip>
        </ToggleButton>
        <ToggleButton value="center" sx={{ p: 0.5 }}>
          <Tooltip title="Position block centre"><FormatAlignCenterIcon sx={{ fontSize: 16 }} /></Tooltip>
        </ToggleButton>
        <ToggleButton value="right" sx={{ p: 0.5 }}>
          <Tooltip title="Position block right"><FormatAlignRightIcon sx={{ fontSize: 16 }} /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={WIDTH_PRESETS.includes(width) ? width : null}
        onChange={(_, next: number | null) => next && onChange({ ...layout, width: next })}
      >
        {WIDTH_PRESETS.map((w) => (
          <ToggleButton
            key={w}
            value={w}
            sx={{ px: 0.75, py: 0.5, fontSize: 11, textTransform: 'none', minWidth: 34 }}
          >
            {w === 100 ? 'Full' : `${w}%`}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
