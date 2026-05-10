import { createContext, useContext } from 'react';
import type { PlacedBlock, RowChildBlock } from '../../../types';

export interface RowContextValue {
  rowId:             string;
  selectedChildId:   string | null;
  onSelectChild:     (id: string | null) => void;
  onUpdateChildData: (id: string, data: RowChildBlock['data']) => void;
  onRemoveChild:     (id: string) => void;
  onGrowChild:       (id: string) => void;
  onShrinkChild:     (id: string) => void;
  onMoveChildLeft:   (id: string) => void;
  onMoveChildRight:  (id: string) => void;
  canGrow:           (child: PlacedBlock) => boolean;
  canMoveLeft:       (child: PlacedBlock) => boolean;
  canMoveRight:      (child: PlacedBlock) => boolean;
}

export const RowContext = createContext<RowContextValue | null>(null);

export function useRowContext(): RowContextValue {
  const ctx = useContext(RowContext);
  if (!ctx) throw new Error('useRowContext must be used inside a RowContext.Provider');
  return ctx;
}
