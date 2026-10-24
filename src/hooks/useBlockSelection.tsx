import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { Block, BlockType } from '../types';
import { ContextMenu, ContextMenuItem } from '../components/ContextMenu';
import { ColorMenu } from '../components/ColorMenu';
import { TRANSFORM_OPTIONS } from '../components/Block';
import { CopyIcon, PaletteIcon, TrashIcon } from '../components/Icons';
import { useLanguage } from '../i18n/LanguageContext';
import type { BlockHistory } from './useBlockHistory';
import { Change, makeUpdate } from '../utils/blockHistory';
import {
  Box,
  idsInRect,
  planIndent,
  planMultiDrop,
  planOutdent,
  rangeBetween,
  selectionRoots,
  stepId,
  withSubtrees,
} from '../utils/blockSelection';
import { blockColor, isColorable } from '../utils/blockColor';
import { columnCleanup, columnOf, verticalNeighbour } from '../utils/columns';
// Same module the backend exports with; roots whose parent is not in the list
// are written at the top level, which is what copying a part of the page needs.
import { blocksToMarkdown } from '../../server/shared/markdown';

// Multi-block selection, Notion-style. The selection is a list of block ids
// (what the user picked: a range of visible blocks) plus the anchor and head
// of the range, so Shift+Arrow can extend and shrink it. A selected parent
// stands for its whole subtree: delete, duplicate, copy, move and indent act on
// the "roots" (selected blocks with no selected ancestor) together with their
// descendants, while turn into and color only touch the blocks that were picked.
// Every operation is one history entry. Blocks inside columns are picked like any
// other (a range may cross columns, but Shift+Arrow started in a column stays in
// it); what an operation empties, a column or a list, is cleaned up in its entry.

interface Selection {
  ids: string[];
  anchor: string;
  head: string;
}

interface Deps {
  pageId: string;
  editorRef: RefObject<HTMLElement>;
  blocks: Block[];
  blocksRef: MutableRefObject<Block[]>;
  visibleIds: () => string[];
  history: BlockHistory;
  hasUpload: (id: string) => boolean;
  // Duplicate the roots (and their subtrees); returns the ids of the copies' roots.
  duplicateBlocks: (rootIds: string[], focus?: boolean) => string[];
  focusBlock: (id: string, caret?: number | null) => void;
  // Show hidden children of these blocks (a collapsed target of an indent/drop).
  expandBlocks: (ids: string[]) => void;
  turnable: (type: BlockType) => boolean;
  turnIntoShortcut: (e: KeyboardEvent) => BlockType | null;
  // True while a menu or dialog owns the keyboard.
  isBlocked: () => boolean;
}

export interface BlockSelection {
  // Ids drawn as selected: the picked blocks plus their descendants.
  selectedIds: Set<string>;
  hasSelection: () => boolean;
  selectBlock: (id: string) => void;
  selectBlocks: (ids: string[]) => void;
  selectAll: () => void;
  clear: () => void;
  // Rubber band rectangle (viewport coordinates) while dragging in the margin.
  band: Box | null;
  openMenu: (x: number, y: number) => void;
  menu: React.ReactNode;
  // Roots to move when `id` is dragged: the whole selection if it belongs to it.
  dragRoots: (id: string) => string[] | null;
  dropSelection: (rootIds: string[], targetId: string, zone: 'top' | 'middle' | 'bottom') => boolean;
}

const EMPTY = new Set<string>();

function blurInside(root: HTMLElement | null) {
  const el = document.activeElement as HTMLElement | null;
  if (el && el !== document.body && root?.contains(el)) el.blur();
  window.getSelection()?.removeAllRanges();
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // No clipboard permission (insecure context, old browser): use the legacy way.
  }
  const previous = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } finally {
    area.remove();
    previous?.focus?.();
  }
}

export function useBlockSelection(deps: Deps): BlockSelection {
  const { t } = useLanguage();
  const d = useRef(deps);
  d.current = deps;

  const [sel, setSel] = useState<Selection | null>(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const [band, setBand] = useState<Box | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menuPos !== null;

  const resolve = (id: string) => d.current.history.resolveId(id);
  const list = () => d.current.blocksRef.current;

  // Picked ids that still exist (a temp id may have been swapped meanwhile).
  const liveIds = (): string[] => {
    const s = selRef.current;
    if (!s) return [];
    const existing = new Set(list().map(b => b.id));
    return s.ids.map(resolve).filter(id => existing.has(id));
  };

  const selectedIds = useMemo(() => {
    if (!sel) return EMPTY;
    const existing = new Set(deps.blocks.map(b => b.id));
    const live = sel.ids.map(resolve).filter(id => existing.has(id));
    return new Set(withSubtrees(deps.blocks, live));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, deps.blocks]);
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  const clear = useCallback(() => {
    setSel(null);
    setMenuPos(null);
  }, []);

  const select = (ids: string[], anchor?: string, head?: string) => {
    if (ids.length === 0) {
      setSel(null);
      return;
    }
    blurInside(d.current.editorRef.current);
    setSel({ ids, anchor: anchor ?? ids[0], head: head ?? ids[ids.length - 1] });
  };

  const scrollTo = (id: string) => {
    document.getElementById(`block-${id}`)?.scrollIntoView({ block: 'nearest' });
  };

  // A selection whose blocks are all gone (deleted, page changed) is dropped.
  useEffect(() => {
    if (selRef.current && liveIds().length === 0) setSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps.blocks]);
  useEffect(() => {
    setSel(null);
    setMenuPos(null);
  }, [deps.pageId]);

  // ---- Operations ----

  const roots = (): string[] => selectionRoots(list(), liveIds());

  const deleteSelected = () => {
    const blocks = list();
    // Subpage blocks are only removed from the sidebar.
    const rootIds = roots().filter(id => blocks.find(b => b.id === id)?.type !== 'subpage');
    if (rootIds.length === 0) return;
    const ids = withSubtrees(blocks, rootIds);
    const gone = new Set(ids);
    const changes: Change[] = ids.map(id => ({ op: 'delete', block: blocks.find(b => b.id === id)! }));
    // A block still uploading has no content to bring back.
    const recorded = changes.filter(c => c.op === 'delete' && !d.current.hasUpload(c.block.id));
    const cleanup = columnCleanup(blocks, changes);

    // Focus the block before the first one removed (or the one after).
    const order = d.current.visibleIds();
    const first = order.findIndex(id => gone.has(id));
    let fallback: string | null = null;
    for (let i = first - 1; i >= 0 && !fallback; i--) if (!gone.has(order[i])) fallback = order[i];
    for (let i = first + 1; i < order.length && !fallback; i++) if (!gone.has(order[i])) fallback = order[i];

    void d.current.history.perform([...changes, ...cleanup], [...recorded, ...cleanup]);
    clear();
    if (fallback) d.current.focusBlock(fallback, Number.MAX_SAFE_INTEGER);
  };

  const copySelected = (): void => {
    const blocks = list();
    const ids = withSubtrees(blocks, roots()).filter(id => !d.current.hasUpload(id));
    if (ids.length === 0) return;
    // Positions are only comparable among siblings: renumber in document order.
    const subset = ids.map((id, i) => ({ ...blocks.find(b => b.id === id)!, position: i }));
    void writeClipboard(blocksToMarkdown(subset));
  };

  const duplicateSelected = () => {
    const rootIds = roots();
    if (rootIds.length === 0) return;
    const copies = d.current.duplicateBlocks(rootIds, false);
    if (copies.length > 0) select(copies);
  };

  const indentSelected = (outdent: boolean) => {
    const blocks = list();
    const rootIds = roots();
    const moves = outdent ? planOutdent(blocks, rootIds) : planIndent(blocks, rootIds);
    const changes: Change[] = [];
    for (const m of moves) {
      const block = blocks.find(b => b.id === m.id);
      const update = block && makeUpdate(block, { parent_id: m.parent_id, position: m.position });
      if (update) changes.push(update);
    }
    if (changes.length === 0) return;
    const parents = new Set(moves.map(m => m.parent_id).filter((p): p is string => p !== null));
    d.current.expandBlocks([...parents].filter(p => blocks.find(b => b.id === p)?.collapsed));
    void d.current.history.perform(changes);
  };

  const turnInto = (type: BlockType) => {
    const changes: Change[] = [];
    for (const block of liveIds().map(id => list().find(b => b.id === id)!)) {
      if (!block || block.type === type || !d.current.turnable(block.type)) continue;
      const update = makeUpdate(block, { type, content: type === 'divider' ? '' : block.content });
      if (update) changes.push(update);
    }
    if (changes.length > 0) void d.current.history.perform(changes);
  };

  const applyColor = (color: string) => {
    const changes: Change[] = [];
    for (const block of liveIds().map(id => list().find(b => b.id === id)!)) {
      if (!block || !isColorable(block.type)) continue;
      const props = { ...(block.props ?? {}) };
      if (color === 'default') delete props.color;
      else props.color = color;
      const update = makeUpdate(block, { props });
      if (update) changes.push(update);
    }
    if (changes.length > 0) void d.current.history.perform(changes);
  };

  const dropSelection = (rootIds: string[], targetId: string, zone: 'top' | 'middle' | 'bottom'): boolean => {
    const blocks = list();
    const plan = planMultiDrop(blocks, rootIds, targetId, zone);
    if (!plan) return false;
    const changes: Change[] = [];
    for (const m of plan.moves) {
      const block = blocks.find(b => b.id === m.id);
      const update = block && makeUpdate(block, { parent_id: m.parent_id, position: m.position });
      if (update) changes.push(update);
    }
    if (changes.length === 0) return true;
    if (zone === 'middle' && blocks.find(b => b.id === targetId)?.collapsed) d.current.expandBlocks([targetId]);
    void d.current.history.perform([...changes, ...columnCleanup(blocks, changes)]);
    return true;
  };

  const selectAll = () => {
    const order = d.current.visibleIds();
    if (order.length > 0) select(order, order[0], order[order.length - 1]);
  };

  // Arrow keys: with Shift the head moves and the range follows; without, the
  // selection collapses onto the block above its first / below its last block.
  const moveSelection = (dir: -1 | 1, extend: boolean) => {
    const s = selRef.current;
    if (!s) return;
    const order = d.current.visibleIds();
    if (extend) {
      const anchor = resolve(s.anchor);
      let head = stepId(order, resolve(s.head), dir);
      // A range started inside a column doesn't spill into the other columns.
      const column = columnOf(list(), anchor);
      if (column && columnOf(list(), head)?.id !== column.id) head = resolve(s.head);
      select(rangeBetween(order, anchor, head), s.anchor, head);
      scrollTo(head);
      return;
    }
    const indexes = liveIds().map(id => order.indexOf(id)).filter(i => i >= 0);
    if (indexes.length === 0) return;
    const from = dir < 0 ? Math.min(...indexes) : Math.max(...indexes);
    // Leaving a column goes to the block before / after its list, like the arrow keys.
    const next = verticalNeighbour(list(), order, order[from], dir) ?? order[from];
    select([next]);
    scrollTo(next);
  };

  // ---- Keyboard (document level: while blocks are selected nothing has focus) ----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = selRef.current;
      // defaultPrevented: the block that was just selected with Escape already used this key.
      if (!s || e.defaultPrevented || e.isComposing || menuOpenRef.current || d.current.isBlocked()) return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select') || target?.isContentEditable) return;
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest?.('button, a, [role="button"]')) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        e.preventDefault();
        clear();
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod && !e.altKey) {
        e.preventDefault();
        moveSelection(e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      } else if (e.key === 'Enter' && !mod && !e.shiftKey) {
        e.preventDefault();
        const picked = new Set(liveIds());
        const firstId = d.current.visibleIds().find(id => picked.has(id));
        clear();
        if (firstId) d.current.focusBlock(firstId, Number.MAX_SAFE_INTEGER);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && !mod) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Tab' && !mod) {
        e.preventDefault();
        indentSelected(e.shiftKey);
      } else if (mod && !e.altKey && !e.shiftKey && key === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && !e.altKey && !e.shiftKey && key === 'c') {
        e.preventDefault();
        copySelected();
      } else if (mod && !e.altKey && !e.shiftKey && key === 'x') {
        e.preventDefault();
        copySelected();
        deleteSelected();
      } else if (mod && !e.altKey && !e.shiftKey && key === 'a') {
        e.preventDefault();
        selectAll();
      } else if (d.current.turnIntoShortcut(e)) {
        e.preventDefault();
        turnInto(d.current.turnIntoShortcut(e)!);
      } else if (e.key.length === 1 && !mod && !e.altKey) {
        // Typing is not an edit of the selection: it just ends it.
        clear();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Mouse: shift+click ranges, rubber band, click away ----

  const dragRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const root = d.current.editorRef.current;
      const target = e.target as HTMLElement | null;
      if (!root || !target) return;
      // The selection's own menu and its submenus.
      if (target.closest('.context-menu, .context-submenu')) return;

      const blockEl = root.contains(target) ? target.closest<HTMLElement>('[data-block-id]') : null;
      const blockId = blockEl?.getAttribute('data-block-id') ?? null;

      if (e.button === 2) {
        // Right-click on a selected block opens the selection's menu (its own
        // handler); anywhere else it ends the selection.
        if (!(blockId && selectedRef.current.has(blockId))) clear();
        return;
      }
      if (e.button !== 0) return;

      if (e.shiftKey && blockId) {
        // Shift+click on the gutter selects from the focused block, and on any
        // block while a selection exists extends it. Otherwise it is the usual
        // text selection.
        const s = selRef.current;
        const onGutter = Boolean(target.closest('.block-gutter'));
        if (s || onGutter) {
          e.preventDefault();
          const active = document.activeElement?.closest?.('[data-block-id]')?.getAttribute('data-block-id');
          const anchor = s ? resolve(s.anchor) : (active ?? blockId);
          const range = rangeBetween(d.current.visibleIds(), anchor, blockId);
          select(range.length > 0 ? range : [blockId], anchor, blockId);
        }
        return;
      }

      // The handle of a selected block: dragging it moves the selection and its
      // click opens the menu, so the selection has to survive.
      if (blockId && selectedRef.current.has(blockId) && target.closest('.block-gutter')) return;

      const main = root.closest<HTMLElement>('.main-content');
      const emptyArea = target === root || target === main
        || target.classList.contains('page-view')
        || target.classList.contains('block-wrapper')
        || target.classList.contains('block-gutter')
        || target.classList.contains('block-columns')
        || target.classList.contains('block-column');
      const onScrollbar = Boolean(main) && e.clientX >= main!.getBoundingClientRect().left + main!.clientWidth;
      if (!emptyArea || onScrollbar || !main) {
        if (selRef.current) clear();
        return;
      }

      // Rubber band: keeps the browser from selecting text or moving focus.
      e.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) active.blur();
      window.getSelection()?.removeAllRanges();
      clear();
      // y is kept in content coordinates so scrolling during the drag moves the band.
      dragRef.current = { x: e.clientX, y: e.clientY + main.scrollTop, active: false };
      let last = { x: e.clientX, y: e.clientY };

      const update = () => {
        const start = dragRef.current;
        if (!start) return;
        const startY = start.y - main.scrollTop;
        if (!start.active && Math.hypot(last.x - start.x, last.y - startY) < 4) return;
        start.active = true;
        const rect: Box = {
          left: Math.min(start.x, last.x),
          right: Math.max(start.x, last.x),
          top: Math.min(startY, last.y),
          bottom: Math.max(startY, last.y),
        };
        setBand(rect);
        // Any horizontal position counts: the band is drawn in the margin, next
        // to the blocks, not over them.
        const items = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]')).map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.getAttribute('data-block-id')!, top: r.top, bottom: r.bottom, left: -Infinity, right: Infinity };
        });
        const hit = idsInRect(items, rect);
        const prev = selRef.current;
        if (hit.join() === (prev?.ids.join() ?? '')) return;
        setSel(hit.length > 0 ? { ids: hit, anchor: hit[0], head: hit[hit.length - 1] } : null);
      };
      const onMove = (ev: MouseEvent) => {
        last = { x: ev.clientX, y: ev.clientY };
        update();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        main.removeEventListener('scroll', update);
        document.body.style.userSelect = '';
        dragRef.current = null;
        setBand(null);
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      main.addEventListener('scroll', update);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focusing text (clicking into a block, Enter) ends the selection.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (selRef.current && el?.isContentEditable && d.current.editorRef.current?.contains(el)) setSel(null);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  // ---- Context menu ----

  const menuItems = (): ContextMenuItem[] => {
    const picked = liveIds().map(id => list().find(b => b.id === id)).filter((b): b is Block => Boolean(b));
    const canTurn = picked.some(b => d.current.turnable(b.type));
    const colorable = picked.filter(b => isColorable(b.type));
    const colors = new Set(colorable.map(b => blockColor(b.type, b.props) ?? 'default'));
    return [
      ...(canTurn
        ? [
            { label: t('ctx.transformTo'), header: true },
            ...TRANSFORM_OPTIONS.map(opt => ({
              label: t(opt.labelKey) || opt.label,
              icon: opt.icon,
              onClick: () => turnInto(opt.type),
            })),
            { divider: true as const },
          ]
        : []),
      ...(colorable.length > 0
        ? [{
            label: t('ctx.color'),
            icon: <PaletteIcon size={14} />,
            submenu: (
              <ColorMenu
                value={colors.size === 1 ? [...colors][0] : undefined}
                onSelect={(color) => {
                  applyColor(color);
                  setMenuPos(null);
                }}
              />
            ),
          }]
        : []),
      { label: t('ctx.duplicate'), icon: <CopyIcon size={14} />, onClick: duplicateSelected },
      { label: t('ctx.delete'), icon: <TrashIcon size={14} />, danger: true, onClick: deleteSelected },
    ];
  };

  const menu = menuPos && sel
    ? <ContextMenu x={menuPos.x} y={menuPos.y} items={menuItems()} onClose={() => setMenuPos(null)} />
    : null;

  return {
    selectedIds,
    hasSelection: () => selRef.current !== null,
    selectBlock: (id) => select([id]),
    selectBlocks: (ids) => select(ids),
    selectAll,
    clear,
    band,
    openMenu: (x, y) => setMenuPos({ x, y }),
    menu,
    dragRoots: (id) => {
      if (!selectedRef.current.has(id)) return null;
      const picked = roots();
      return picked.length > 0 ? picked : null;
    },
    dropSelection,
  };
}
