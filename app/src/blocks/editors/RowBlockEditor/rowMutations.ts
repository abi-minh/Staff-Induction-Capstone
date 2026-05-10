import type { PlacedBlock, RowBlock } from '../../../types';

// Pure functions that return the next children array, or null if the
// mutation is invalid. canX checks reuse the same tryX so the two can't
// disagree.

type Children = PlacedBlock[];

function findIndex(children: Children, childId: string): number {
  return children.findIndex((c) => c.block.id === childId);
}

// Grow a child's colSpan by 1. If the next slot is occupied, push the next
// child right by 1 (single-step push, no cascading).
export function tryGrow(
  children: Children,
  columns: number,
  childId: string,
): Children | null {
  const idx = findIndex(children, childId);
  if (idx < 0) return null;
  const child = children[idx];
  const childEnd = child.colStart + child.colSpan - 1;
  if (childEnd >= columns) return null;

  const next = children[idx + 1];
  if (!next || next.colStart > childEnd + 1) {
    const updated = [...children];
    updated[idx] = { ...child, colSpan: child.colSpan + 1 };
    return updated;
  }

  const nextEnd = next.colStart + next.colSpan - 1;
  const nextNext = children[idx + 2];
  const maxNextEnd = nextNext ? nextNext.colStart - 1 : columns;
  if (nextEnd + 1 > maxNextEnd) return null;

  const updated = [...children];
  updated[idx] = { ...child, colSpan: child.colSpan + 1 };
  updated[idx + 1] = { ...next, colStart: next.colStart + 1 };
  return updated;
}

export function tryShrink(children: Children, childId: string): Children | null {
  const idx = findIndex(children, childId);
  if (idx < 0) return null;
  const child = children[idx];
  if (child.colSpan <= 1) return null;
  const updated = [...children];
  updated[idx] = { ...child, colSpan: child.colSpan - 1 };
  return updated;
}

export function tryMoveLeft(children: Children, childId: string): Children | null {
  const idx = findIndex(children, childId);
  if (idx < 0) return null;
  const child = children[idx];
  if (child.colStart <= 1) return null;
  const prev = children[idx - 1];
  const minStart = prev ? prev.colStart + prev.colSpan : 1;
  if (child.colStart - 1 < minStart) return null;
  const updated = [...children];
  updated[idx] = { ...child, colStart: child.colStart - 1 };
  return updated;
}

export function tryMoveRight(
  children: Children,
  columns: number,
  childId: string,
): Children | null {
  const idx = findIndex(children, childId);
  if (idx < 0) return null;
  const child = children[idx];
  const childEnd = child.colStart + child.colSpan - 1;
  if (childEnd >= columns) return null;
  const next = children[idx + 1];
  const maxStart = next ? next.colStart - child.colSpan : columns - child.colSpan + 1;
  if (child.colStart + 1 > maxStart) return null;
  const updated = [...children];
  updated[idx] = { ...child, colStart: child.colStart + 1 };
  return updated;
}

export function withChildren(data: RowBlock['data'], children: Children): RowBlock['data'] {
  return { ...data, children };
}
