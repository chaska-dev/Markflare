import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { Block } from '../types';
import { api } from '../api/client';
import {
  BlockPatch,
  Change,
  invertEntry,
  mergeChanges,
  planApply,
  pushCapped,
  resolveAlias,
  uploadsIn,
} from '../utils/blockHistory';

// Block-level undo/redo for the editor. What it records are structural
// operations (create, delete, move, type, checked, props, ...), each as a list
// of before/after changes (utils/blockHistory.ts). Undo applies the inverse to
// the local list and to the server; redo applies the entry again.
//
// Text typed inside a block keeps the browser's own undo. The rule that
// decides who handles Ctrl+Z: if the focused text block's content differs from
// what it held when it got focus (or since the last recorded operation), the
// key is left to the browser; otherwise block-level undo runs. There is no
// reliable way to tell when the browser's stack for a block is exhausted, so
// "content changed since focus" is the stand-in. To keep text restorable by
// later structural undos, a block that loses focus after its text changed
// records a content snapshot entry (and so does any operation, for the block
// that is still focused, before its own entry).
//
// Server sync: POST /pages/:id/blocks ignores a client-provided id, so a block
// that is created again (undo of a delete, redo of a create) gets a new server
// id. Entries keep the ids they were recorded with and `resolveId` follows an
// alias map (old id -> current id), which also covers temp- ids once their
// create has finished. Requests for a block whose create is still in flight
// wait for it.
//
// Deleting an image/file block keeps its upload in storage (DELETE ?keep_file=1),
// because undo may bring the block back with it. Uploads that history can no
// longer restore (entry dropped from the stacks, or the page is left) are
// released then, see releaseUploads.

interface Deps {
  pageId: string;
  blocksRef: MutableRefObject<Block[]>;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  updaterRef: MutableRefObject<{ flush: () => void } | null>;
  inflightCreatesRef: MutableRefObject<Map<string, Promise<Block | null>>>;
  discardJob: (id: string) => void;
  // Ids in the order they are shown (collapsed subtrees left out).
  visibleIds: () => string[];
  // Where the editor puts focus/selection after an undo or redo: the blocks the
  // entry touched that still exist, and a neighbour to fall back to when it only
  // removed blocks.
  onApplied: (touched: string[], fallbackId: string | null) => void;
  // True while a menu or dialog owns the keyboard.
  isBlocked: () => boolean;
}

export interface BlockHistory {
  record: (changes: Change[]) => void;
  group: <T>(fn: () => T) => T;
  perform: (changes: Change[], recorded?: Change[]) => Promise<void>;
  undo: () => void;
  redo: () => void;
  resolveId: (id: string) => string;
  noteSwap: (oldId: string, newId: string) => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  baselineContent: (id: string) => string | undefined;
  rebase: (id: string, content: string) => void;
}

export function useBlockHistory(deps: Deps): BlockHistory {
  const d = useRef(deps);
  d.current = deps;

  const undoRef = useRef<Change[][]>([]);
  const redoRef = useRef<Change[][]>([]);
  const aliasesRef = useRef(new Map<string, string>());
  // Content each block had when it got focus (see the rule above).
  const baselinesRef = useRef(new Map<string, { content: string }>());
  const groupRef = useRef<Change[] | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const genRef = useRef(0);

  const resolveId = useCallback((id: string) => resolveAlias(aliasesRef.current, id), []);
  const blocks = () => d.current.blocksRef.current;

  // Uploads kept for undo that no block points at any more are removed by the
  // server's own rule: create a block for the file and delete it again without
  // keep_file; the server drops the upload unless some other block still uses it.
  // `keep` are the entries still in the stacks: their uploads can come back.
  const releaseUploads = (pageId: string, entries: Change[][], keep: Change[][] = []) => {
    const files = uploadsIn(entries);
    for (const f of uploadsIn(keep)) files.delete(f);
    for (const b of blocks()) if (b.type === 'image' || b.type === 'file') files.delete(b.content);
    if (files.size === 0) return;
    void (async () => {
      for (const content of files) {
        try {
          const res = await api.blocks.create(pageId, { type: 'file', content, position: 0 });
          await api.blocks.delete(res.block.id);
        } catch {
          // The page is gone (or offline): the upload goes with the page.
        }
      }
    })();
  };

  // History belongs to one page.
  useEffect(() => {
    const { pageId } = deps;
    genRef.current++;
    undoRef.current = [];
    redoRef.current = [];
    aliasesRef.current = new Map();
    baselinesRef.current = new Map();
    groupRef.current = null;
    return () => releaseUploads(pageId, [...undoRef.current, ...redoRef.current]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.pageId]);

  const noteSwap = (oldId: string, newId: string) => {
    aliasesRef.current.set(oldId, newId);
    const base = baselinesRef.current.get(oldId);
    if (base) {
      baselinesRef.current.delete(oldId);
      baselinesRef.current.set(newId, base);
    }
  };

  const pushEntry = (changes: Change[]) => {
    const merged = mergeChanges(changes);
    if (merged.length === 0) return;
    const dropped = [...pushCapped(undoRef.current, merged), ...redoRef.current.splice(0)];
    if (dropped.length > 0) releaseUploads(d.current.pageId, dropped, [...undoRef.current, ...redoRef.current]);
  };

  // Content snapshot for one block, if its text moved away from the baseline.
  const snapshotContent = (id: string, base: { content: string }) => {
    const block = blocks().find(b => b.id === resolveId(id));
    if (!block || block.content === base.content) return;
    pushEntry([{ op: 'update', id: block.id, before: { content: base.content }, after: { content: block.content } }]);
    base.content = block.content;
  };

  // Text typed in a block that is still focused goes into history before the
  // operation that follows it, so entries stay in the order they happened.
  const commitPending = () => {
    for (const [id, base] of baselinesRef.current) snapshotContent(id, base);
  };

  const record = (changes: Change[]) => {
    if (changes.length === 0) return;
    if (groupRef.current) {
      groupRef.current.push(...changes);
      return;
    }
    commitPending();
    pushEntry(changes);
  };

  // Everything recorded while `fn` runs synchronously becomes one entry.
  const group = <T,>(fn: () => T): T => {
    if (groupRef.current) return fn();
    commitPending();
    groupRef.current = [];
    try {
      return fn();
    } finally {
      const changes = groupRef.current ?? [];
      groupRef.current = null;
      pushEntry(changes);
    }
  };

  // Focus tracking. The baseline of a block is set when focus enters it and
  // dropped (after a snapshot, if the text changed) when focus leaves it.
  const blockIdOf = (el: EventTarget | null): string | null =>
    (el as HTMLElement | null)?.closest?.('[data-block-id]')?.getAttribute('data-block-id') ?? null;

  const onFocus = (e: React.FocusEvent) => {
    const id = blockIdOf(e.target);
    if (!id || baselinesRef.current.has(id)) return;
    const block = blocks().find(b => b.id === id);
    if (block) baselinesRef.current.set(id, { content: block.content });
  };

  const onBlur = (e: React.FocusEvent) => {
    const id = blockIdOf(e.target);
    if (!id) return;
    const blockEl = (e.target as HTMLElement).closest('[data-block-id]');
    const next = e.relatedTarget as Node | null;
    // Moving inside the block (table cell to cell) is not leaving it.
    if (next && blockEl?.contains(next)) return;
    const base = baselinesRef.current.get(id);
    if (!base) return;
    baselinesRef.current.delete(id);
    // The debounced updater remembers a single call: save what is pending.
    d.current.updaterRef.current?.flush();
    snapshotContent(id, base);
    // A table cell commits its text in its own blur handler, which lands after
    // this one.
    setTimeout(() => snapshotContent(id, base), 0);
  };

  const rebase = (id: string, content: string) => {
    const base = baselinesRef.current.get(id);
    if (base) base.content = content;
  };

  // ---- Applying changes to the local list and the server ----

  // The server id of a block, waiting for its create when it is still in
  // flight. null if it never got one.
  const serverId = async (id: string): Promise<string | null> => {
    let cur = resolveId(id);
    if (!cur.startsWith('temp-')) return cur;
    const pending = d.current.inflightCreatesRef.current.get(cur);
    if (!pending) return null;
    const saved = await pending;
    cur = resolveId(cur);
    return saved && !cur.startsWith('temp-') ? cur : null;
  };

  const applyLocal = (items: { id: string; patch: BlockPatch }[]) => {
    const byFinal = new Map<string, BlockPatch>();
    for (const { id, patch } of items) {
      const p: BlockPatch = { ...patch };
      if (typeof p.parent_id === 'string') p.parent_id = resolveId(p.parent_id);
      byFinal.set(resolveId(id), p);
    }
    d.current.setBlocks(prev =>
      prev.map(b => {
        const p = byFinal.get(resolveId(b.id));
        return p ? { ...b, ...p } : b;
      }).sort((a, b) => a.position - b.position)
    );
  };

  // Position-only changes of several blocks go out in one reorder request.
  const sendPatches = async (items: { id: string; patch: BlockPatch }[]) => {
    d.current.updaterRef.current?.flush();
    const ready: { real: string; patch: BlockPatch }[] = [];
    const waited: { id: string; patch: BlockPatch }[] = [];
    for (const { id, patch } of items) {
      const wasTemp = resolveId(id).startsWith('temp-');
      const real = await serverId(id);
      if (!real) continue;
      if (wasTemp) waited.push({ id, patch });
      const out: BlockPatch = { ...patch };
      if (typeof out.parent_id === 'string') {
        const parent = await serverId(out.parent_id);
        if (parent) out.parent_id = parent;
        else delete out.parent_id;
      }
      ready.push({ real, patch: out });
    }
    const positionOnly = ready.filter(r => Object.keys(r.patch).every(k => k === 'position'));
    const batched = positionOnly.length > 1 ? new Set(positionOnly) : new Set<typeof ready[number]>();
    if (batched.size > 0) {
      try {
        await api.blocks.reorder(positionOnly.map(r => ({ id: r.real, position: r.patch.position as number })));
      } catch (e) {
        console.error('Failed to reorder blocks', e);
      }
    }
    for (const r of ready) {
      if (batched.has(r)) continue;
      try {
        await api.blocks.update(r.real, r.patch);
      } catch (e) {
        console.error('Failed to update block', e);
      }
    }
    // A block that was still being created is replaced by the server's copy
    // when the create finishes, which would undo the local change.
    if (waited.length > 0) applyLocal(waited);
  };

  const applyChanges = async (changes: Change[]): Promise<string[]> => {
    const gen = genRef.current;
    const alive = () => genRef.current === gen;
    const { pageId } = d.current;
    const plan = planApply(changes, resolveId);
    d.current.updaterRef.current?.flush();
    const touched: string[] = [];

    // 1. Create, parents before children. Each level only depends on the
    // previous one, so a level goes out in parallel.
    const failed = new Set<string>();
    const made: Block[] = [];
    for (const level of plan.levels) {
      await Promise.all(level.map(async (snap) => {
        const logical = resolveId(snap.id);
        if (blocks().some(b => b.id === logical)) return;
        try {
          let parentId: string | null = null;
          if (snap.parent_id) {
            const parentLogical = resolveId(snap.parent_id);
            if (failed.has(parentLogical)) {
              failed.add(logical);
              return;
            }
            // A parent that is gone (deleted later) leaves the block at the
            // root, which is also what the server does with an unknown parent.
            const exists = made.some(b => b.id === parentLogical) || blocks().some(b => b.id === parentLogical);
            parentId = exists ? await serverId(parentLogical) : null;
          }
          const res = await api.blocks.create(pageId, {
            type: snap.type,
            content: snap.content,
            position: snap.position,
            parent_id: parentId,
            language: snap.language,
            props: snap.props,
          });
          let saved = res.block;
          // create() doesn't take these two.
          if (snap.checked || snap.collapsed) {
            saved = (await api.blocks.update(saved.id, { checked: snap.checked, collapsed: snap.collapsed })).block;
          }
          aliasesRef.current.set(logical, saved.id);
          made.push({ ...saved, parent_id: saved.parent_id ?? null, collapsed: saved.collapsed ?? false, props: saved.props ?? {} });
        } catch (e) {
          failed.add(logical);
          console.error('Failed to restore block', e);
        }
      }));
      if (!alive()) return [];
    }
    if (made.length > 0) {
      d.current.setBlocks(prev => {
        const have = new Set(prev.map(b => b.id));
        return [...prev, ...made.filter(b => !have.has(b.id))].sort((a, b) => a.position - b.position);
      });
      touched.push(...made.map(b => b.id));
    }

    // 2. Update.
    if (plan.updates.length > 0) {
      const items = plan.updates.map(u => ({ id: u.id, patch: u.after }));
      applyLocal(items);
      for (const u of plan.updates) {
        touched.push(resolveId(u.id));
        // The block's text was set from here, not typed: not a change to record.
        if (typeof u.after.content === 'string') rebase(resolveId(u.id), u.after.content);
      }
      await sendPatches(items);
      if (!alive()) return touched;
    }

    // 3. Delete. Image/file uploads stay in storage (keep_file): redo and undo
    // may need the block back with its file.
    if (plan.deletes.length > 0) {
      const ids = plan.deletes.map(b => resolveId(b.id));
      for (const id of ids) {
        d.current.discardJob(id);
        baselinesRef.current.delete(id);
      }
      const gone = new Set(ids);
      d.current.setBlocks(prev => prev.filter(b => !gone.has(resolveId(b.id))));
      for (const snap of plan.deletes) {
        const real = await serverId(snap.id);
        if (!real) continue;
        try {
          await api.blocks.delete(real, { keepFile: snap.type === 'image' || snap.type === 'file' });
        } catch (e) {
          console.error('Failed to delete block', e);
        }
      }
    }
    return touched;
  };

  // One history step at a time: a second Ctrl+Z while the first is still
  // talking to the server waits for it.
  const enqueue = (job: () => Promise<void>): Promise<void> => {
    queueRef.current = queueRef.current.then(job).catch(e => console.error('History step failed', e));
    return queueRef.current;
  };

  const step = (dir: 'undo' | 'redo'): Promise<void> => enqueue(async () => {
    const from = dir === 'undo' ? undoRef.current : redoRef.current;
    const to = dir === 'undo' ? redoRef.current : undoRef.current;
    const entry = from.pop();
    if (!entry) return;
    const dropped = pushCapped(to, entry);
    if (dropped.length > 0) releaseUploads(d.current.pageId, dropped, [...undoRef.current, ...redoRef.current]);
    const changes = dir === 'undo' ? invertEntry(entry) : entry;

    // When blocks go away, focus the one that was right before the first of them.
    const removed = new Set(planApply(changes, resolveId).deletes.map(b => resolveId(b.id)));
    let fallback: string | null = null;
    if (removed.size > 0) {
      const order = d.current.visibleIds();
      const first = order.findIndex(id => removed.has(id));
      for (let i = first - 1; i >= 0 && !fallback; i--) if (!removed.has(order[i])) fallback = order[i];
      for (let i = first + 1; i < order.length && !fallback; i++) if (!removed.has(order[i])) fallback = order[i];
    }
    const touched = await applyChanges(changes);
    d.current.onApplied(touched, fallback);
  });

  // Record `recorded` (default: all of `changes`) and apply `changes`. The
  // split lets a caller leave out what must not be restored (blocks that were
  // still uploading).
  const perform = (changes: Change[], recorded: Change[] = changes): Promise<void> => {
    record(recorded);
    return enqueue(async () => {
      await applyChanges(changes);
    });
  };

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y, wherever the focus is (nothing,
  // the page, a block) except in inputs and in editors inside a block (table
  // cells, captions), which keep the browser's undo.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const isUndo = mod && key === 'z' && !e.shiftKey;
      const isRedo = (mod && key === 'z' && e.shiftKey) || (e.ctrlKey && !e.metaKey && key === 'y' && !e.shiftKey);
      if (!isUndo && !isRedo) return;
      if (d.current.isBlocked() || document.querySelector('[role="dialog"]')) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input:not([type="checkbox"]), textarea, select')) return;
      if (target?.isContentEditable) {
        // Inner editors (table cells, captions) keep the browser's undo.
        if (!target.classList.contains('block-content')) return;
        const id = blockIdOf(target);
        const block = id ? blocks().find(b => b.id === id) : undefined;
        const base = id ? baselinesRef.current.get(id) : undefined;
        // The block's own text: native undo while it differs from its baseline.
        if (block && base && block.content !== base.content) return;
      }

      const stack = isUndo ? undoRef.current : redoRef.current;
      if (stack.length === 0) return;
      e.preventDefault();
      void step(isUndo ? 'undo' : 'redo');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    record,
    group,
    perform,
    undo: () => void step('undo'),
    redo: () => void step('redo'),
    resolveId,
    noteSwap,
    onFocus,
    onBlur,
    baselineContent: (id) => baselinesRef.current.get(id)?.content,
    rebase,
  };
}
