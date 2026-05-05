import { useState } from 'react';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { Block, BlockType } from '../types';
import { BLOCK_LABELS, createBlock } from './utils';
import HeadingBlockEditor from './editors/HeadingBlockEditor';
import ImageBlockEditor from './editors/ImageBlockEditor';
import ListBlockEditor from './editors/ListBlockEditor';
import MultipleChoiceEditor from './editors/MultipleChoiceEditor';
import TextBlockEditor from './editors/TextBlockEditor';
import TrueFalseEditor from './editors/TrueFalseEditor';
import VideoBlockEditor from './editors/VideoBlockEditor';

const BLOCK_TYPES: BlockType[] = [
  'heading',
  'text',
  'image',
  'video',
  'list',
  'multiple_choice',
  'true_false',
];

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function BlockEditor({ blocks, onChange }: Props) {
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);

  function updateBlock(index: number, data: Block['data']) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], data } as Block;
    onChange(updated);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;

    const updated = [...blocks];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  }

  function insertBlock(type: BlockType, atIndex: number) {
    const newBlock = createBlock(type);
    const updated = [...blocks];
    updated.splice(atIndex, 0, newBlock);
    onChange(updated);
    setAddMenuIndex(null);
  }

  function renderEditor(block: Block, index: number) {
    switch (block.type) {
      case 'heading':
        return <HeadingBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'text':
        return <TextBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'image':
        return <ImageBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'video':
        return <VideoBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'list':
        return <ListBlockEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'multiple_choice':
        return <MultipleChoiceEditor block={block} onChange={(data) => updateBlock(index, data)} />;
      case 'true_false':
        return <TrueFalseEditor block={block} onChange={(data) => updateBlock(index, data)} />;
    }
  }

  return (
    <Box>
      {blocks.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No blocks yet. Add one below.
        </Typography>
      )}

      {blocks.map((block, index) => (
        <Paper
          key={block.id}
          variant="outlined"
          sx={{
            position: 'relative',
            p: 2.5,
            pl: { xs: 2.5, md: 8.5 },
            mb: 2,
            borderRadius: 2,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontSize: '1.15rem', fontWeight: 700 }}>
              {BLOCK_LABELS[block.type]}
            </Typography>

            <IconButton color="error" onClick={() => removeBlock(index)}>
              <DeleteOutlineIcon />
            </IconButton>
          </Box>

          <Box>{renderEditor(block, index)}</Box>

          <Box
            sx={{
              position: { xs: 'static', md: 'absolute' },
              left: { md: 16 },
              top: { md: '50%' },
              transform: { md: 'translateY(-50%)' },
              mt: { xs: 2, md: 0 },
              display: 'flex',
              justifyContent: { xs: 'flex-start', md: 'initial' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'row', md: 'column' },
                gap: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <IconButton
                size="small"
                onClick={() => moveBlock(index, -1)}
                disabled={index === 0}
              >
                <KeyboardArrowUpIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      ))}

      <Box sx={{ mt: 1 }}>
        {addMenuIndex === null ? (
          <Button type="button" variant="outlined" onClick={() => setAddMenuIndex(blocks.length)}>
            Add block
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {BLOCK_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outlined"
                onClick={() => insertBlock(type, addMenuIndex)}
              >
                {BLOCK_LABELS[type]}
              </Button>
            ))}
            <Button type="button" variant="text" onClick={() => setAddMenuIndex(null)}>
              Cancel
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
