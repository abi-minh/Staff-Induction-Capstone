import type { ReactNode } from 'react';
import { IconButton, Tooltip } from '@mui/material';

interface Props {
  title:    string;
  onClick:  () => void;
  disabled?: boolean;
  color?:   'inherit' | 'primary' | 'error';
  children: ReactNode;
}

// MUI Tooltip can't anchor to a disabled button directly. The span wrapper
// makes the tooltip survive the disabled state.
export default function ToolbarButton({ title, onClick, disabled, color, children }: Props) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" onClick={onClick} disabled={disabled} color={color} sx={{ p: 0.25 }}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
