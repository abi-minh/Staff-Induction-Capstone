import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useDroppable } from '@dnd-kit/react';

interface Props {
  rowId:    string;
  colStart: number;
  colSpan:  number;
  onClick?: (anchor: HTMLElement) => void;
}

export default function EmptyCell({ rowId, colStart, colSpan, onClick }: Props) {
  const { ref, isDropTarget } = useDroppable({
    id: `cell-${rowId}-${colStart}`,
    data: { isCell: true, rowId, colStart },
  });

  return (
    <Box
      ref={ref}
      onClick={(e) => onClick?.(e.currentTarget)}
      sx={{
        gridColumn: `${colStart} / span ${colSpan}`,
        minHeight: 80,
        border: '1.5px dashed',
        borderColor: isDropTarget ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        color: isDropTarget ? 'primary.main' : 'text.disabled',
        bgcolor: isDropTarget ? 'action.hover' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
        '&:hover': onClick
          ? { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' }
          : {},
      }}
    >
      <AddIcon sx={{ fontSize: 16 }} />
      <Typography variant="caption" sx={{ fontSize: '0.72rem' }}>Empty</Typography>
    </Box>
  );
}
