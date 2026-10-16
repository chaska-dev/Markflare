// Pure helpers over the flat block list (parent_id + float positions) shared by
// the duplicate and move shortcuts.

import { Block } from '../types';

// Direct children of `parentId` (null = root level), ordered by position.
export function sortedChildren(blocks: Block[], parentId: string | null): Block[] {
  return blocks
    .filter(b => (b.parent_id ?? null) === parentId)
    .sort((a, b) => a.position - b.position);
}

// A block and all its descendants in document order, with their depth below
// the root of the walk (root = 0). `skip` prunes a block together with its subtree.
export function collectSubtree(
  blocks: Block[],
  rootId: string,
  skip?: (b: Block) => boolean
): { block: Block; depth: number }[] {
  const root = blocks.find(b => b.id === rootId);
  if (!root) return [];
  const out: { block: Block; depth: number }[] = [];
  const walk = (b: Block, depth: number) => {
    if (skip?.(b)) return;
    out.push({ block: b, depth });
    for (const child of sortedChildren(blocks, b.id)) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

// A position strictly between two neighbours; either may be missing at the
// edges of a level. Positions are stored as floats, so no rounding here.
export function positionBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next! - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}
