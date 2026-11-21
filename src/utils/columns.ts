// Pure helpers for side-by-side columns (`column_list` > `column` > blocks, see
// the note on BlockType): the render tree, widths, keyboard neighbours, the
// drop zones and the plans that create or dissolve columns. Everything works on
// the flat block list and returns history Changes, so each operation can be
// recorded as one undo entry.

import { Block } from '../types';
import { BlockPatch, Change, makeUpdate } from './blockHistory';
import { sortedChildren, positionBetween } from './blockTree';
import { evenPositions, selectionRoots, withSubtrees } from './blockSelection';

// A column never gets narrower than this share of the row when resized.
export const MIN_COLUMN_FRACTION = 0.1;
// Outer part of a block's width that, while dragging, means "beside it".
export const SIDE_ZONE = 0.15;
const MIN_SIDE_PX = 32;

export function isContainerType(type: string): boolean {
  return type === 'column_list' || type === 'column';
}

// ---- Render tree ----

export interface RenderItem {
  block: Block;
  // Indentation level; restarts at 0 inside every column.
  depth: number;
  hasChildren: boolean;
  // Set on a column_list only: its columns with the items shown in each.
  columns?: RenderColumn[];
}

export interface RenderColumn {
  block: Block;
  items: RenderItem[];
}

export interface RenderOptions {
  // Hide the children of collapsed blocks (the editor does, the shared view doesn't).
  respectCollapsed: boolean;
  // Show blocks whose parent is missing at the root instead of dropping them.
  includeOrphans: boolean;
}

// The blocks as the page shows them: a flat run of items (children follow their
// parent with a larger depth), except that a column_list is ONE item holding its
// columns, each with its own run. Columns are not nested: a column_list found
// inside a column is shown in place, as if its blocks were part of that column,
// and stray columns / non-column children of a column_list are shown as plain
// blocks, so no data ever disappears from the page.
export function buildRenderItems(blocks: Block[], opts: RenderOptions): RenderItem[] {
  const ids = new Set(blocks.map(b => b.id));
  const childrenOf = new Map<string | null, Block[]>();
  for (const b of blocks) {
    const parent = b.parent_id ?? null;
    const key = opts.includeOrphans && parent !== null && !ids.has(parent) ? null : parent;
    const list = childrenOf.get(key);
    if (list) list.push(b);
    else childrenOf.set(key, [b]);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.position - b.position);
  const children = (id: string | null) => childrenOf.get(id) ?? [];

  const build = (parentId: string | null, inColumn: boolean): RenderItem[] => {
    const out: RenderItem[] = [];
    const emit = (b: Block, depth: number) => {
      if (b.type === 'column') {
        for (const child of children(b.id)) emit(child, depth);
        return;
      }
      if (b.type === 'column_list') {
        const kids = children(b.id);
        const columns = kids.filter(k => k.type === 'column');
        if (inColumn) {
          for (const column of columns) for (const child of children(column.id)) emit(child, depth);
        } else {
          out.push({
            block: b,
            depth,
            hasChildren: false,
            columns: columns.map(column => ({ block: column, items: build(column.id, true) })),
          });
        }
        for (const stray of kids.filter(k => k.type !== 'column')) emit(stray, depth);
        return;
      }
      const kids = children(b.id);
      out.push({ block: b, depth, hasChildren: kids.length > 0 });
      if (kids.length > 0 && !(opts.respectCollapsed && b.collapsed)) {
        for (const child of kids) emit(child, depth + 1);
      }
    };
    for (const b of children(parentId)) emit(b, 0);
    return out;
  };
  return build(null, false);
}

// Ids of the blocks that are on screen, in reading order (column after column).
// The containers themselves are layout, not content, so they are left out.
export function visibleOrder(items: RenderItem[]): string[] {
  const out: string[] = [];
  const walk = (list: RenderItem[]) => {
    for (const item of list) {
      if (item.columns) for (const column of item.columns) walk(column.items);
      else out.push(item.block.id);
    }
  };
  walk(items);
  return out;
}

// ---- Column lookups ----

// The `column` that holds a block (at any depth), or null.
export function columnOf(blocks: Block[], id: string): Block | null {
  return columnLookup(blocks)(id);
}

// Same, for many lookups over one list.
export function columnLookup(blocks: Block[]): (id: string) => Block | null {
  const byId = new Map(blocks.map(b => [b.id, b]));
  return (id: string) => {
    let cur = byId.get(id);
    for (let guard = 0; cur && cur.parent_id && guard < 64; guard++) {
      const parent = byId.get(cur.parent_id);
      if (!parent) return null;
      if (parent.type === 'column') return parent;
      cur = parent;
    }
    return null;
  };
}

// The block above (-1) or below (1) `id` for the arrow keys. Inside a column it
// walks the column; from its first / last block it leaves the whole column list
// (to the block before / after it) instead of entering the next column.
export function verticalNeighbour(blocks: Block[], order: string[], id: string, dir: -1 | 1): string | null {
  const at = order.indexOf(id);
  if (at === -1) return null;
  const columnIn = columnLookup(blocks);
  const own = columnIn(id);
  const listId = own?.parent_id ?? null;
  let i = at + dir;
  if (own && listId) {
    while (i >= 0 && i < order.length) {
      const other = columnIn(order[i]);
      if (other && other.id !== own.id && other.parent_id === listId) i += dir;
      else break;
    }
  }
  return order[i] ?? null;
}

// ---- Widths ----

// Share of the row each column takes, summing to 1. props.width is a fraction;
// columns without one share what is left (all equal when none has a width).
export function columnFractions(columns: Block[]): number[] {
  if (columns.length === 0) return [];
  const raw = columns.map(c => (typeof c.props?.width === 'number' && c.props.width > 0 ? c.props.width : null));
  const known = raw.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const unknown = raw.filter(w => w === null).length;
  if (unknown === columns.length) return columns.map(() => 1 / columns.length);
  const fill = unknown > 0 ? Math.max((1 - known) / unknown, MIN_COLUMN_FRACTION) : 0;
  const filled = raw.map(w => w ?? fill);
  const total = filled.reduce((sum, w) => sum + w, 0);
  return filled.map(w => w / total);
}

// Two neighbouring columns after their divider moved by `delta` (a fraction of
// the row): together they keep the same share, neither goes under the minimum.
export function resizePair(left: number, right: number, delta: number): [number, number] {
  const total = left + right;
  const lo = Math.min(MIN_COLUMN_FRACTION, total / 2);
  const next = Math.min(Math.max(left + delta, lo), total - lo);
  return [next, total - next];
}

// ---- Drop zones ----

export type DropZone = 'top' | 'middle' | 'bottom' | 'left' | 'right';

// Where on a block the pointer is. With `sides`, the outer SIDE_ZONE of its
// width on either side means "next to it" (new column); otherwise, or in the
// rest of the width, the usual vertical zones: first 25% top, last 25% bottom.
export function dropZone(
  rect: { left: number; width: number; top: number; height: number },
  x: number,
  y: number,
  sides: boolean
): DropZone {
  if (sides && rect.width > 0) {
    const edge = Math.max(rect.width * SIDE_ZONE, MIN_SIDE_PX);
    if (x - rect.left < edge) return 'left';
    if (rect.left + rect.width - x < edge) return 'right';
  }
  const ratio = rect.height > 0 ? (y - rect.top) / rect.height : 1;
  if (ratio < 0.25) return 'top';
  if (ratio > 0.75) return 'bottom';
  return 'middle';
}

// Blocks that can take a new column beside them: top-level ones, and the ones
// directly inside a column.
export function canDropBeside(blocks: Block[], targetId: string): boolean {
  const target = blocks.find(b => b.id === targetId);
  if (!target || isContainerType(target.type)) return false;
  if (!target.parent_id) return true;
  return blocks.find(b => b.id === target.parent_id)?.type === 'column';
}

// ---- Applying and normalizing ----

// The list as it will be once the changes are applied (the local half of what
// useBlockHistory does), sorted like the editor's state.
export function applyToList(list: Block[], changes: Change[]): Block[] {
  const removed = new Set<string>();
  const patches = new Map<string, BlockPatch>();
  const added: Block[] = [];
  for (const change of changes) {
    if (change.op === 'create') added.push(change.block);
    else if (change.op === 'delete') removed.add(change.block.id);
    else patches.set(change.id, { ...patches.get(change.id), ...change.after });
  }
  return [...list, ...added]
    .filter(b => !removed.has(b.id))
    .map(b => (patches.has(b.id) ? { ...b, ...patches.get(b.id) } : b))
    .sort((a, b) => a.position - b.position);
}

// What keeps the column structure valid after `changes`: a column left without
// blocks goes away, and a column_list left with fewer than two columns (or one
// that ended up inside a column) dissolves, its blocks taking its place. Returned
// as extra changes, to run in the same history entry.
export function columnCleanup(blocks: Block[], changes: Change[]): Change[] {
  if (!blocks.some(b => b.type === 'column_list') && !changes.some(c => c.op === 'create' && c.block.type === 'column_list')) {
    return [];
  }
  return normalizeColumns(applyToList(blocks, changes));
}

export function normalizeColumns(list: Block[]): Change[] {
  const out: Change[] = [];
  const byId = new Map(list.map(b => [b.id, b]));
  for (const columnList of list.filter(b => b.type === 'column_list')) {
    const kids = sortedChildren(list, columnList.id);
    const columns = kids.filter(k => k.type === 'column');
    const filled = columns.filter(c => sortedChildren(list, c.id).length > 0);
    const insideColumn = byId.get(columnList.parent_id ?? '')?.type === 'column';
    if (filled.length >= 2 && !insideColumn) {
      for (const column of columns) if (!filled.includes(column)) out.push({ op: 'delete', block: column });
      continue;
    }
    // Dissolve: the blocks of the remaining column(s) go right after the list.
    const moved = [
      ...filled.flatMap(c => sortedChildren(list, c.id)),
      ...kids.filter(k => k.type !== 'column'),
    ];
    const parentId = columnList.parent_id ?? null;
    const siblings = sortedChildren(list, parentId);
    const next = siblings[siblings.findIndex(b => b.id === columnList.id) + 1];
    const positions = evenPositions(moved.length, columnList.position, next?.position);
    moved.forEach((b, i) => {
      const update = makeUpdate(b, { parent_id: parentId, position: positions[i] });
      if (update) out.push(update);
    });
    for (const column of columns) out.push({ op: 'delete', block: column });
    out.push({ op: 'delete', block: columnList });
  }
  return out;
}

// ---- Plans ----

interface PlanContext {
  pageId: string;
  // New blocks get temp ids until the server answers; tests inject their own.
  makeId?: () => string;
}

const tempId = () => `temp-${crypto.randomUUID()}`;

function newBlock(ctx: PlanContext, type: Block['type'], parentId: string | null, position: number, props: Block['props'] = {}): Block {
  const now = new Date().toISOString();
  return {
    id: (ctx.makeId ?? tempId)(),
    page_id: ctx.pageId,
    type,
    content: '',
    checked: false,
    language: '',
    position,
    parent_id: parentId,
    collapsed: false,
    props,
    created_at: now,
    updated_at: now,
  };
}

// "/2 columns": the block that holds the slash command becomes the first block
// of the first column (an empty paragraph, keeping its children) and every other
// column gets one empty paragraph. The list takes the block's place. Null inside
// a column, where lists are not allowed.
export function planInsertColumns(
  blocks: Block[],
  blockId: string,
  count: number,
  ctx: PlanContext
): { changes: Change[]; firstBlockId: string } | null {
  const block = blocks.find(b => b.id === blockId);
  if (!block || count < 2 || columnOf(blocks, blockId)) return null;
  const changes: Change[] = [];
  const list = newBlock(ctx, 'column_list', block.parent_id ?? null, block.position);
  changes.push({ op: 'create', block: list });
  const columns = Array.from({ length: count }, (_, i) => newBlock(ctx, 'column', list.id, (i + 1) * 1000));
  for (const column of columns) changes.push({ op: 'create', block: column });
  for (const column of columns.slice(1)) changes.push({ op: 'create', block: newBlock(ctx, 'paragraph', column.id, 1000) });
  const update = makeUpdate(block, { type: 'paragraph', content: '', parent_id: columns[0].id, position: 1000 });
  if (update) changes.push(update);
  return { changes, firstBlockId: block.id };
}

// Dropping blocks on the left / right edge of `targetId`:
//   - a top-level target is wrapped, with the dropped blocks, in a new column_list
//     of two columns (the target in one, the dropped blocks in the other);
//   - a target inside a column gets a new column beside its own, with the dropped
//     blocks, and the widths of the list go back to equal.
// Whatever the move empties (the column the blocks came from...) is cleaned up in
// the same plan. Null when the drop makes no sense (containers, a target inside
// what is dragged, a target nested under a regular block).
export function planColumnDrop(
  blocks: Block[],
  rootIds: string[],
  targetId: string,
  side: 'left' | 'right',
  ctx: PlanContext
): Change[] | null {
  const byId = new Map(blocks.map(b => [b.id, b]));
  const target = byId.get(targetId);
  const roots = selectionRoots(blocks, rootIds);
  if (!target || roots.length === 0 || !canDropBeside(blocks, targetId)) return null;
  if (roots.some(id => isContainerType(byId.get(id)?.type ?? 'column'))) return null;
  if (withSubtrees(blocks, roots).includes(targetId)) return null;

  const changes: Change[] = [];
  const moveInto = (columnId: string, ids: string[]) => {
    const positions = evenPositions(ids.length);
    ids.forEach((id, i) => {
      const update = makeUpdate(byId.get(id)!, { parent_id: columnId, position: positions[i] });
      if (update) changes.push(update);
    });
  };

  if (!target.parent_id) {
    const list = newBlock(ctx, 'column_list', null, target.position);
    const first = newBlock(ctx, 'column', list.id, 1000);
    const second = newBlock(ctx, 'column', list.id, 2000);
    changes.push({ op: 'create', block: list }, { op: 'create', block: first }, { op: 'create', block: second });
    moveInto(side === 'left' ? second.id : first.id, [targetId]);
    moveInto(side === 'left' ? first.id : second.id, roots);
  } else {
    const column = byId.get(target.parent_id)!;
    const listId = column.parent_id;
    if (!listId) return null;
    const columns = sortedChildren(blocks, listId).filter(c => c.type === 'column');
    const at = columns.findIndex(c => c.id === column.id);
    const position = side === 'left'
      ? positionBetween(columns[at - 1]?.position, column.position)
      : positionBetween(column.position, columns[at + 1]?.position);
    const added = newBlock(ctx, 'column', listId, position);
    changes.push({ op: 'create', block: added });
    moveInto(added.id, roots);
    for (const c of columns) {
      if (c.props?.width === undefined) continue;
      const { width: _width, ...rest } = c.props;
      const update = makeUpdate(c, { props: rest });
      if (update) changes.push(update);
    }
  }
  return [...changes, ...columnCleanup(blocks, changes)];
}
