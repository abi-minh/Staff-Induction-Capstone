import { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Menu, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  MAX_ROW_COLUMNS,
  MIN_ROW_COLUMNS,
  ROW_COLUMN_PRESETS,
} from '../../../types';
import type { PlacedBlock, RowBlock, RowChildBlock } from '../../../types';
import { BLOCK_LABELS, clampRowColumns, createBlock } from '../../utils';
import EmptyCell from '../../EmptyCell';
import ChildCell from './ChildCell';
import { RowContext, type RowContextValue } from './rowContext';
import { tryGrow, tryMoveLeft, tryMoveRight, tryShrink, withChildren } from './rowMutations';

const CHILD_TYPES: RowChildBlock['type'][] = ['heading', 'text', 'image', 'video', 'list', 'callout'];

interface Props {
  block: RowBlock;
  onChange: (data: RowBlock['data']) => void;
}

export default function RowBlockEditor({ block, onChange }: Props) {
  const { columns, children } = block.data;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ anchorEl: HTMLElement; colStart: number } | null>(null);
  const [pendingShrink, setPendingShrink] = useState<{ newData: RowBlock['data']; dropped: PlacedBlock[] } | null>(null);

  function setColumns(next: number) {
    const clamped = Math.max(MIN_ROW_COLUMNS, Math.min(MAX_ROW_COLUMNS, next));
    if (clamped === columns) return;
    const result = clampRowColumns(block.data, clamped);
    if (result.droppedChildren.length > 0 || result.clampedAny) {
      setPendingShrink({ newData: result.row, dropped: result.droppedChildren });
    } else {
      onChange(result.row);
    }
  }

  function addChildAt(type: RowChildBlock['type'], colStart: number) {
    const newBlock = createBlock(type) as RowChildBlock;
    const placed: PlacedBlock = { block: newBlock, colStart, colSpan: 1 };
    const next = [...children, placed].sort((a, b) => a.colStart - b.colStart);
    onChange(withChildren(block.data, next));
    setSelectedChildId(newBlock.id);
  }

  function updateChildData(childId: string, data: RowChildBlock['data']) {
    const next = children.map((c) =>
      c.block.id === childId
        ? { ...c, block: { ...c.block, data } as RowChildBlock }
        : c,
    );
    onChange(withChildren(block.data, next));
  }

  function removeChild(childId: string) {
    onChange(withChildren(block.data, children.filter((c) => c.block.id !== childId)));
    if (selectedChildId === childId) setSelectedChildId(null);
  }

  function applyMutation(result: PlacedBlock[] | null) {
    if (result) onChange(withChildren(block.data, result));
  }

  const ctx: RowContextValue = useMemo(() => ({
    rowId:             block.id,
    selectedChildId,
    onSelectChild:     setSelectedChildId,
    onUpdateChildData: updateChildData,
    onRemoveChild:     removeChild,
    onGrowChild:       (id) => applyMutation(tryGrow(children, columns, id)),
    onShrinkChild:     (id) => applyMutation(tryShrink(children, id)),
    onMoveChildLeft:   (id) => applyMutation(tryMoveLeft(children, id)),
    onMoveChildRight:  (id) => applyMutation(tryMoveRight(children, columns, id)),
    canGrow:           (c) => tryGrow(children, columns, c.block.id) !== null,
    canMoveLeft:       (c) => tryMoveLeft(children, c.block.id) !== null,
    canMoveRight:      (c) => tryMoveRight(children, columns, c.block.id) !== null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [block.id, selectedChildId, children, columns]);

  return (
    <RowContext.Provider value={ctx}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }} onClick={(e) => e.stopPropagation()}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Columns
          </Typography>
          <ToggleButtonGroup
            value={ROW_COLUMN_PRESETS.find((p) => p.columns === columns)?.columns ?? null}
            exclusive
            size="small"
            onChange={(_, next) => { if (next != null) setColumns(next as number); }}
          >
            {ROW_COLUMN_PRESETS.map((p) => (
              <ToggleButton key={p.columns} value={p.columns} sx={{ textTransform: 'none' }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            type="number"
            size="small"
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            slotProps={{ htmlInput: { min: MIN_ROW_COLUMNS, max: MAX_ROW_COLUMNS } }}
            sx={{ width: 80 }}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 1.5,
          }}
        >
          {renderCells(block.id, children, columns, (anchor, colStart) => setPicker({ anchorEl: anchor, colStart }))}
        </Box>

        <Menu
          open={!!picker}
          anchorEl={picker?.anchorEl ?? null}
          onClose={() => setPicker(null)}
        >
          {CHILD_TYPES.map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                if (picker) {
                  addChildAt(type, picker.colStart);
                  setPicker(null);
                }
              }}
            >
              {BLOCK_LABELS[type]}
            </MenuItem>
          ))}
        </Menu>

        {pendingShrink && (
          <Dialog open onClose={() => setPendingShrink(null)}>
            <DialogTitle>Reduce columns?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {pendingShrink.dropped.length > 0 ? (
                  <>
                    Reducing to {pendingShrink.newData.columns} columns will drop{' '}
                    {pendingShrink.dropped.length} block{pendingShrink.dropped.length === 1 ? '' : 's'}{' '}
                    that no longer fit ({pendingShrink.dropped.map((d) => BLOCK_LABELS[d.block.type]).join(', ')}).
                  </>
                ) : (
                  <>Reducing to {pendingShrink.newData.columns} columns will clamp some blocks to fit the new width.</>
                )}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingShrink(null)}>Cancel</Button>
              <Button
                color="error"
                onClick={() => {
                  onChange(pendingShrink.newData);
                  setPendingShrink(null);
                }}
              >
                Continue
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </RowContext.Provider>
  );
}

function renderCells(
  rowId:        string,
  children:     PlacedBlock[],
  columns:      number,
  onClickEmpty: (anchor: HTMLElement, colStart: number) => void,
) {
  const slots: JSX.Element[] = [];
  let cursor = 1;

  function pushEmpty(start: number, span: number) {
    slots.push(
      <EmptyCell
        key={`gap-${start}`}
        rowId={rowId}
        colStart={start}
        colSpan={span}
        onClick={(anchor) => onClickEmpty(anchor, start)}
      />,
    );
  }

  for (const child of children) {
    if (child.colStart > cursor) pushEmpty(cursor, child.colStart - cursor);
    slots.push(<ChildCell key={child.block.id} placed={child} />);
    cursor = child.colStart + child.colSpan;
  }
  if (cursor <= columns) pushEmpty(cursor, columns - cursor + 1);

  return slots;
}
