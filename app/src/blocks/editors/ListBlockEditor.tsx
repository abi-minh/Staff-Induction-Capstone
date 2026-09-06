import { Box, Button, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import type { ListBlock, ListStyle } from '../../types';

interface Props {
  block: ListBlock;
  onChange: (data: ListBlock['data']) => void;
}

export default function ListBlockEditor({ block, onChange }: Props) {
  function updateItem(index: number, value: string) {
    const items = [...block.data.items];
    items[index] = value;
    onChange({ ...block.data, items });
  }

  function addItem() {
    onChange({ ...block.data, items: [...block.data.items, ''] });
  }

  function removeItem(index: number) {
    if (block.data.items.length <= 1) return;
    onChange({ ...block.data, items: block.data.items.filter((_, i) => i !== index) });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        select
        size="small"
        label="List type"
        value={block.data.style}
        onChange={(e) => onChange({ ...block.data, style: e.target.value as ListStyle })}
        sx={{ maxWidth: 200 }}
      >
        <MenuItem value="unordered">Bullet list</MenuItem>
        <MenuItem value="ordered">Numbered list</MenuItem>
      </TextField>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {block.data.items.map((item, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
              {block.data.style === 'ordered' ? `${index + 1}.` : '•'}
            </Typography>
            <TextField
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder="List item…"
              size="small"
              fullWidth
            />
            <IconButton
              size="small"
              color="error"
              onClick={() => removeItem(index)}
              disabled={block.data.items.length <= 1}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        ))}
      </Box>

      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={addItem}
        sx={{ alignSelf: 'flex-start', borderRadius: '10px' }}
      >
        Add item
      </Button>
    </Box>
  );
}
