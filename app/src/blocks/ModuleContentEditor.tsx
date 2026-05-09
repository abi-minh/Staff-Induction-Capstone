import React, { useState } from 'react';
import {
  DragDropProvider,
  useDraggable,
  //useDroppable,
  DragOverlay
} from '@dnd-kit/react';

import {
  PointerSensor, 
  KeyboardSensor, 
  DragStartEvent, 
  DragEndEvent, 
} from '@dnd-kit/dom';

import {isSortable, SortableKeyboardPlugin} from '@dnd-kit/dom/sortable';

/*import {
  arrayMove
} from '@dnd-kit/helpers';*/

import {useSortable} from '@dnd-kit/react/sortable';
import { Box, Divider, IconButton, Paper, SvgIcon, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import SubjectIcon from '@mui/icons-material/Subject';
import type { Block, HeadingBlock, ImageBlock, ListBlock, TextBlock, VideoBlock } from '../types';
import { BLOCK_LABELS, createBlock } from './utils';
import HeadingBlockEditor from './editors/HeadingBlockEditor';
import ImageBlockEditor from './editors/ImageBlockEditor';
import ListBlockEditor from './editors/ListBlockEditor';
import TextBlockEditor from './editors/TextBlockEditor';
import VideoBlockEditor from './editors/VideoBlockEditor';
import { closestCenter } from '@dnd-kit/collision';

type ContentBlockType = 'heading' | 'text' | 'image' | 'video' | 'list';

const PALETTE: { type: ContentBlockType; Icon: typeof SvgIcon }[] = [
  { type: 'heading', Icon: FormatSizeIcon },
  { type: 'text',    Icon: SubjectIcon },
  { type: 'image',   Icon: ImageOutlinedIcon },
  { type: 'video',   Icon: OndemandVideoOutlinedIcon },
  { type: 'list',    Icon: FormatListBulletedIcon },
];

type DragState =
  | { kind: 'none' }
  | { kind: 'block'; blockId: string }
  | { kind: 'palette'; blockType: ContentBlockType };

// Renders block content as a document element (not a form).

const HEADING_VARIANT = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' } as const;

function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const b = block as HeadingBlock;
      return (
        <Typography
          variant={HEADING_VARIANT[b.data.level]}
          sx={{ my: 0.5, color: b.data.text ? 'text.primary' : 'text.disabled' }}
        >
          {b.data.text || 'Heading…'}
        </Typography>
      );
    }

    case 'text': {
      const b = block as TextBlock;
      if (!b.data.html) {
        return <Typography color="text.disabled" sx={{ py: 0.5 }}>Start writing…</Typography>;
      }
      return (
        <Box
          sx={{ '& p': { my: 0.5 }, '& a': { color: 'primary.main' } }}
          dangerouslySetInnerHTML={{ __html: b.data.html }}
        />
      );
    }

    case 'image': {
      const b = block as ImageBlock;
      if (!b.data.url) {
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 4,
              bgcolor: 'grey.50',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              color: 'text.disabled',
            }}
          >
            <ImageOutlinedIcon sx={{ fontSize: 36 }} />
            <Typography variant="body2">No image selected</Typography>
          </Box>
        );
      }
      return (
        <Box>
          <Box
            component="img"
            src={b.data.url}
            alt={b.data.alt}
            sx={{ maxWidth: '100%', display: 'block', borderRadius: 1 }}
          />
          {b.data.caption && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {b.data.caption}
            </Typography>
          )}
        </Box>
      );
    }

    case 'video': {
      const b = block as VideoBlock;
      if (!b.data.url) {
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 4,
              bgcolor: 'grey.50',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              color: 'text.disabled',
            }}
          >
            <OndemandVideoOutlinedIcon sx={{ fontSize: 36 }} />
            <Typography variant="body2">No video selected</Typography>
          </Box>
        );
      }
      return (
        <Box
          component="video"
          src={b.data.url}
          controls
          sx={{ maxWidth: '100%', display: 'block', borderRadius: 1 }}
        />
      );
    }

    case 'list': {
      const b = block as ListBlock;
      const filled = b.data.items.filter(Boolean);
      if (!filled.length) {
        return <Typography color="text.disabled" sx={{ py: 0.5 }}>Add list items…</Typography>;
      }
      return (
        <Box
          component={b.data.style === 'ordered' ? 'ol' : 'ul'}
          sx={{ pl: 3, my: 0.5, '& li': { mb: 0.25 } }}
        >
          {filled.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Box>
      );
    }

    default:
      return null;
  }
}

function PaletteItem({ type, Icon }: { type: ContentBlockType; Icon: typeof SvgIcon }) {
  const draggable = useDraggable({
    id: `palette-${type}`,
    data: { kind: 'palette', blockType: type },
  });

  return (
    <Box
      ref={draggable.ref}
      className={draggable.isDragging ? 'dragging' : ''}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        opacity: draggable.isDragging ? 0.3 : 1,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      <Icon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
        {BLOCK_LABELS[type]}
      </Typography>
    </Box>
  );
}

function BlockInserterPanel() {
  return (
    <Box
      sx={{
        width: 168,
        flexShrink: 0,
        position: 'sticky',
        top: 16,
        alignSelf: 'flex-start',
      }}
    >
      <Typography
        variant="overline"
        sx={{ display: 'block', color: 'text.secondary', mb: 1.25, letterSpacing: '0.1em', fontSize: '0.68rem' }}
      >
        Blocks
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {PALETTE.map(({ type, Icon }) => (
          <PaletteItem key={type} type={type} Icon={Icon} />
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5, display: 'block' }}>
        Drag a block into the canvas, or click a block in the canvas to edit it.
      </Typography>
    </Box>
  );
}

function DropZone({ index, isActive }: { index: number; isActive: boolean }) {
  /*const droppable = useDroppable({
    id: `dz-${index}`,
    data: { isDropZone: true, index },
    collisionDetector: closestCenter
  });*/
  const droppable = useSortable({
    id: `dz-${index}`,
    index,
    collisionDetector: closestCenter
  });

  return (
    <Box
      ref={droppable.ref}
      sx={{
        height: isActive ? (droppable.isDropTarget ? 64 : 40) : 8,
        my: isActive ? 0.5 : 0,
        border: isActive ? '2px dashed' : 'none',
        borderColor: droppable.isDropTarget ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        bgcolor: droppable.isDropTarget ? 'action.selected' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      {isActive && droppable.isDropTarget && (
        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
          Drop here
        </Typography>
      )}
    </Box>
  );
}

interface CanvasBlockProps {
  index: number;
  block: Block;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (data: Block['data']) => void;
}

function CanvasBlock({
  index,
  block,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onChange,
}: CanvasBlockProps) {
  const sortable = useSortable({
    id: block.id,
    index,
    data: { kind: 'block' },
    plugins: [SortableKeyboardPlugin]
  });

  function renderEditor() {
    switch (block.type) {
      case 'heading':
        return <HeadingBlockEditor block={block} onChange={onChange} />;
      case 'text':
        return <TextBlockEditor block={block} onChange={onChange} />;
      case 'image':
        return <ImageBlockEditor block={block} onChange={onChange} />;
      case 'video':
        return <VideoBlockEditor block={block} onChange={onChange} />;
      case 'list':
        return <ListBlockEditor block={block} onChange={onChange} />;
      default:
        return null;
    }
  }

  return (
    <Box
      ref={sortable.ref}
      className={sortable.isDragging ? 'dragging' : undefined}
      sx={{
        position: 'relative',
        opacity: sortable.isDragging ? 0.35 : 1,
        // Show drag handle on hover via child selector
        '&:hover .block-drag-handle': { opacity: 1 },
      }}
    >
      {/* Drag handle — always mounted, fades in on hover */}
      <Box
        className="block-drag-handle"
        sx={{
          position: 'absolute',
          left: -28,
          top: '50%',
          transform: 'translateY(-50%)',
          cursor: 'grab',
          color: 'text.disabled',
          touchAction: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          '&:active': { cursor: 'grabbing' },
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* Block card */}
      <Box
        onClick={() => { if (!isSelected) onSelect(); }}
        sx={{
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: isSelected ? 'primary.main' : 'transparent',
          cursor: isSelected ? 'default' : 'pointer',
          transition: 'border-color 0.15s',
          '&:hover': !isSelected
            ? { borderColor: 'grey.300' }
            : {},
        }}
      >
        {/* Block toolbar — visible when selected */}
        {isSelected && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 1,
              py: 0.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'grey.50',
              borderRadius: '6px 6px 0 0',
            }}
            // Stop click from bubbling to the deselect handler on the canvas
            onClick={(e) => e.stopPropagation()}
          >
            <Typography
              variant="overline"
              sx={{ fontSize: '0.65rem', color: 'text.secondary', flex: 1, letterSpacing: '0.1em' }}
            >
              {BLOCK_LABELS[block.type]}
            </Typography>
            <Tooltip title="Move up">
              <span>
                <IconButton size="small" onClick={onMoveUp} disabled={isFirst} sx={{ p: 0.25 }}>
                  <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton size="small" onClick={onMoveDown} disabled={isLast} sx={{ p: 0.25 }}>
                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete block">
              <IconButton size="small" color="error" onClick={onRemove} sx={{ p: 0.25 }}>
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Block content area */}
        <Box sx={{ p: 1.5 }}>
          {isSelected ? renderEditor() : <BlockPreview block={block} />}
        </Box>
      </Box>
    </Box>
  );
}

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function ModuleContentEditor({ blocks, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ kind: 'none' });

  const isDraggingFromPalette = dragState.kind === 'palette';

  function updateBlock(index: number, data: Block['data']) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], data } as Block;
    onChange(updated);
  }

  function removeBlock(index: number) {
    const removed = blocks[index];
    if (removed && selectedId === removed.id) setSelectedId(null);
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  }

  function insertBlock(type: ContentBlockType, atIndex: number) {
    const updated = [...blocks];
    const newBlock = createBlock(type);
    updated.splice(atIndex, 0, newBlock);
    onChange(updated);
    setSelectedId(newBlock.id);
  }

  function handleDragStart(event: DragStartEvent) {
    const {source} = event.operation;
    const d = source?.data as { kind: string; blockType?: ContentBlockType } | undefined;
    if (d?.kind === 'palette' && d.blockType) {
      setDragState({ kind: 'palette', blockType: d.blockType });
      setSelectedId(null);
    } else {
      setDragState({ kind: 'block', blockId: source?.id as string });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const state = dragState;
    setDragState({ kind: 'none' });
    const {operation} = event;
    const {source, target} = operation;

    if (!target) return;

    if (state.kind === 'palette') {
      if (isSortable(target) && target.isDropTarget && target.index !== undefined) {
        insertBlock(state.blockType, target.index);
      } else {
        // Dropped on an existing block — insert after it
        const idx = blocks.findIndex((b) => b.id === target?.id);
        if (idx >= 0) insertBlock(state.blockType, idx + 1);
      }
    } else if (state.kind === 'block') {
      if (isSortable(source) && isSortable(target) && target.index != source.index) {
       if (source.index >= 0) {
        const newItems = [...blocks];
        const [removed] = newItems.splice(target.index, 1);
        newItems.splice(source.index, 0, removed);
        blocks = newItems;
        onChange(blocks);
       } 
      }
    }       
  }

  // Overlay label for the drag ghost
  const overlayBlock =
    dragState.kind === 'block' ? blocks.find((b) => b.id === dragState.blockId) : null;
  const overlayLabel =
    dragState.kind === 'palette'
      ? BLOCK_LABELS[dragState.blockType]
      : overlayBlock
        ? BLOCK_LABELS[overlayBlock.type]
        : null;

  return (
    <DragDropProvider
      sensors={[
        PointerSensor,
        KeyboardSensor
      ]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}
        // Click on canvas background deselects
        onClick={() => setSelectedId(null)}
      >
        {/* Left: block inserter panel */}
        <Box onClick={(e) => e.stopPropagation()}>
          <BlockInserterPanel />
        </Box>

        {/* Right: document canvas */}
        <Box
          sx={{ flex: 1, minWidth: 0, pl: { md: 3 } }}
          onClick={(e) => e.stopPropagation()}
        >
          

            {/* Empty state */}
            {blocks.length === 0 && !isDraggingFromPalette && (
              <Box
                sx={{
                  py: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  color: 'text.disabled',
                }}
              >
                <Typography sx={{ fontSize: '0.875rem' }}>
                  Drag a block from the left panel to start building content.
                </Typography>
              </Box>
            )}

            <DropZone index={0} isActive={isDraggingFromPalette} />

            {blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                <CanvasBlock
                  index={index}
                  block={block}
                  isSelected={selectedId === block.id}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  onSelect={() => setSelectedId(block.id)}
                  onRemove={() => removeBlock(index)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  onChange={(data) => updateBlock(index, data)}
                />
                <DropZone index={index + 1} isActive={isDraggingFromPalette} />
              </React.Fragment>
            ))}

          
        </Box>
      </Box>

      <DragOverlay dropAnimation={null}>
        {overlayLabel && (
          <Paper
            variant="outlined"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderRadius: 1.5,
              borderColor: 'primary.main',
              boxShadow: 8,
              bgcolor: 'background.paper',
              cursor: 'grabbing',
              minWidth: 140,
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {overlayLabel}
            </Typography>
          </Paper>
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}
