import { Box, InputBase, MenuItem, Select } from '@mui/material';
import type { BlockAlign, HeadingBlock, HeadingLevel } from '../../types';
import TextAlignControls from '../TextAlignControls';

interface Props {
  block: HeadingBlock;
  onChange: (data: HeadingBlock['data']) => void;
  onTextAlignChange?: (align: BlockAlign) => void;
}

const LEVEL_STYLE: Record<HeadingLevel, { fontSize: string; fontWeight: number }> = {
  1: { fontSize: '2rem',    fontWeight: 700 },
  2: { fontSize: '1.6rem',  fontWeight: 700 },
  3: { fontSize: '1.35rem', fontWeight: 600 },
  4: { fontSize: '1.15rem', fontWeight: 600 },
};

export default function HeadingBlockEditor({ block, onChange, onTextAlignChange }: Props) {
  const style = LEVEL_STYLE[block.data.level];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Select
        value={block.data.level}
        onChange={(e) => onChange({ ...block.data, level: Number(e.target.value) as HeadingLevel })}
        variant="outlined"
        size="small"
        sx={{ minWidth: 72 }}
      >
        <MenuItem value={1}>H1</MenuItem>
        <MenuItem value={2}>H2</MenuItem>
        <MenuItem value={3}>H3</MenuItem>
        <MenuItem value={4}>H4</MenuItem>
      </Select>

      {onTextAlignChange && (
        <TextAlignControls value={block.textAlign} onChange={onTextAlignChange} />
      )}

      <InputBase
        fullWidth
        value={block.data.text}
        onChange={(e) => onChange({ ...block.data, text: e.target.value })}
        placeholder="Heading text…"
        sx={{
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: 1.2,
          '& input': { p: 0, textAlign: block.textAlign ?? 'left' },
        }}
      />
    </Box>
  );
}
