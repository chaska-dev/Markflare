// Pure helpers for the multi-block selection: ranges over the visible order,
// "selected roots" (a selected parent implies its subtree), the rubber band and
// the position plans for indent, outdent and dropping several blocks at once.

import { Block } from '../types';
import { sortedChildren } from './blockTree';

// Inclusive range between two ids in the given (visible) order, in that order.
// Ids that are not in the order give an empty range.
export function rangeBetween(order: string[], a: string, b: string): string[] {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i === -1 || j === -1) return [];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}

// The neighbour of `from` in the order; stays put at the edges.
export function stepId(order: string[], from: string, dir: -1 | 1): string {
  const i = order.indexOf(from);
  if (i === -1) return from;
  return order[Math.min(order.length - 1, Math.max(0, i + dir))];
}

// All blocks in tree order (collapsed or not), as ids.
export function documentOrder(blocks: Block[]): string[] {
  const children = new Map<string | null, Block[]>();
  const ids = new Set(blocks.map(b => b.id));
  for (const b of blocks) {
    // A block whose parent is missing is shown at the root, like the editor does.
    const key = b.parent_id && ids.has(b.parent_id) ? b.parent_id : null;
    const list = children.get(key);
    if (list) list.push(b);
    else children.set(key, [b]);
  }
  for (const list of children.values()) list.sort((x, y) => x.position - y.position);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null) => {
    for (const b of children.get(parent) ?? []) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      out.push(b.id);
      walk(b.id);
    }
  };
  walk(null);
  return out;
}

// Selected blocks that are not inside another selected block, in tree order.
// Those are the ones operations act on; their subtrees come along.
export function selectionRoots(blocks: Block[], ids: Iterable<string>): string[] {
  const selected = new Set(ids);
  const byId = new Map(blocks.map(b => [b.id, b]));
  const hasSelectedAncestor = (id: string): boolean => {
    let cur = byId.get(id);
    for (let guard = 0; cur && cur.parent_id && guard < 64; guard++) {
      if (selected.has(cur.parent_id)) return true;
      cur = byId.get(cur.parent_id);
    }
    return false;
  };
  return documentOrder(blocks).filter(id => selected.has(id) && !hasSelectedAncestor(id));
}

// The given blocks plus all their descendants, in tree order.
export function withSubtrees(blocks: Block[], ids: Iterable<string>): string[] {
  const roots = new Set(selectionRoots(blocks, ids));
  const byId = new Map(blocks.map(b => [b.id, b]));
  const inside = (id: string): boolean => {
    let cur = byId.get(id);
    for (let guard = 0; cur && guard < 64; guard++) {
      if (roots.has(cur.id)) return true;
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  };
  return documentOrder(blocks).filter(inside);
}

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Ids whose box overlaps the rectangle (touching edges do not count).
export function idsInRect(items: (Box & { id: string })[], rect: Box): string[] {
  return items
    .filter(i => i.left < rect.right && i.right > rect.left && i.top < rect.bottom && i.bottom > rect.top)
    .map(i => i.id);
}

// `count` positions strictly between prev and next, evenly spread. Either end
// may be missing (edge of a level), then they step 1000 away from the other.
export function evenPositions(count: number, prev?: number, next?: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (prev !== undefined && next !== undefined) out.push(prev + ((next - prev) * (i + 1)) / (count + 1));
    else if (prev !== undefined) out.push(prev + 1000 * (i + 1));
    else if (next !== undefined) out.push(next - 1000 * (count - i));
    else out.push(1000 * (i + 1));
  }
  return out;
}

export interface Move {
  id: string;
  parent_id: string | null;
  position: number;
}

// Tab on a selection: every root goes under its nearest previous sibling that
// is not part of the selection itself (a run of selected siblings moves under
// the unselected one before the run). Roots with no such sibling stay. Moved
// blocks are appended as last children, in order.
export function planIndent(blocks: Block[], rootIds: string[]): Move[] {
  const rootSet = new Set(rootIds);
  const lastChild = new Map<string, number | undefined>();
  const moves: Move[] = [];
  for (const id of rootIds) {
    const block = blocks.find(b => b.id === id);
    if (!block) continue;
    const siblings = sortedChildren(blocks, block.parent_id ?? null);
    let j = siblings.findIndex(b => b.id === id) - 1;
    while (j >= 0 && rootSet.has(siblings[j].id)) j--;
    if (j < 0) continue;
    const target = siblings[j];
    if (!lastChild.has(target.id)) {
      const kids = sortedChildren(blocks, target.id).filter(b => !rootSet.has(b.id));
      lastChild.set(target.id, kids.length > 0 ? kids[kids.length - 1].position : undefined);
    }
    const position = evenPositions(1, lastChild.get(target.id), undefined)[0];
    lastChild.set(target.id, position);
    moves.push({ id, parent_id: target.id, position });
  }
  return moves;
}

// Shift+Tab on a selection: every root becomes a sibling of its parent, right
// after it. Roots that share a parent keep their order, spread in the gap.
export function planOutdent(blocks: Block[], rootIds: string[]): Move[] {
  const byParent = new Map<string, string[]>();
  for (const id of rootIds) {
    const block = blocks.find(b => b.id === id);
    if (!block || !block.parent_id) continue;
    const list = byParent.get(block.parent_id);
    if (list) list.push(id);
    else byParent.set(block.parent_id, [id]);
  }
  const moves: Move[] = [];
  for (const [parentId, ids] of byParent) {
    const parent = blocks.find(b => b.id === parentId);
    if (!parent) continue;
    const grand = parent.parent_id ?? null;
    const siblings = sortedChildren(blocks, grand);
    const next = siblings[siblings.findIndex(b => b.id === parentId) + 1];
    const positions = evenPositions(ids.length, parent.position, next?.position);
    ids.forEach((id, i) => moves.push({ id, parent_id: grand, position: positions[i] }));
  }
  return moves;
}

export interface MultiDropPlan {
  newParentId: string | null;
  moves: Move[];
}

// Dropping several roots at once: same zones as a single block (top/bottom =
// sibling of the target, middle = last children of it). The roots keep their
// relative order. Null when the target is inside what is being moved.
export function planMultiDrop(
  blocks: Block[],
  rootIds: string[],
  targetId: string,
  zone: 'top' | 'middle' | 'bottom'
): MultiDropPlan | null {
  const target = blocks.find(b => b.id === targetId);
  if (!target || rootIds.length === 0) return null;
  if (withSubtrees(blocks, rootIds).includes(targetId)) return null;
  const rootSet = new Set(rootIds);
  const newParentId = zone === 'middle' ? targetId : target.parent_id ?? null;
  const siblings = sortedChildren(blocks, newParentId).filter(b => !rootSet.has(b.id));
  let prev: number | undefined;
  let next: number | undefined;
  if (zone === 'middle') {
    prev = siblings.length > 0 ? siblings[siblings.length - 1].position : undefined;
  } else {
    const idx = siblings.findIndex(b => b.id === targetId);
    if (zone === 'top') {
      prev = idx > 0 ? siblings[idx - 1].position : undefined;
      next = target.position;
    } else {
      prev = target.position;
      next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1].position : undefined;
    }
  }
  const positions = evenPositions(rootIds.length, prev, next);
  return { newParentId, moves: rootIds.map((id, i) => ({ id, parent_id: newParentId, position: positions[i] })) };
}
