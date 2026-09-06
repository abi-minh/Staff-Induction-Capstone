import React, { useState } from "react";
import {
  DragDropProvider,
  useDraggable,
  //useDroppable,
  DragOverlay,
} from "@dnd-kit/react";

import {
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/dom";

import { isSortable, SortableKeyboardPlugin } from "@dnd-kit/dom/sortable";

/*import {
  arrayMove
} from '@dnd-kit/helpers';*/

import { useSortable } from "@dnd-kit/react/sortable";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  SvgIcon,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatSizeIcon from "@mui/icons-material/FormatSize";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SubjectIcon from "@mui/icons-material/Subject";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import type {
  Block,
  BlockAlign,
  BlockLayout,
  PlacedBlock,
  RowChildBlock,
} from "../types";
import { BLOCK_LABELS, createBlock, isRowChildType, layoutOf } from "./utils";
import { renderBlockContent } from "./renderContent";
import LayoutControls from "./LayoutControls";
import CalloutBlockEditor from "./editors/CalloutBlockEditor";
import HeadingBlockEditor from "./editors/HeadingBlockEditor";
import ImageBlockEditor from "./editors/ImageBlockEditor";
import ListBlockEditor from "./editors/ListBlockEditor";
import RowBlockEditor from "./editors/RowBlockEditor";
import ChildPreview from "./editors/RowBlockEditor/ChildPreview";
import TextBlockEditor from "./editors/TextBlockEditor";
import VideoBlockEditor from "./editors/VideoBlockEditor";
import { closestCenter } from "@dnd-kit/collision";

type ContentBlockType =
  | "heading"
  | "text"
  | "image"
  | "video"
  | "list"
  | "callout"
  | "row";

const PALETTE: { type: ContentBlockType; Icon: typeof SvgIcon }[] = [
  { type: "heading", Icon: FormatSizeIcon },
  { type: "text", Icon: SubjectIcon },
  { type: "image", Icon: ImageOutlinedIcon },
  { type: "video", Icon: OndemandVideoOutlinedIcon },
  { type: "list", Icon: FormatListBulletedIcon },
  { type: "callout", Icon: InfoOutlinedIcon },
  { type: "row", Icon: ViewColumnOutlinedIcon },
];

type DragState =
  | { kind: "none" }
  | { kind: "block"; blockId: string }
  | { kind: "palette"; blockType: ContentBlockType };

// Renders block content as a document element (not a form).

const HEADING_VARIANT = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" } as const;

function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.data.text
        ? renderBlockContent(block)
        : (
          <Typography variant={HEADING_VARIANT[block.data.level]} sx={{ my: 0.5, color: "text.disabled" }}>
            Heading…
          </Typography>
        );

    case "text":
      return block.data.html
        ? renderBlockContent(block)
        : <Typography color="text.disabled" sx={{ py: 0.5 }}>Start writing…</Typography>;

    case "image":
      return block.data.url
        ? renderBlockContent(block)
        : <MediaPlaceholder Icon={ImageOutlinedIcon} label="No image selected" />;

    case "video":
      return block.data.url
        ? renderBlockContent(block)
        : <MediaPlaceholder Icon={OndemandVideoOutlinedIcon} label="No video selected" />;

    case "list":
      return block.data.items.some(Boolean)
        ? renderBlockContent(block)
        : <Typography color="text.disabled" sx={{ py: 0.5 }}>Add list items…</Typography>;

    case "callout":
      return block.data.body || block.data.title
        ? renderBlockContent(block)
        : <Typography color="text.disabled" sx={{ py: 0.5 }}>Empty callout…</Typography>;

    case "row":
      return block.data.children.length
        ? renderBlockContent(block, (child) => <ChildPreview block={child} />)
        : (
          <Typography color="text.disabled" sx={{ py: 0.5, fontSize: "0.85rem" }}>
            Empty row · {block.data.columns} columns
          </Typography>
        );

    default:
      return null;
  }
}

function MediaPlaceholder({ Icon, label }: { Icon: typeof SvgIcon; label: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: 4,
        bgcolor: "grey.50",
        border: "2px dashed",
        borderColor: "divider",
        borderRadius: 1,
        color: "text.disabled",
      }}
    >
      <Icon sx={{ fontSize: 36 }} />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
}

function LivePreview({ block }: { block: Block }) {
  const lo = layoutOf(block);
  const isMedia = block.type === "image" || block.type === "video";
  const narrowed = !!lo?.width && lo.width < 100;
  const widthLabel = narrowed ? `${lo?.width}% width` : "Full width";
  const alignLabel =
    narrowed && lo?.align && lo.align !== "left" ? ` · ${lo.align}` : "";

  const boundsSx = isMedia
    ? {
        "& img, & video": {
          outline: "1px dashed",
          outlineColor: "primary.light",
          outlineOffset: 2,
        },
      }
    : {
        "& > *": {
          outline: "1px dashed",
          outlineColor: "primary.light",
          outlineOffset: 2,
          bgcolor: "background.paper",
        },
      };

  return (
    <Box
      sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}
    >
      <Typography
        variant="overline"
        sx={{
          display: "block",
          fontSize: "0.62rem",
          color: "text.secondary",
          mb: 0.75,
          letterSpacing: "0.1em",
        }}
      >
        Live preview · {widthLabel}
        {alignLabel}
      </Typography>
      <Box sx={{ bgcolor: "grey.100", borderRadius: 1, p: 1.5, ...boundsSx }}>
        <BlockPreview block={block} />
      </Box>
    </Box>
  );
}

function PaletteItem({
  type,
  Icon,
}: {
  type: ContentBlockType;
  Icon: typeof SvgIcon;
}) {
  const draggable = useDraggable({
    id: `palette-${type}`,
    data: { kind: "palette", blockType: type },
  });

  return (
    <Box
      ref={draggable.ref}
      className={draggable.isDragging ? "dragging" : ""}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        opacity: draggable.isDragging ? 0.3 : 1,
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
        "&:active": { cursor: "grabbing" },
      }}
    >
      <Icon sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>
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
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
      }}
    >
      <Typography
        variant="overline"
        sx={{
          display: "block",
          color: "text.secondary",
          mb: 1.25,
          letterSpacing: "0.1em",
          fontSize: "0.68rem",
        }}
      >
        Blocks
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {PALETTE.map(({ type, Icon }) => (
          <PaletteItem key={type} type={type} Icon={Icon} />
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ lineHeight: 1.5, display: "block" }}
      >
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
    collisionDetector: closestCenter,
  });

  return (
    <Box
      ref={droppable.ref}
      sx={{
        height: isActive ? (droppable.isDropTarget ? 64 : 40) : 8,
        my: isActive ? 0.5 : 0,
        border: isActive ? "2px dashed" : "none",
        borderColor: droppable.isDropTarget ? "primary.main" : "divider",
        borderRadius: 1.5,
        bgcolor: droppable.isDropTarget ? "action.selected" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
      }}
    >
      {isActive && droppable.isDropTarget && (
        <Typography
          variant="caption"
          color="primary.main"
          sx={{ fontWeight: 700 }}
        >
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
  onChange: (data: Block["data"]) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onTextAlignChange: (align: BlockAlign) => void;
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
  onLayoutChange,
  onTextAlignChange,
}: CanvasBlockProps) {
  const sortable = useSortable({
    id: block.id,
    index,
    data: { kind: "block" },
    plugins: [SortableKeyboardPlugin],
  });

  function renderEditor() {
    switch (block.type) {
      case "heading":
        return (
          <HeadingBlockEditor
            block={block}
            onChange={onChange}
            onTextAlignChange={onTextAlignChange}
          />
        );
      case "text":
        return (
          <TextBlockEditor
            block={block}
            onChange={onChange}
            onTextAlignChange={onTextAlignChange}
          />
        );
      case "image":
        return (
          <ImageBlockEditor
            block={block}
            onChange={onChange}
            layout={block.layout}
            onLayoutChange={onLayoutChange}
          />
        );
      case "video":
        return (
          <VideoBlockEditor
            block={block}
            onChange={onChange}
            layout={block.layout}
            onLayoutChange={onLayoutChange}
          />
        );
      case "list":
        return <ListBlockEditor block={block} onChange={onChange} />;
      case "callout":
        return <CalloutBlockEditor block={block} onChange={onChange} />;
      case "row":
        return <RowBlockEditor block={block} onChange={onChange} />;
      default:
        return null;
    }
  }

  return (
    <Box
      ref={sortable.ref}
      className={sortable.isDragging ? "dragging" : undefined}
      sx={{
        position: "relative",
        opacity: sortable.isDragging ? 0.35 : 1,
        // Show drag handle on hover via child selector
        "&:hover .block-drag-handle": { opacity: 1 },
      }}
    >
      <Box
        ref={sortable.handleRef}
        className="block-drag-handle"
        sx={{
          position: "absolute",
          left: -28,
          top: "50%",
          transform: "translateY(-50%)",
          cursor: "grab",
          color: "text.disabled",
          touchAction: "none",
          opacity: 0,
          transition: "opacity 0.15s",
          "&:active": { cursor: "grabbing" },
          display: { xs: "none", md: "flex" },
          alignItems: "center",
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* Block card */}
      <Box
        onClick={() => {
          if (!isSelected) onSelect();
        }}
        sx={{
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: isSelected ? "primary.main" : "transparent",
          cursor: isSelected ? "default" : "pointer",
          transition: "border-color 0.15s",
          "&:hover": !isSelected ? { borderColor: "grey.300" } : {},
        }}
      >
        {/* Block toolbar — visible when selected */}
        {isSelected && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
              px: 1,
              py: 0.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "grey.50",
              borderRadius: "6px 6px 0 0",
            }}
            // Stop click from bubbling to the deselect handler on the canvas
            onClick={(e) => e.stopPropagation()}
          >
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.65rem",
                color: "text.secondary",
                letterSpacing: "0.1em",
              }}
            >
              {BLOCK_LABELS[block.type]}
            </Typography>
            <LayoutControls
              layout={layoutOf(block)}
              onChange={onLayoutChange}
            />
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  onClick={onMoveUp}
                  disabled={isFirst}
                  sx={{ p: 0.25 }}
                >
                  <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  onClick={onMoveDown}
                  disabled={isLast}
                  sx={{ p: 0.25 }}
                >
                  <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete block">
              <IconButton
                size="small"
                color="error"
                onClick={onRemove}
                sx={{ p: 0.25 }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Block content area */}
        <Box sx={{ p: 1.5 }}>
          {isSelected ? (
            <>
              {renderEditor()}
              <LivePreview block={block} />
            </>
          ) : (
            <BlockPreview block={block} />
          )}
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
  const [dragState, setDragState] = useState<DragState>({ kind: "none" });
  const [pendingRowDelete, setPendingRowDelete] = useState<{
    index: number;
    childCount: number;
  } | null>(null);

  const isDraggingFromPalette = dragState.kind === "palette";

  function updateBlock(index: number, data: Block["data"]) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], data } as Block;
    onChange(updated);
  }

  function updateBlockLayout(index: number, layout: BlockLayout) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], layout } as Block;
    onChange(updated);
  }

  function updateBlockTextAlign(index: number, textAlign: BlockAlign) {
    const updated = [...blocks];
    updated[index] = { ...updated[index], textAlign } as Block;
    onChange(updated);
  }

  function removeBlock(index: number) {
    const removed = blocks[index];
    if (removed && selectedId === removed.id) setSelectedId(null);
    onChange(blocks.filter((_, i) => i !== index));
  }

  function requestRemoveBlock(index: number) {
    const target = blocks[index];
    if (target?.type === "row" && target.data.children.length > 0) {
      setPendingRowDelete({ index, childCount: target.data.children.length });
      return;
    }
    removeBlock(index);
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

  function addChildToRow(
    rowId: string,
    type: ContentBlockType,
    colStart: number,
  ) {
    if (!isRowChildType(type)) return;
    const newBlock = createBlock(type) as RowChildBlock;
    const placed: PlacedBlock = { block: newBlock, colStart, colSpan: 1 };
    onChange(
      blocks.map((b) => {
        if (b.id !== rowId || b.type !== "row") return b;
        const occupied = b.data.children.some(
          (c) => colStart >= c.colStart && colStart < c.colStart + c.colSpan,
        );
        if (occupied) return b;
        const children = [...b.data.children, placed].sort(
          (a, b) => a.colStart - b.colStart,
        );
        return { ...b, data: { ...b.data, children } };
      }),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const { source } = event.operation;
    const d = source?.data as
      | { kind: string; blockType?: ContentBlockType }
      | undefined;
    if (d?.kind === "palette" && d.blockType) {
      setDragState({ kind: "palette", blockType: d.blockType });
      setSelectedId(null);
    } else {
      setDragState({ kind: "block", blockId: source?.id as string });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const state = dragState;
    setDragState({ kind: "none" });
    const { operation } = event;
    const { source, target } = operation;

    if (!target) return;

    if (state.kind === "palette") {
      const cellData = target.data as
        | { isCell?: boolean; rowId?: string; colStart?: number }
        | undefined;
      if (
        cellData?.isCell &&
        cellData.rowId &&
        cellData.colStart !== undefined
      ) {
        addChildToRow(cellData.rowId, state.blockType, cellData.colStart);
      } else if (
        isSortable(target) &&
        target.isDropTarget &&
        target.index !== undefined
      ) {
        insertBlock(state.blockType, target.index);
      } else {
        // Dropped on an existing block — insert after it
        const idx = blocks.findIndex((b) => b.id === target?.id);
        if (idx >= 0) insertBlock(state.blockType, idx + 1);
      }
    } else if (state.kind === "block") {
      if (
        isSortable(source) &&
        isSortable(target) &&
        target.index != source.index
      ) {
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
    dragState.kind === "block"
      ? blocks.find((b) => b.id === dragState.blockId)
      : null;
  const overlayLabel =
    dragState.kind === "palette"
      ? BLOCK_LABELS[dragState.blockType]
      : overlayBlock
        ? BLOCK_LABELS[overlayBlock.type]
        : null;

  return (
    <DragDropProvider
      sensors={[PointerSensor, KeyboardSensor]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}
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
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                color: "text.disabled",
              }}
            >
              <Typography sx={{ fontSize: "0.875rem" }}>
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
                onRemove={() => requestRemoveBlock(index)}
                onMoveUp={() => moveBlock(index, -1)}
                onMoveDown={() => moveBlock(index, 1)}
                onChange={(data) => updateBlock(index, data)}
                onLayoutChange={(layout) => updateBlockLayout(index, layout)}
                onTextAlignChange={(align) =>
                  updateBlockTextAlign(index, align)
                }
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
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderRadius: 1.5,
              borderColor: "primary.main",
              boxShadow: 8,
              bgcolor: "background.paper",
              cursor: "grabbing",
              minWidth: 140,
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {overlayLabel}
            </Typography>
          </Paper>
        )}
      </DragOverlay>

      <Dialog
        open={!!pendingRowDelete}
        onClose={() => setPendingRowDelete(null)}
      >
        <DialogTitle>Delete row?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This row contains {pendingRowDelete?.childCount} block
            {pendingRowDelete?.childCount === 1 ? "" : "s"}. Deleting the row
            will remove them all.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRowDelete(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingRowDelete) removeBlock(pendingRowDelete.index);
              setPendingRowDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DragDropProvider>
  );
}
