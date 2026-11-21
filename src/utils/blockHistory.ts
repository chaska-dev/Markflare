// Pure helpers behind block-level undo/redo. An entry is a list of changes, each
// one stored with both sides (before/after), so the inverse is just a swap:
//   - update: only the fields the operation touched, before and after.
//   - create / delete: the whole block as it was (or will be), so a deleted
//     subtree can be built again.
// Which fields can be restored is deliberately narrow: `collapsed` is a view
// state and is never undone.

import { Block } from '../types';

export const HISTORY_FIELDS = ['type', 'content', 'checked', 'language', 'position', 'parent_id', 'props'] as const;
export type HistoryField = (typeof HISTORY_FIELDS)[number];
export type BlockPatch = Partial<Pick<Block, HistoryField>>;

export type UpdateChange = { op: 'update'; id: string; before: BlockPatch; after: BlockPatch };
export type Change =
  | UpdateChange
  | { op: 'create'; block: Block }
  | { op: 'delete'; block: Block };

export const HISTORY_CAP = 100;

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function currentValue(block: Block, field: HistoryField): unknown {
  // Un-migrated rows may lack parent_id/props; treat them like the defaults.
  if (field === 'parent_id') return block.parent_id ?? null;
  if (field === 'props') return block.props ?? {};
  return block[field];
}

// The update that turns `block` into `block + patch`, with the "before" side
// read from the block. Fields that already have the target value are dropped;
// null when nothing is left.
export function makeUpdate(block: Block, patch: BlockPatch): UpdateChange | null {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of HISTORY_FIELDS) {
    if (!(field in patch)) continue;
    const next = patch[field];
    const cur = currentValue(block, field);
    if (deepEqual(cur, next)) continue;
    before[field] = cur;
    after[field] = next;
  }
  if (Object.keys(after).length === 0) return null;
  return { op: 'update', id: block.id, before: before as BlockPatch, after: after as BlockPatch };
}

export function invertChange(change: Change): Change {
  switch (change.op) {
    case 'update': return { op: 'update', id: change.id, before: change.after, after: change.before };
    case 'create': return { op: 'delete', block: change.block };
    case 'delete': return { op: 'create', block: change.block };
  }
}

export function invertEntry(changes: Change[]): Change[] {
  return changes.map(invertChange);
}

// Several updates of the same block become one (the first "before" and the
// last "after" of each field win), and updates of a block created in the same
// entry are folded into its snapshot. Updates that end up changing nothing
// are dropped.
export function mergeChanges(changes: Change[]): Change[] {
  const out: Change[] = [];
  const updates = new Map<string, UpdateChange>();
  const created = new Map<string, { block: Block }>();
  for (const change of changes) {
    if (change.op === 'create') {
      const entry = { op: 'create' as const, block: change.block };
      created.set(change.block.id, entry);
      out.push(entry);
    } else if (change.op === 'delete') {
      out.push(change);
    } else {
      const target = created.get(change.id);
      if (target) {
        target.block = { ...target.block, ...change.after };
        continue;
      }
      const prev = updates.get(change.id);
      if (prev) {
        prev.before = { ...change.before, ...prev.before };
        prev.after = { ...prev.after, ...change.after };
      } else {
        const copy: UpdateChange = { op: 'update', id: change.id, before: { ...change.before }, after: { ...change.after } };
        updates.set(change.id, copy);
        out.push(copy);
      }
    }
  }
  return out.filter(c => {
    if (c.op !== 'update') return true;
    return HISTORY_FIELDS.some(f => f in c.after && !deepEqual(c.before[f], c.after[f]));
  });
}

export interface ApplyPlan {
  // Blocks to create, grouped by depth inside the set: every level only needs
  // the ones before it, so a level can be created in parallel.
  levels: Block[][];
  updates: UpdateChange[];
  deletes: Block[];
}

// Order of application, whatever the order inside the entry: create (parents
// first), then update, then delete. Updates may move a block under a block that
// is created in the same entry, or out of one that is deleted in it.
// `resolve` maps ids recorded earlier to the current ones (see the alias map in
// useBlockHistory).
export function planApply(changes: Change[], resolve: (id: string) => string = id => id): ApplyPlan {
  const creates = changes.filter((c): c is { op: 'create'; block: Block } => c.op === 'create').map(c => c.block);
  const byId = new Map(creates.map(b => [resolve(b.id), b]));
  const depthOf = (b: Block): number => {
    let depth = 0;
    let cur: Block | undefined = b;
    while (cur && cur.parent_id && depth <= creates.length) {
      cur = byId.get(resolve(cur.parent_id));
      if (cur) depth++;
    }
    return depth;
  };
  const levels: Block[][] = [];
  for (const b of creates) {
    const d = depthOf(b);
    (levels[d] ||= []).push(b);
  }
  return {
    levels: levels.filter(Boolean),
    updates: changes.filter((c): c is UpdateChange => c.op === 'update'),
    deletes: changes.filter((c): c is { op: 'delete'; block: Block } => c.op === 'delete').map(c => c.block),
  };
}

// Newest entries win when the stack is over its cap. Returns the ones dropped.
export function pushCapped<T>(stack: T[], item: T, cap: number = HISTORY_CAP): T[] {
  stack.push(item);
  const dropped: T[] = [];
  while (stack.length > cap) dropped.push(stack.shift()!);
  return dropped;
}

const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Uploads that blocks of these entries point at (image/file blocks created or
// deleted by them), once, as stored file ids.
export function uploadsIn(entries: Change[][]): Set<string> {
  const files = new Set<string>();
  for (const entry of entries) {
    for (const change of entry) {
      if (change.op === 'update') continue;
      const { type, content } = change.block;
      if ((type === 'image' || type === 'file') && FILE_ID.test(content)) files.add(content);
    }
  }
  return files;
}

// Follows old id -> new id links (a deleted block that is created again gets a
// new server id) to the id that is current now.
export function resolveAlias(aliases: Map<string, string>, id: string): string {
  let cur = id;
  for (let guard = 0; guard < 64; guard++) {
    const next = aliases.get(cur);
    if (next === undefined || next === cur) break;
    cur = next;
  }
  return cur;
}

// The block to show/focus for `id`: itself, or its outermost collapsed ancestor
// when it is hidden inside one. null when the block does not exist.
export function visibleTarget(list: Block[], id: string): string | null {
  const byId = new Map(list.map(b => [b.id, b]));
  let cur = byId.get(id);
  if (!cur) return null;
  let target = cur.id;
  for (let guard = 0; guard < 64 && cur.parent_id; guard++) {
    const parent = byId.get(cur.parent_id);
    if (!parent) break;
    if (parent.collapsed) target = parent.id;
    cur = parent;
  }
  return target;
}
