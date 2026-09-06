import { Box, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import { BLOCK_LABELS, layoutOf } from '../../utils';
import type { PlacedBlock } from '../../../types';
import ToolbarButton from '../../ToolbarButton';
import LayoutControls from '../../LayoutControls';
import ChildPreview from './ChildPreview';
import { renderChildEditor } from './renderChildEditor';
import { useRowContext } from './rowContext';

interface Props {
  placed: PlacedBlock;
}

export default function ChildCell({ placed }: Props) {
  const ctx = useRowContext();
  const isSelected = ctx.selectedChildId === placed.block.id;
  const child = placed.block;

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        if (!isSelected) ctx.onSelectChild(child.id);
      }}
      sx={{
        gridColumn: `${placed.colStart} / span ${placed.colSpan}`,
        minHeight: 80,
        border: '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        cursor: isSelected ? 'default' : 'pointer',
        '&:hover': !isSelected ? { borderColor: 'grey.400' } : {},
      }}
    >
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
            bgcolor: 'background.default',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography variant="overline" sx={{ fontSize: '0.65rem', color: 'text.secondary', flex: 1 }}>
            {BLOCK_LABELS[child.type]}
          </Typography>
          <ToolbarButton title="Move left"  onClick={() => ctx.onMoveChildLeft(child.id)}  disabled={!ctx.canMoveLeft(placed)}>
            <KeyboardDoubleArrowLeftIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
          <ToolbarButton title="Move right" onClick={() => ctx.onMoveChildRight(child.id)} disabled={!ctx.canMoveRight(placed)}>
            <KeyboardDoubleArrowRightIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
          <ToolbarButton title="Shrink" onClick={() => ctx.onShrinkChild(child.id)} disabled={placed.colSpan <= 1}>
            <KeyboardArrowLeftIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
          <ToolbarButton title="Grow" onClick={() => ctx.onGrowChild(child.id)} disabled={!ctx.canGrow(placed)}>
            <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
          <ToolbarButton title="Delete" onClick={() => ctx.onRemoveChild(child.id)} color="error">
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </ToolbarButton>
        </Box>
      )}
      {isSelected && (
        <Box
          sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}
          onClick={(e) => e.stopPropagation()}
        >
          <LayoutControls layout={layoutOf(child)} onChange={(layout) => ctx.onUpdateChildLayout(child.id, layout)} />
        </Box>
      )}
      <Box sx={{ p: 1.25 }}>
        {isSelected
          ? renderChildEditor(
              child,
              (data) => ctx.onUpdateChildData(child.id, data),
              (layout) => ctx.onUpdateChildLayout(child.id, layout),
              (align) => ctx.onUpdateChildTextAlign(child.id, align),
            )
          : <ChildPreview block={child} />
        }
      </Box>
    </Box>
  );
}
