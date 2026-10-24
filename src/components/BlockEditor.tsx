import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Block as BlockType, BlockType as BType, BlockProps, UploadState, FileInfo, Page } from '../types';
import { Block } from './Block';
import { SlashMenu } from './SlashMenu';
import { MentionMenu, filterMentionPages, mentionLinkMarkdown } from './MentionMenu';
import { ShortcutsModal } from './ShortcutsModal';
import { UploadIcon, XIcon } from './Icons';
import { api, ApiError } from '../api/client';
import { optimizeImage } from '../utils/imageCompress';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MAX_PARALLEL_UPLOADS, createLimiter } from '../utils/uploads';
import { getCaretOffset, getCaretRect, placeCaret } from '../utils/caret';
import { collectSubtree, sortedChildren, positionBetween } from '../utils/blockTree';
import { imageUrlFromText, imageUrlFromDrop, hasWebImageTypes } from '../utils/webImage';
import { usePageContext } from '../contexts/PageContext';
import { useLanguage } from '../i18n/LanguageContext';
// Shared markdown parser (same module used by the backend on import). Used to
// split multi-line or markdown-marked pastes into multiple blocks. The
// "looks like markdown" heuristic lives in the handler; this is just the parser.
import { parseMarkdownToBlocks } from '../../server/shared/markdown';

interface Props {
  pageId: string;
  initialBlocks: BlockType[];
}

// Debounce + flush: batches changes so we don't hammer the server, but ensures
// that on editor unmount (page navigation, refresh, tab close) the latest
// pending change is persisted. Fixes the bug where the user typed and
// navigated before the 500ms debounce fired.
function debounceWithFlush<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;
  const wrapped = (...args: Parameters<T>) => {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = pendingArgs;
      pendingArgs = null;
      if (a) fn(...a);
    }, ms);
  };
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const a = pendingArgs;
      pendingArgs = null;
      if (a) {
        // fire-and-forget; flush is synchronous from the caller.
        Promise.resolve(fn(...a)).catch(() => {});
      }
    }
  };
  return { debounced: wrapped, flush };
}

// Tree helpers.
// Blocks live in a flat list with `parent_id` (markflare-style). We build the
// tree once per render to display the hierarchy. `position` orders siblings
// under the same parent.

interface FlattenOpts {
  // IDs whose children should not be shown (an ancestor is collapsed).
  hiddenAncestors: Set<string>;
}

function flattenForRender(blocks: BlockType[], opts: FlattenOpts): { block: BlockType; depth: number; hasChildren: boolean }[] {
  const byId = new Map<string, BlockType>();
  const childrenOf = new Map<string | null, BlockType[]>();
  for (const b of blocks) {
    byId.set(b.id, b);
    const key = b.parent_id ?? null;
    const arr = childrenOf.get(key);
    if (arr) arr.push(b);
    else childrenOf.set(key, [b]);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => a.position - b.position);
  }

  const out: { block: BlockType; depth: number; hasChildren: boolean }[] = [];
  const walk = (parentId: string | null, depth: number, ancestorHidden: boolean) => {
    const siblings = childrenOf.get(parentId) || [];
    for (const b of siblings) {
      const kids = childrenOf.get(b.id) || [];
      const hasChildren = kids.length > 0;
      // If an ancestor is collapsed, the whole subtree is omitted.
      // If this block itself is collapsed, its direct children are omitted
      // (but the block itself still renders).
      const isHidden = ancestorHidden;
      const hideKids = isHidden || b.collapsed;
      if (!isHidden) {
        out.push({ block: b, depth, hasChildren });
      }
      if (hasChildren && !hideKids) {
        walk(b.id, depth + 1, isHidden);
      }
    }
  };
  walk(null, 0, false);
  // hiddenAncestors is kept on the signature for future use (search filters,
  // etc.). Today it's always an empty Set.
  void opts.hiddenAncestors;
  return out;
}

// Find the previous block in document order (any sibling or ancestor sibling,
// by position). Returns the previous block or null if first.
function previousBlock(blocks: BlockType[], id: string): BlockType | null {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx <= 0) return null;
  return blocks[idx - 1];
}

// Is `maybeDescendant` a descendant of `ancestor` in the block tree? Used by
// drag & drop to reject drops that would create cycles (nesting a parent
// inside its own child).
function isDescendantOf(blocks: BlockType[], maybeDescendant: string, ancestor: string): boolean {
  let cur = blocks.find(b => b.id === maybeDescendant);
  let guard = 0;
  while (cur && guard++ < 64) {
    if (!cur.parent_id) return false;
    if (cur.parent_id === ancestor) return true;
    cur = blocks.find(b => b.id === cur!.parent_id);
  }
  return false;
}

// Find the new parent candidate for a block when Tab is pressed.
// Rules (markflare model):
//   - If the previous block is at level 0 (no parent), the new parent is that
//     previous block.
//   - If the previous block already has a parent, the new parent is the
//     previous block's parent (one level deeper — this is what markflare does).
// If there's no previous block, indent isn't possible.
function indentTarget(blocks: BlockType[], id: string): string | null {
  const prev = previousBlock(blocks, id);
  if (!prev) return null;
  return prev.id;
}

// Shift+Tab: find the new parent when dedenting. The block becomes a sibling
// of its current parent (just after it). If it has no parent, dedent is a no-op.
function dedentTarget(blocks: BlockType[], id: string): { newParentId: string | null; newPrev: BlockType | null } {
  const block = blocks.find(b => b.id === id);
  if (!block || !block.parent_id) return { newParentId: null, newPrev: null };
  const parent = blocks.find(b => b.id === block.parent_id);
  if (!parent) return { newParentId: null, newPrev: null };
  // Insert the block (and all its children) just after the parent, as its
  // sibling. The "previous" position is the parent's last child for ordering.
  const lastSiblingChild = blocks
    .filter(b => b.parent_id === parent.id)
    .sort((a, b) => b.position - a.position)[0];
  return { newParentId: parent.parent_id ?? null, newPrev: lastSiblingChild || parent };
}

// Turn-into shortcuts (Notion's numbering). 7 is left free on purpose: on
// Spanish keyboards Ctrl+Shift+7 is Ctrl+/ (the shortcuts cheat sheet).
const TURN_INTO_BY_DIGIT: Record<string, BType> = {
  '0': 'paragraph',
  '1': 'heading1',
  '2': 'heading2',
  '3': 'heading3',
  '4': 'todo',
  '5': 'bullet_list',
  '6': 'numbered_list',
  '8': 'code',
};
// Blocks that don't hold plain text, so "turn into" doesn't apply.
const NOT_TURNABLE: BType[] = ['image', 'file', 'subpage', 'table', 'math', 'divider'];

// macOS: Cmd+Option+digit. Elsewhere: Ctrl+Shift+digit, like Notion. Ctrl+Alt
// is also accepted, but only when the key really produced the digit: on many
// layouts Ctrl+Alt is AltGr, and Ctrl+Alt+2 must stay free to type "@".
function turnIntoShortcut(e: React.KeyboardEvent): BType | null {
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1];
  if (!digit) return null;
  const mac = e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey;
  const ctrlShift = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey;
  const ctrlAlt = e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey && e.key === digit;
  if (!mac && !ctrlShift && !ctrlAlt) return null;
  return TURN_INTO_BY_DIGIT[digit] ?? null;
}

// "@" (after whitespace or at the start) or "[[" followed by the page name
// being typed, ending at the caret. Group 1 = "@", 2 = "[[", 3 = the query.
const MENTION_RE = /(?:(?:^|\s)(@)|(\[\[))(?!\s)([^@[\]\n]{0,40})$/;

// A file upload bound to a block. Lives in a ref (not state) because the upload
// loop mutates it; what the UI renders is the matching UploadState entry.
interface UploadJob {
  // Current id of the block. Follows the temp-id -> server-id swap.
  blockId: string;
  file: File;
  kind: 'image' | 'file';
  controller: AbortController;
  // How the block looked before the upload took it over (empty paragraph, the
  // "/image" command text, empty image). null for placeholders created for the
  // upload, which just disappear on cancel.
  revert: Pick<BlockType, 'type' | 'content' | 'language'> | null;
  // Placeholders exist only in the browser until the file is stored; the block
  // row is created at that point, so a cancelled or abandoned upload leaves
  // nothing behind. Blocks that already exist on the server (or are being
  // created) are updated instead.
  persisted: boolean;
  // Kept after the transfer succeeds so that a failed block save can be retried
  // without sending the file again.
  uploaded: FileInfo | null;
}

export function BlockEditor({ pageId, initialBlocks }: Props) {
  const [blocks, setBlocks] = useState<BlockType[]>(() =>
    // Ensure new fields have defaults if the backend doesn't return them yet
    // (compatibility with un-migrated DBs).
    initialBlocks.map(b => ({
      ...b,
      parent_id: b.parent_id ?? null,
      collapsed: b.collapsed ?? false,
    }))
  );
  const [slashMenu, setSlashMenu] = useState<{
    visible: boolean;
    blockId: string | null;
    query: string;
    position: { top: number; left: number };
  }>({ visible: false, blockId: null, query: '', position: { top: 0, left: 0 } });
  const { pages, createPage, refreshPages } = usePageContext();
  const { t } = useLanguage();

  // Page picker opened by typing "@" or "[[". `start` is where the trigger
  // sits in the block's text, so the whole "@query" can be replaced by the link.
  const [mention, setMention] = useState<{
    blockId: string;
    start: number;
    triggerLen: number;
    query: string;
    anchor: { top: number; bottom: number; left: number };
  } | null>(null);
  // Escape closes the picker but leaves the text; without this the next
  // keystroke would detect the same trigger and reopen it.
  const mentionDismissedRef = useRef<{ blockId: string; start: number } | null>(null);
  const mentionResults = useMemo(
    () => (mention ? filterMentionPages(pages, mention.query) : []),
    [mention, pages]
  );
  const mentionOpen = mention !== null && mentionResults.length > 0;

  const [showShortcuts, setShowShortcuts] = useState(false);

  const blockRefs = useRef<Record<string, HTMLElement>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ id: string, type: BType } | null>(null);
  const updaterRef = useRef<ReturnType<typeof debounceWithFlush> | null>(null);

  // A file dragged over the editor lights up a drop overlay, so the gesture
  // reads as "this will upload" instead of silently doing nothing. The depth
  // counter is needed because dragenter/dragleave also fire for every child
  // element the pointer crosses, so a plain boolean would flicker off.
  const [isFileDrag, setIsFileDrag] = useState(false);
  const fileDragDepth = useRef(0);
  // Upload failures were console-only, which made a rejected file look like a
  // dropped one that never arrived.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload bookkeeping, all keyed by block id (see UploadJob). The upload state
  // is client-only: nothing about an in-flight upload is stored in the DB.
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [uploads, setUploads] = useState<Map<string, UploadState>>(() => new Map());
  // Sizes of files uploaded in this session, so file blocks can show them
  // without asking the server for anything.
  const [uploadedSizes, setUploadedSizes] = useState<Record<string, number>>({});
  const jobsRef = useRef(new Map<string, UploadJob>());
  const previewUrlsRef = useRef(new Map<string, string>());
  const limiterRef = useRef(createLimiter(MAX_PARALLEL_UPLOADS));
  // createBlock calls still waiting for their server id, so an upload aimed at
  // such a block can wait for the real id before updating it.
  const inflightCreatesRef = useRef(new Map<string, Promise<BlockType | null>>());

  // Load initialBlocks when page changes (also on first mount).
  useEffect(() => {
    setBlocks(initialBlocks.map(b => ({
      ...b,
      parent_id: b.parent_id ?? null,
      collapsed: b.collapsed ?? false,
      props: b.props ?? {},
    })));
    // Flush pending updates from the previous page.
    updaterRef.current?.flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // Debounced updater: created once per page. Flush on unmount or unload.
  useEffect(() => {
    const u = debounceWithFlush(async (id: string, data: any) => {
      try {
        await api.blocks.update(id, data);
      } catch (e) {
        console.error('Failed to update block', e);
      }
    }, 500);
    updaterRef.current = u;
    return () => {
      u.flush();
      updaterRef.current = null;
    };
  }, [pageId]);

  // Ctrl/Cmd + / toggles the shortcuts cheat sheet. Listens on the document so
  // it works whether or not a block has focus.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(open => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Flush on tab close or page hidden.
  useEffect(() => {
    const onBeforeUnload = () => updaterRef.current?.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') updaterRef.current?.flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleContentChange = (id: string, content: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    const match = content.match(/^\/(.*)$/);
    updateMention(id, block.type, content, Boolean(match));
    if (match || content === '/') {
      const el = blockRefs.current[id];
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          visible: true,
          blockId: id,
          query: match ? match[1] : '',
          // Viewport coordinates: SlashMenu renders position: fixed in a portal.
          position: { top: rect.bottom, left: rect.left }
        });
      }
    } else {
      setSlashMenu(prev => ({ ...prev, visible: false }));
    }

    applyContent(id, content);
  };

  // Local state + debounced save for new content, without touching the menus.
  const applyContent = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    if (!id.startsWith('temp-')) {
      updaterRef.current?.debounced(id, { content });
    }
  };

  // Open, update or close the page picker based on the text before the caret.
  const updateMention = (id: string, type: BType, content: string, isSlashCommand: boolean) => {
    const el = blockRefs.current[id];
    const caret = el ? getCaretOffset(el) : null;
    // A table's content is JSON, not text the caret offset could point into.
    const m = el && caret !== null && type !== 'code' && type !== 'table' && !isSlashCommand
      ? MENTION_RE.exec(content.slice(0, caret))
      : null;
    if (!m || !el || caret === null) {
      mentionDismissedRef.current = null;
      setMention(null);
      return;
    }
    const triggerLen = m[1] ? 1 : 2;
    const query = m[3];
    const start = caret - query.length - triggerLen;
    const dismissed = mentionDismissedRef.current;
    if (dismissed && dismissed.blockId === id && dismissed.start === start) {
      setMention(null);
      return;
    }
    setMention(prev => ({
      blockId: id,
      start,
      triggerLen,
      query,
      // The menu stays where the trigger was typed while the query grows.
      anchor: prev && prev.blockId === id && prev.start === start ? prev.anchor : getCaretRect(el),
    }));
  };

  const handleMentionClose = () => {
    if (mention) mentionDismissedRef.current = { blockId: mention.blockId, start: mention.start };
    setMention(null);
  };

  // Replace "@query" / "[[query" with an inline link to the page, using the
  // regular markdown link syntax so it renders everywhere links already do.
  const handleMentionSelect = (page: Page) => {
    const m = mention;
    setMention(null);
    if (!m) return;
    const block = blocksRef.current.find(b => b.id === m.blockId);
    if (!block) return;
    const trigger = m.triggerLen === 2 ? '[[' : '@';
    // The text moved under us (paste, undo): don't guess where to insert.
    if (block.content.slice(m.start, m.start + m.triggerLen) !== trigger) return;
    const end = m.start + m.triggerLen + m.query.length;
    const link = mentionLinkMarkdown(page, t('sidebar.untitledPage'));
    applyContent(block.id, block.content.slice(0, m.start) + link + block.content.slice(end));
    focusBlock(block.id, m.start + link.length);
  };

  // Focus a block after the next render, optionally with the caret at a text
  // offset. The caret goes in a second step: focusing flips the block to
  // plain-text mode, which rewrites its DOM and would reset an earlier caret.
  const focusBlock = (id: string, caret?: number | null) => {
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (!el) return;
      el.focus();
      if (caret == null || !el.isContentEditable) return;
      requestAnimationFrame(() => {
        const target = blockRefs.current[id];
        if (target) placeCaret(target, caret);
      });
    }, 0);
  };

  const handleCheckedChange = (id: string, checked: boolean) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, checked } : b));
    if (!id.startsWith('temp-')) {
      updaterRef.current?.debounced(id, { checked });
    }
  };

  const handleLanguageChange = (id: string, language: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, language } : b));
    if (!id.startsWith('temp-')) {
      updaterRef.current?.debounced(id, { language });
    }
  };

  // Replace a block's props bag (image width / alignment / caption). The editor
  // always sends the whole object, and the server replaces rather than merges.
  const handlePropsChange = (id: string, props: BlockProps) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props } : b));
    if (!id.startsWith('temp-')) {
      // A discrete action, not typing: save it now instead of leaving it in
      // the single debounce slot, where the next keystroke in another block
      // would replace it.
      updaterRef.current?.flush();
      updaterRef.current?.debounced(id, { props });
      updaterRef.current?.flush();
    }
  };

  const handleToggleCollapse = useCallback((id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, collapsed: !b.collapsed } : b));
    const target = blocks.find(b => b.id === id);
    if (target && !id.startsWith('temp-')) {
      updaterRef.current?.debounced(id, { collapsed: !target.collapsed });
    }
  }, [blocks]);

  // Paste-to-multiple-blocks.
  // Decision:
  //   - Plain 1-line text without markdown markers → don't intervene; the
  //     browser inserts it as normal typing (onInput handles it).
  //   - Multi-line text or block-level markers (#, >, -, *, 1., fences,
  //     ---, ___, ***) → preventDefault and split with parseMarkdownToBlocks.
  //
  // Heuristic:
  //   - Has \n + at least one non-empty line, OR
  //   - Some line starts with a block-level marker (same as the parser).
  // Intentionally does NOT include `**` as a marker: pasting `**bold**` mid-
  // paragraph must stay as literal text, not trigger a split.
  //
  // Outcome:
  //   - The current block becomes the FIRST parsed block (type change applied
  //     if needed, via setBlocks + updaterRef).
  //   - If detectedTitle exists and the current block is empty → use the
  //     detected title as heading1 instead of the first parsed block.
  //   - Remaining parsed blocks are inserted AFTER the current block; their
  //     positions are distributed in the gap to the next sibling under the
  //     same parent (same idea as createBlock, but for N blocks).
  //   - Focus lands on the LAST new block, cursor at end.
  const looksLikeMarkdown = (text: string): boolean => {
    const lines = text.split('\n');
    const hasNewline = lines.length > 1;
    const hasNonEmptyLine = lines.some(l => l.trim().length > 0);
    // Block-level markers only. `**` is excluded (inline emphasis); `- `, `* `,
    // `1. ` require a trailing space so we don't accidentally match `**bold**`.
    const blockMarker = /^(#{1,3}\s|>\s|- |\* |\d+\.\s|```|---|___|\*\*\*)/m;
    return (hasNewline && hasNonEmptyLine) || blockMarker.test(text);
  };

  const handleBlockPaste = useCallback(async (
    e: React.ClipboardEvent,
    blockId: string,
    currentContent: string
  ) => {
    const text = e.clipboardData.getData('text/plain');
    // Empty paste → let the browser handle it (no-op).
    if (!text) return;

    // A lone image link pasted into an empty paragraph becomes an image block.
    const imageUrl = imageUrlFromText(text);
    if (imageUrl && currentContent === '') {
      const target = blocks.find(b => b.id === blockId);
      if (target?.type === 'paragraph' && !blocks.some(b => b.parent_id === blockId)) {
        e.preventDefault();
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, type: 'image', content: imageUrl } : b));
        if (!blockId.startsWith('temp-')) {
          updaterRef.current?.debounced(blockId, { type: 'image', content: imageUrl });
        }
        setTimeout(() => blockRefs.current[blockId]?.focus(), 0);
        return;
      }
    }
    // Plain text without markers → let the browser handle it.
    if (!looksLikeMarkdown(text)) return;

    e.preventDefault();

    const { blocks: parsed, detectedTitle } = parseMarkdownToBlocks(text, '');
    if (parsed.length === 0) return;

    const current = blocks.find(b => b.id === blockId);
    if (!current) return;

    const [first, ...rest] = parsed;

    // Decide the current block's new type/content.
    // Special case: empty block + detectedTitle → promote to heading1 with the
    // detected title (markflare-style: leading # becomes the page title).
    let newType: BType = first.type as BType;
    let newContent = first.content;
    if (currentContent === '' && detectedTitle) {
      newType = 'heading1';
      newContent = detectedTitle;
    }

    // Update the current block. If the type matches only the content changes
    // (same path as handleContentChange, but without triggering the slash
    // menu). Otherwise we update type + content together.
    if (newType === current.type) {
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: newContent } : b));
      if (!blockId.startsWith('temp-')) {
        updaterRef.current?.debounced(blockId, { content: newContent });
      }
    } else {
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, type: newType, content: newContent } : b));
      if (!blockId.startsWith('temp-')) {
        updaterRef.current?.debounced(blockId, { type: newType, content: newContent });
      }
    }

    // Only 1 parsed block → the current block already holds it all. Focus at
    // the end (the browser would have put it there after the paste).
    if (rest.length === 0) {
      setTimeout(() => {
        const el = blockRefs.current[blockId];
        if (el) {
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
      return;
    }

    // Compute positions for the new blocks: distribute evenly in the gap
    // between the current block and its next sibling under the same parent.
    // If no next sibling, use 1000 as a fictitious gap (same as createBlock
    // when appending to the end of a level).
    const parentId = current.parent_id;
    const sameParentSiblings = blocks.filter(b => b.parent_id === parentId);
    const currentIdx = sameParentSiblings.findIndex(b => b.id === blockId);
    const nextOriginalSibling = currentIdx >= 0 ? sameParentSiblings[currentIdx + 1] : null;
    const availableGap = nextOriginalSibling
      ? Math.max(1000, nextOriginalSibling.position - current.position)
      : 1000;
    const step = availableGap / (rest.length + 1);

    // Build temp blocks with positions already calculated — both API and local
    // state get the correct position, avoiding the legacy createBlock bug
    // where position started at 0.
    const tempBlocks: BlockType[] = rest.map((p, i) => {
      const newId = `temp-${crypto.randomUUID()}`;
      return {
        id: newId,
        page_id: pageId,
        type: p.type as BType,
        content: p.content,
        checked: p.checked || false,
        language: '',
        position: current.position + step * (i + 1),
        parent_id: parentId,
        collapsed: false,
        props: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Insert all in one local-state pass.
    setBlocks(prev => [...prev, ...tempBlocks].sort((a, b) => a.position - b.position));

    // Persist in parallel (faster than sequential, takes advantage of batching).
    // The temp → real-id swap follows the createBlock pattern.
    const promises = tempBlocks.map(async (tempBlock) => {
      try {
        const res = await api.blocks.create(pageId, {
          type: tempBlock.type,
          content: tempBlock.content,
          position: tempBlock.position,
          parent_id: tempBlock.parent_id,
        });
        setBlocks(prev => prev.map(b => b.id === tempBlock.id ? res.block : b));
        if (blockRefs.current[tempBlock.id]) {
          blockRefs.current[res.block.id] = blockRefs.current[tempBlock.id];
          delete blockRefs.current[tempBlock.id];
        }
        return res.block.id;
      } catch (err) {
        console.error('Failed to create block from paste', err);
        return tempBlock.id;
      }
    });

    const realIds = await Promise.all(promises);

    // Focus the last new block, cursor at end.
    const lastTempId = tempBlocks[tempBlocks.length - 1].id;
    const lastRealId = realIds[realIds.length - 1];
    setTimeout(() => {
      // Prefer the real-id (already swapped) but fall back to temp-id if the
      // swap hasn't happened yet (e.g. the API call failed).
      const el = (lastRealId && blockRefs.current[lastRealId]) || blockRefs.current[lastTempId];
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  }, [blocks, pageId]);

  const createBlock = async (
    afterId: string | null,
    type: BType = 'paragraph',
    content = '',
    parentId: string | null = null,
    language = '',
    // Explicit position; without it the block goes right after `afterId`.
    position?: number
  ) => {
    const newId = `temp-${crypto.randomUUID()}`;
    const newBlock: BlockType = {
      id: newId,
      page_id: pageId,
      type,
      content,
      checked: false,
      language,
      position: 0,
      parent_id: parentId,
      collapsed: false,
      props: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Compute the position: if parentId is set, append to the end of that
    // parent's children; otherwise append to the root level (parent_id=null).
    let newPosition = 0;
    if (position !== undefined) {
      newPosition = position;
    } else if (afterId) {
      const idx = blocks.findIndex(b => b.id === afterId);
      if (idx !== -1) {
        const siblingAfter = blocks[idx + 1];
        const prevPos = blocks[idx].position;
        const nextPos = siblingAfter && siblingAfter.parent_id === blocks[idx].parent_id
          ? siblingAfter.position
          : prevPos + 1000;
        newPosition = (prevPos + nextPos) / 2;
      } else {
        newPosition = (blocks.length) * 1000;
      }
    } else {
      const lastRoot = [...blocks].reverse().find(b => b.parent_id === parentId);
      newPosition = lastRoot ? lastRoot.position + 1000 : 0;
    }

    setBlocks(prev => [...prev, newBlock].sort((a, b) => a.position - b.position));

    setTimeout(() => {
      const el = blockRefs.current[newId];
      if (el) el.focus();
    }, 0);

    const persist = (async () => {
      const res = await api.blocks.create(pageId, { type, content, position: newPosition, parent_id: parentId, language });
      // An upload may have taken over this block while the request was in
      // flight (e.g. /image right after Enter): keep what it shows locally and
      // let its bookkeeping follow the new id.
      const hasUpload = jobsRef.current.has(newId);
      setBlocks(prev => prev.map(b => b.id === newId
        ? (hasUpload ? { ...res.block, type: b.type, content: b.content, language: b.language } : res.block)
        : b));
      if (hasUpload) rekeyUpload(newId, res.block.id);
      if (blockRefs.current[newId]) {
        blockRefs.current[res.block.id] = blockRefs.current[newId];
        delete blockRefs.current[newId];
      }
      return res.block;
    })();
    inflightCreatesRef.current.set(newId, persist.catch(() => null));
    try {
      return await persist;
    } catch (e) {
      console.error('Failed to create block', e);
      return null;
    } finally {
      inflightCreatesRef.current.delete(newId);
    }
  };

  const deleteBlock = async (
    id: string,
    direction: 'backspace' | 'menu' = 'menu',
  ) => {
    if (blocks.length <= 1) return;
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;

    // Blocks with children: remove the entire subtree.
    const toRemove = new Set<string>();
    const collect = (bid: string) => {
      toRemove.add(bid);
      for (const b of blocks) {
        if (b.parent_id === bid) collect(b.id);
      }
    };
    collect(id);

    // Pick a focus target: the previous visible block (not in toRemove),
    // or the next visible one.
    const prevVisible = (() => {
      for (let i = idx - 1; i >= 0; i--) {
        if (!toRemove.has(blocks[i].id)) return blocks[i];
      }
      return null;
    })();
    const nextVisible = (() => {
      for (let i = idx + 1; i < blocks.length; i++) {
        if (!toRemove.has(blocks[i].id)) return blocks[i];
      }
      return null;
    })();

    // A block deleted mid-upload must not come back when the upload finishes.
    for (const bid of toRemove) discardJob(bid);
    setBlocks(prev => prev.filter(b => !toRemove.has(b.id)));

    setTimeout(() => {
      // Focus direction:
      //   - 'backspace': the user is deleting "backwards", so focus goes to
      //     the NEXT visible block with the cursor at the START. If no next,
      //     fall back to the previous with cursor at the end.
      //   - 'menu' (default): deleted from the context menu — preserve the
      //     previous visible block with the cursor at the end; fall back to
      //     the next one.
      let target: BlockType | null = null;
      let collapseToStart = false;
      if (direction === 'backspace') {
        target = nextVisible ?? prevVisible;
        collapseToStart = target === nextVisible;
      } else {
        target = prevVisible ?? nextVisible;
        collapseToStart = false;
      }
      if (target && blockRefs.current[target.id]) {
        const el = blockRefs.current[target.id];
        el.focus();
        if (typeof window !== 'undefined' && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(collapseToStart);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }, 0);

    // Delete in backend: only persisted blocks.
    for (const bid of toRemove) {
      if (!bid.startsWith('temp-')) {
        try {
          await api.blocks.delete(bid);
        } catch (e) {
          console.error('Failed to delete block', e);
        }
      }
    }
  };

  // Transform a block's type (e.g. paragraph → heading1) preserving its
  // content. Triggered from the block's context menu. Divider gets empty
  // content (a divider with text doesn't make sense). If the block is already
  // the target type, this is a no-op.
  const handleTransform = async (id: string, newType: BType) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    if (block.type === newType) return;

    // Divider gets empty content; everything else preserves it
    // (e.g. heading1 → bullet_list keeps the text).
    const newContent = newType === 'divider' ? '' : block.content;

    // Optimistic update: local state first, then backend. If the request
    // fails the user still sees the local change; we log for debugging.
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: newType, content: newContent } : b));

    if (!id.startsWith('temp-')) {
      try {
        await api.blocks.update(id, { type: newType, content: newContent });
      } catch (e) {
        console.error('Failed to transform block', e);
      }
    }
  };

  // Save a change right away instead of through the debounced updater. That one
  // only remembers its last call, so a position change would replace a pending
  // content edit and lose it.
  const persistNow = (id: string, data: Parameters<typeof api.blocks.update>[1]) => {
    const send = (realId: string) =>
      api.blocks.update(realId, data).catch(e => console.error('Failed to update block', e));
    if (!id.startsWith('temp-')) {
      updaterRef.current?.flush();
      void send(id);
    } else {
      // Still being created: apply the change once the server id is known.
      void inflightCreatesRef.current.get(id)?.then(real => (real ? send(real.id) : undefined));
    }
  };

  // Move a block (with its subtree) one slot among its siblings.
  const moveBlock = (id: string, dir: -1 | 1) => {
    const list = blocksRef.current;
    const block = list.find(b => b.id === id);
    if (!block) return;
    const siblings = sortedChildren(list, block.parent_id);
    const from = siblings.findIndex(b => b.id === id);
    const to = from + dir;
    if (to < 0 || to >= siblings.length) return;

    const el = blockRefs.current[id];
    const caret = el ? getCaretOffset(el) : null;

    // The new slot sits between the swap target and the sibling beyond it.
    const target = siblings[to];
    const beyond = siblings[to + dir];
    const newPosition = dir < 0
      ? positionBetween(beyond?.position, target.position)
      : positionBetween(target.position, beyond?.position);

    if (newPosition !== target.position && newPosition !== beyond?.position) {
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, position: newPosition } : b));
      persistNow(id, { position: newPosition });
    } else {
      // Neighbours share a position, so there is no room between them:
      // renumber the whole level instead.
      const order = siblings.filter(b => b.id !== id);
      order.splice(to, 0, block);
      const renumbered = new Map(order.map((b, i) => [b.id, (i + 1) * 1000]));
      setBlocks(prev => prev.map(b => renumbered.has(b.id) ? { ...b, position: renumbered.get(b.id)! } : b));
      const saved = order
        .filter(b => !b.id.startsWith('temp-'))
        .map(b => ({ id: b.id, position: renumbered.get(b.id)! }));
      updaterRef.current?.flush();
      api.blocks.reorder(saved).catch(e => console.error('Failed to reorder blocks', e));
    }
    // Reordering moves the DOM node, which drops focus.
    focusBlock(id, caret);
  };

  // Duplicate a block and its descendants right after it. The copy appears
  // at once under temp ids; the server rows are created parent-first so each
  // child can point at its parent's real id.
  const duplicateBlock = (id: string) => {
    const list = blocksRef.current;
    const source = list.find(b => b.id === id);
    if (!source) return;
    // Pruned with their subtree: subpages (a second block pointing at the same
    // page) and blocks whose file is still uploading (no content yet).
    const tree = collectSubtree(list, id, b => b.type === 'subpage' || jobsRef.current.has(b.id));
    if (tree.length === 0) return;

    const idMap = new Map(tree.map(({ block }) => [block.id, `temp-${crypto.randomUUID()}`]));
    const siblings = sortedChildren(list, source.parent_id);
    const next = siblings[siblings.findIndex(b => b.id === id) + 1];
    const rootPosition = positionBetween(source.position, next?.position);
    const now = new Date().toISOString();
    const copies: BlockType[] = tree.map(({ block, depth }) => ({
      ...block,
      id: idMap.get(block.id)!,
      parent_id: depth === 0 ? source.parent_id : idMap.get(block.parent_id!)!,
      position: depth === 0 ? rootPosition : block.position,
      created_at: now,
      updated_at: now,
    }));
    setBlocks(prev => [...prev, ...copies].sort((a, b) => a.position - b.position));
    focusBlock(copies[0].id, Number.MAX_SAFE_INTEGER);

    // Copy id -> its pending server row. Pre-order guarantees a parent is
    // registered before its children look it up.
    const created = new Map<string, Promise<BlockType | null>>();
    for (const copy of copies) {
      const run = async (): Promise<BlockType | null> => {
        try {
          let parentId: string | null = copy.parent_id;
          if (parentId !== null && created.has(parentId)) {
            const parent = await created.get(parentId)!;
            if (!parent) throw new Error('Parent copy was not saved');
            parentId = parent.id;
          } else if (parentId !== null && parentId.startsWith('temp-')) {
            // The source's own parent is still being created.
            const parent = await inflightCreatesRef.current.get(parentId);
            if (!parent) throw new Error('Parent block was not saved');
            parentId = parent.id;
          }
          const res = await api.blocks.create(pageId, {
            type: copy.type,
            content: copy.content,
            position: copy.position,
            parent_id: parentId,
            language: copy.language,
            props: copy.props,
          });
          let saved = res.block;
          // create() doesn't take these two.
          if (copy.checked || copy.collapsed) {
            saved = (await api.blocks.update(saved.id, { checked: copy.checked, collapsed: copy.collapsed })).block;
          }
          const hadFocus = document.activeElement === blockRefs.current[copy.id];
          // Children still in the list point at the temp id; follow the swap.
          setBlocks(prev => prev.map(b => b.id === copy.id
            ? saved
            : b.parent_id === copy.id ? { ...b, parent_id: saved.id } : b));
          if (blockRefs.current[copy.id]) {
            blockRefs.current[saved.id] = blockRefs.current[copy.id];
            delete blockRefs.current[copy.id];
          }
          if (hadFocus) focusBlock(saved.id, Number.MAX_SAFE_INTEGER);
          return saved;
        } catch (e) {
          console.error('Failed to duplicate block', e);
          setBlocks(prev => prev.filter(b => b.id !== copy.id));
          return null;
        }
      };
      const promise = run();
      created.set(copy.id, promise);
      inflightCreatesRef.current.set(copy.id, promise);
      void promise.finally(() => inflightCreatesRef.current.delete(copy.id));
    }
  };

  const handleKeyDown = (id: string, e: React.KeyboardEvent) => {
    // defaultPrevented: a menu already used this key (Enter/Tab) and its state
    // update may have landed before this handler runs.
    if (slashMenu.visible || mentionOpen || e.defaultPrevented) return;

    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'd') {
      // Also keeps the browser from bookmarking the page.
      e.preventDefault();
      duplicateBlock(id);
      return;
    }
    if (mod && e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveBlock(id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    const turnInto = turnIntoShortcut(e);
    if (turnInto) {
      e.preventDefault();
      const current = blocks[idx];
      if (!NOT_TURNABLE.includes(current.type) && current.type !== turnInto) {
        const el = blockRefs.current[id];
        const caret = el ? getCaretOffset(el) : null;
        handleTransform(id, turnInto);
        // Some types wrap the text in another element, which drops focus.
        focusBlock(id, caret);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // El nuevo bloque hereda el parent_id del actual. Si el padre del actual
      // está collapsed, lo expandemos automáticamente para que el usuario vea
      // el bloque que acaba de crear (markflare hace lo mismo).
      const current = blocks[idx];
      createBlock(id, 'paragraph', '', current.parent_id);
      if (current.parent_id) {
        const parent = blocks.find(b => b.id === current.parent_id);
        if (parent && parent.collapsed) {
          setBlocks(prev => prev.map(b => b.id === parent.id ? { ...b, collapsed: false } : b));
          if (!parent.id.startsWith('temp-')) {
            updaterRef.current?.debounced(parent.id, { collapsed: false });
          }
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const current = blocks[idx];
      if (e.shiftKey) {
        // Shift+Tab: dedent. Already at root level → no-op.
        const { newParentId, newPrev } = dedentTarget(blocks, id);
        if (newPrev) {
          setBlocks(prev => prev.map(b => b.id === id ? { ...b, parent_id: newParentId } : b));
          // Reposition: just after newPrev on its level.
          const newPosition = (newPrev.position) + 500;
          setBlocks(prev => prev.map(b => b.id === id ? { ...b, position: newPosition } : b));
          if (!id.startsWith('temp-')) {
            updaterRef.current?.debounced(id, { parent_id: newParentId, position: newPosition });
          }
        }
      } else {
        // Tab: indent under the previous block.
        const newParentId = indentTarget(blocks, id);
        if (newParentId) {
          setBlocks(prev => prev.map(b => b.id === id ? { ...b, parent_id: newParentId } : b));
          // Position at the end of the new parent's children.
          const siblings = blocks.filter(b => b.parent_id === newParentId);
          const newPosition = (siblings.length > 0 ? Math.max(...siblings.map(s => s.position)) : 0) + 1000;
          setBlocks(prev => prev.map(b => b.id === id ? { ...b, position: newPosition } : b));
          // Auto-expand the parent if it's collapsed so the user sees the
          // newly nested block.
          setBlocks(prev => prev.map(b => b.id === newParentId ? { ...b, collapsed: false } : b));
          if (!id.startsWith('temp-')) {
            updaterRef.current?.debounced(id, { parent_id: newParentId, position: newPosition });
          }
          const parent = blocks.find(b => b.id === newParentId);
          if (parent && parent.collapsed) {
            updaterRef.current?.debounced(newParentId, { collapsed: false });
          }
        }
      }
      return;
    }

    if (e.key === 'Backspace') {
      const block = blocks[idx];
      // subpage blocks are intentionally non-deletable inline: the reference
      // only goes away when the referenced page is deleted from the sidebar.
      // divider/image/file still get the default non-editable treatment.
      const nonEditable = ['divider', 'image', 'file'].includes(block.type);
      const isSubpage = block.type === 'subpage';
      if (isSubpage) {
        e.preventDefault();
        return;
      }
      if (nonEditable || block.content === '') {
        e.preventDefault();
        deleteBlock(id, 'backspace');
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      const el = blockRefs.current[id];
      const sel = window.getSelection();
      if (sel && sel.focusOffset === 0 && idx > 0) {
        e.preventDefault();
        blockRefs.current[blocks[idx - 1].id]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      const el = blockRefs.current[id];
      const sel = window.getSelection();
      if (sel && sel.focusOffset === el.textContent?.length && idx < blocks.length - 1) {
        e.preventDefault();
        blockRefs.current[blocks[idx + 1].id]?.focus();
      }
      return;
    }
  };

  // Uploads.
  // Notion-like flow: the block appears immediately with the local file as a
  // preview and a progress strip, then turns into the stored file once the
  // transfer and the block save are done. Placeholders are created in order
  // first and uploaded afterwards, at most MAX_PARALLEL_UPLOADS at a time.

  const patchUpload = (id: string, patch: Partial<UploadState>) =>
    setUploads(prev => {
      const cur = prev.get(id);
      if (!cur) return prev;
      return new Map(prev).set(id, { ...cur, ...patch });
    });

  // Forget an upload's display state and free its local preview.
  const dropUpload = (id: string) => {
    const url = previewUrlsRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(id);
    setUploads(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // A block's id changes when its temp id is swapped for the server's; move
  // everything keyed by the old one.
  const rekeyUpload = (oldId: string, newId: string) => {
    const job = jobsRef.current.get(oldId);
    if (job) {
      jobsRef.current.delete(oldId);
      job.blockId = newId;
      jobsRef.current.set(newId, job);
    }
    const url = previewUrlsRef.current.get(oldId);
    if (url) {
      previewUrlsRef.current.delete(oldId);
      previewUrlsRef.current.set(newId, url);
    }
    setUploads(prev => {
      const cur = prev.get(oldId);
      if (!cur) return prev;
      const next = new Map(prev);
      next.delete(oldId);
      next.set(newId, cur);
      return next;
    });
  };

  // Abort an upload and forget it, without touching the block itself.
  const discardJob = (id: string): UploadJob | undefined => {
    const job = jobsRef.current.get(id);
    if (job) {
      job.controller.abort();
      jobsRef.current.delete(id);
    }
    dropUpload(id);
    return job;
  };

  // Leaving the page cancels what is still in flight: placeholders only exist
  // locally, and the preview object URLs have to be released.
  useEffect(() => {
    return () => {
      for (const job of jobsRef.current.values()) job.controller.abort();
      jobsRef.current.clear();
      for (const url of previewUrlsRef.current.values()) URL.revokeObjectURL(url);
      previewUrlsRef.current.clear();
      setUploads(new Map());
    };
  }, [pageId]);

  const startJob = (
    block: BlockType,
    file: File,
    kind: 'image' | 'file',
    revert: UploadJob['revert'],
    persisted: boolean
  ) => {
    const previewUrl = kind === 'image' ? URL.createObjectURL(file) : null;
    jobsRef.current.set(block.id, {
      blockId: block.id,
      file,
      kind,
      controller: new AbortController(),
      revert,
      persisted,
      uploaded: null,
    });
    if (previewUrl) previewUrlsRef.current.set(block.id, previewUrl);
    setUploads(prev => new Map(prev).set(block.id, {
      status: 'queued',
      progress: 0,
      previewUrl,
      fileName: file.name,
      fileSize: file.size,
    }));
  };

  // Turn a block that already exists (empty paragraph, "/image" command text,
  // empty image) into the upload target. Only the local copy changes now; the
  // server row is updated when the upload completes.
  const adoptBlockForUpload = (block: BlockType, file: File, kind: 'image' | 'file') => {
    startJob(block, file, kind, { type: block.type, content: block.content, language: block.language }, true);
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, type: kind, content: '', language: file.name } : b));
  };

  const uploadErrorMessage = (err: unknown, name: string) =>
    err instanceof ApiError && err.status > 0 && err.message
      ? err.message
      : t('editor.uploadFailed', { name });

  // Store the finished upload in the block.
  const commitUpload = async (job: UploadJob, uploaded: FileInfo) => {
    const content = uploaded.id;
    // The stored name doubles as the image's alt text and the file block's label.
    const language = uploaded.name;
    // A pending debounced edit of the same block would otherwise land after
    // this update and overwrite it.
    updaterRef.current?.flush();

    const oldId = job.blockId;
    let created: BlockType | null = null;
    if (!job.persisted) {
      const placeholder = blocksRef.current.find(b => b.id === oldId);
      if (!placeholder) return;
      const res = await api.blocks.create(pageId, {
        type: job.kind,
        content,
        position: placeholder.position,
        parent_id: placeholder.parent_id,
        language,
      });
      if (job.controller.signal.aborted) {
        // Cancelled while the block was being saved.
        api.blocks.delete(res.block.id).catch(() => {});
        return;
      }
      created = res.block;
    } else {
      // A block made with Enter may still be waiting for its server id; when
      // the create finishes it moves this job to the real id.
      const pending = inflightCreatesRef.current.get(oldId);
      if (pending) await pending;
      if (job.blockId.startsWith('temp-')) throw new Error('Block was not saved');
      await api.blocks.update(job.blockId, { type: job.kind, content, language });
    }

    jobsRef.current.delete(job.blockId);
    setUploadedSizes(prev => ({ ...prev, [uploaded.id]: uploaded.size }));

    const hadFocus = document.activeElement === blockRefs.current[job.blockId];
    let finalId = job.blockId;
    if (created) {
      const swapped = created;
      finalId = swapped.id;
      setBlocks(prev => prev.map(b => b.id === oldId ? swapped : b));
      if (blockRefs.current[oldId]) {
        blockRefs.current[swapped.id] = blockRefs.current[oldId];
        delete blockRefs.current[oldId];
      }
      rekeyUpload(oldId, swapped.id);
    } else {
      setBlocks(prev => prev.map(b => b.id === finalId ? { ...b, type: job.kind, content, language } : b));
    }

    // Images keep showing the local preview until the stored copy has loaded
    // (ImageBlock reports back through onUploadSettled); everything else is done.
    if (previewUrlsRef.current.has(finalId)) patchUpload(finalId, { status: 'done', progress: 1 });
    else dropUpload(finalId);

    // The block is remounted when its id changes, which drops keyboard focus.
    if (hadFocus) setTimeout(() => blockRefs.current[finalId]?.focus(), 0);
  };

  const runUpload = (id: string) => {
    const job = jobsRef.current.get(id);
    if (!job) return;
    const { signal } = job.controller;
    void limiterRef.current(async () => {
      // Cancelled while waiting for a free slot.
      if (signal.aborted) return;
      try {
        if (!job.uploaded) {
          patchUpload(job.blockId, { status: 'uploading', progress: 0, error: undefined });
          const toSend = job.kind === 'image' ? await optimizeImage(job.file) : job.file;
          if (signal.aborted) return;
          const res = await api.files.uploadWithProgress(
            toSend,
            pageId,
            (fraction) => patchUpload(job.blockId, { progress: fraction }),
            signal
          );
          job.uploaded = res.file;
        }
        patchUpload(job.blockId, { status: 'uploading', progress: 1 });
        await commitUpload(job, job.uploaded);
      } catch (err) {
        if (signal.aborted) return;
        console.error('Upload failed', err);
        patchUpload(job.blockId, { status: 'error', error: uploadErrorMessage(err, job.file.name) });
      }
    });
  };

  const handleCancelUpload = (id: string) => {
    const job = discardJob(id);
    if (!job) return;
    if (job.revert) {
      const previous = job.revert;
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...previous } : b));
    } else {
      setBlocks(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleRetryUpload = (id: string) => {
    if (!jobsRef.current.has(id)) return;
    patchUpload(id, { status: 'queued', progress: 0, error: undefined });
    runUpload(id);
  };

  // Empty image placeholder clicked: reuse the slash-menu flow (remember the
  // target block, open the hidden file input).
  const handlePickFile = (id: string) => {
    pendingUploadRef.current = { id, type: 'image' };
    fileInputRef.current?.click();
  };

  // Id of the block holding keyboard focus, if any.
  const focusedBlockId = (): string | null => {
    const active = document.activeElement as HTMLElement | null;
    const id = active?.closest('[data-block-id]')?.getAttribute('data-block-id');
    return id && blocksRef.current.some(b => b.id === id) ? id : null;
  };

  // Insert one block per file, in order, each right after the previous one.
  // Shared by the three entry points (drop on a block, drop on the editor,
  // paste) so they can't drift apart. `anchorId` is the block the chain starts
  // after (null appends at the end of the document). With `replaceAnchor` the
  // first file fills the anchor block itself instead of going below it.
  const insertFiles = (files: File[], anchorId: string | null, replaceAnchor = false) => {
    const tooLarge = files.filter(f => f.size > MAX_UPLOAD_BYTES);
    const queue = files.filter(f => f.size <= MAX_UPLOAD_BYTES);
    if (tooLarge.length > 0) {
      setUploadError(t('editor.fileTooLarge', { name: tooLarge.map(f => f.name).join(', '), max: MAX_UPLOAD_MB }));
    }
    if (queue.length === 0) return;

    const list = blocksRef.current;
    const anchor = (anchorId ? list.find(b => b.id === anchorId) : undefined) ?? null;
    const kindOf = (f: File): 'image' | 'file' => (f.type.startsWith('image/') ? 'image' : 'file');
    const startedIds: string[] = [];

    if (anchor && replaceAnchor) {
      const first = queue.shift()!;
      adoptBlockForUpload(anchor, first, kindOf(first));
      startedIds.push(anchor.id);
    }

    if (queue.length > 0) {
      // New blocks are siblings of the anchor. Their positions are spread
      // evenly in the gap before the anchor's next sibling (or 1000 apart when
      // it is the last one), so the whole batch keeps its order.
      const parentId = anchor ? anchor.parent_id : null;
      const siblings = list
        .filter(b => b.parent_id === parentId)
        .sort((a, b) => a.position - b.position);
      let prevPos: number;
      let nextPos: number;
      if (anchor) {
        prevPos = anchor.position;
        const next = siblings[siblings.findIndex(b => b.id === anchor.id) + 1];
        nextPos = next ? next.position : prevPos + 1000 * (queue.length + 1);
      } else {
        const last = siblings[siblings.length - 1];
        prevPos = last ? last.position : -1000;
        nextPos = prevPos + 1000 * (queue.length + 1);
      }
      const step = (nextPos - prevPos) / (queue.length + 1);
      const now = new Date().toISOString();
      const placeholders = queue.map((file, i): BlockType => ({
        id: `temp-${crypto.randomUUID()}`,
        page_id: pageId,
        type: kindOf(file),
        content: '',
        checked: false,
        language: file.name,
        position: prevPos + step * (i + 1),
        parent_id: parentId,
        collapsed: false,
        props: {},
        created_at: now,
        updated_at: now,
      }));
      placeholders.forEach((p, i) => startJob(p, queue[i], kindOf(queue[i]), null, false));
      setBlocks(prev => [...prev, ...placeholders].sort((a, b) => a.position - b.position));
      startedIds.push(...placeholders.map(p => p.id));
    }

    startedIds.forEach(runUpload);
    const lastId = startedIds[startedIds.length - 1];
    setTimeout(() => blockRefs.current[lastId]?.focus(), 0);
  };

  // Insert an image block that points at a web URL, right after `anchorId`
  // (null appends at the end of the document). Same placement as insertFiles.
  const insertImageUrl = (url: string, anchorId: string | null) => {
    const list = blocksRef.current;
    const anchor = (anchorId ? list.find(b => b.id === anchorId) : undefined) ?? null;
    const parentId = anchor ? anchor.parent_id : null;
    const siblings = sortedChildren(list, parentId);
    const next = anchor ? siblings[siblings.findIndex(b => b.id === anchor.id) + 1] : undefined;
    const prevPosition = anchor ? anchor.position : siblings[siblings.length - 1]?.position;
    void createBlock(anchor ? anchor.id : null, 'image', url, parentId, '', positionBetween(prevPosition, next?.position));
  };

  const handleSlashSelect = async (type: BType) => {
    if (!slashMenu.blockId) return;
    const id = slashMenu.blockId;

    if (type === 'image' || type === 'file') {
      pendingUploadRef.current = { id, type };
      if (fileInputRef.current) fileInputRef.current.click();
      setSlashMenu(prev => ({ ...prev, visible: false }));
      return;
    }

    if (type === 'subpage') {
      setSlashMenu(prev => ({ ...prev, visible: false }));
      try {
        const newPage = await createPage(pageId);
        await refreshPages();
        const newContent = newPage.id;
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'subpage', content: newContent } : b));
        if (!id.startsWith('temp-')) {
          updaterRef.current?.debounced(id, { type: 'subpage', content: newContent });
        }
      } catch (e) {
        console.error('Failed to create subpage block', e);
      }
      return;
    }

    if (type === 'table') {
      const defaultTable = {
        columns: ['Column 1', 'Column 2', 'Column 3'],
        rows: [['', '', ''], ['', '', ''], ['', '', '']],
      };
      const newContent = JSON.stringify(defaultTable);
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'table', content: newContent } : b));
      if (!id.startsWith('temp-')) {
        updaterRef.current?.debounced(id, { type: 'table', content: newContent });
      }
      setSlashMenu(prev => ({ ...prev, visible: false }));
      return;
    }

    if (type === 'toggle') {
      // markflare model: creating a toggle = parent (paragraph with chevron) +
      // empty child. Cursor lands on the child so the user can type right away.
      setSlashMenu(prev => ({ ...prev, visible: false }));
      // 1. Convert the current block into the toggle "parent". We persist
      //    'paragraph' (no dedicated 'toggle' type in the backend); rendering
      //    treats both the same.
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'paragraph', content: '' } : b));
      if (!id.startsWith('temp-')) {
        updaterRef.current?.debounced(id, { type: 'paragraph', content: '' });
      }
      // 2. Create the empty child with parent_id pointing at the parent.
      await createBlock(id, 'paragraph', '', id);
      return;
    }

    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type, content: '' } : b));
    if (!id.startsWith('temp-')) {
      updaterRef.current?.debounced(id, { type, content: '' });
    }

    setSlashMenu(prev => ({ ...prev, visible: false }));

    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) el.focus();
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingUploadRef.current;
    pendingUploadRef.current = null;
    // Reset so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file || !pending) return;

    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t('editor.fileTooLarge', { name: file.name, max: MAX_UPLOAD_MB }));
      return;
    }
    const block = blocksRef.current.find(b => b.id === pending.id);
    if (!block) return;

    // /image with a non-image file still works, as a file block.
    const kind = pending.type === 'image' && file.type.startsWith('image/') ? 'image' : 'file';
    adoptBlockForUpload(block, file, kind);
    runUpload(block.id);
    setTimeout(() => blockRefs.current[block.id]?.focus(), 0);
  };

  // Drag & drop.
  // The drag source id lives in a ref so dragging doesn't trigger re-renders.
  // The drop indicator (top/middle/bottom) lives in state because CSS classes
  // paint it.
  const draggingIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'top' | 'middle' | 'bottom' } | null>(null);

  // Compute drop zone based on cursor Y relative to the target block.
  // First 25% = top, last 25% = bottom, rest = middle.
  const computeDropPosition = useCallback((targetId: string, clientY: number): 'top' | 'middle' | 'bottom' => {
    const el = document.getElementById(`block-${targetId}`) || blockRefs.current[targetId];
    if (!el) return 'bottom';
    const rect = el.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    if (ratio < 0.25) return 'top';
    if (ratio > 0.75) return 'bottom';
    return 'middle';
  }, []);

  // Compute the new (parentId, position) for the source block, given the
  // target block and the drop zone. Single source of truth used by both the
  // local-state update and the backend persistence.
  const computeDrop = useCallback((
    list: BlockType[],
    sourceId: string,
    targetId: string,
    pos: 'top' | 'middle' | 'bottom'
  ): { newParentId: string | null; newPosition: number } | null => {
    const source = list.find(b => b.id === sourceId);
    const target = list.find(b => b.id === targetId);
    if (!source || !target) return null;
    if (pos === 'middle' && isDescendantOf(list, targetId, sourceId)) return null;

    const newParentId = pos === 'middle' ? targetId : target.parent_id;
    // Siblings at the destination level in position order, without the source
    // (it is about to leave its old slot). Positions are floats, so midpoints
    // never collide.
    const siblings = sortedChildren(list, newParentId).filter(b => b.id !== sourceId);
    const targetIdx = siblings.findIndex(b => b.id === targetId);
    let newPosition: number;
    if (pos === 'top') {
      const before = targetIdx > 0 ? siblings[targetIdx - 1] : undefined;
      newPosition = positionBetween(before?.position, target.position);
    } else if (pos === 'bottom') {
      const after = targetIdx >= 0 && targetIdx < siblings.length - 1 ? siblings[targetIdx + 1] : undefined;
      newPosition = positionBetween(target.position, after?.position);
    } else {
      // Middle: nest as the last child of the target.
      const kids = sortedChildren(list, targetId).filter(b => b.id !== sourceId);
      newPosition = positionBetween(kids.length > 0 ? kids[kids.length - 1].position : undefined, undefined);
    }
    return { newParentId, newPosition };
  }, []);

  const handleBlockDragStart = useCallback((id: string, e: React.DragEvent) => {
    draggingIdRef.current = id;
    // dataTransfer is required in Firefox for drop to fire.
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }, []);

  const handleBlockDragEnd = useCallback((_id: string) => {
    draggingIdRef.current = null;
    setDropTarget(null);
  }, []);

  const handleBlockDragOver = useCallback((id: string, e: React.DragEvent) => {
    if (!draggingIdRef.current || draggingIdRef.current === id) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    const pos = computeDropPosition(id, e.clientY);
    setDropTarget(prev => (prev?.id === id && prev.position === pos) ? prev : { id, position: pos });
  }, [computeDropPosition]);

  const handleBlockDragLeave = useCallback((_id: string) => {
    // We don't clear dropTarget here: when moving between blocks the leave
    // fires before the next over, which would leave a frame without an
    // indicator. The next block's over immediately overwrites it. We only
    // clear on dragEnd.
  }, []);

  const endFileDrag = useCallback(() => {
    fileDragDepth.current = 0;
    setIsFileDrag(false);
  }, []);

  // Only external file drags get the overlay. Dragging one of our own blocks
  // keeps the existing line indicator, and mixing the two reads as noise.
  const handleEditorDragEnter = useCallback((e: React.DragEvent) => {
    if (draggingIdRef.current) return;
    if (!e.dataTransfer?.types?.includes('Files')) return;
    fileDragDepth.current += 1;
    setIsFileDrag(true);
  }, []);

  const handleEditorDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
    if (fileDragDepth.current === 0) setIsFileDrag(false);
  }, []);

  // Apply the drop: recalculate parent_id + position of the dragged block.
  // Rules:
  //   - top:    same parent as target, position just before.
  //   - bottom: same parent as target, position just after.
  //   - middle: target becomes the new parent (nesting).
  const handleBlockDrop = useCallback(async (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      endFileDrag();
      setUploadError(null);
      insertFiles(Array.from(e.dataTransfer.files), targetId);
      return;
    }

    // An image dragged from another page or tab arrives as a URL, not a file.
    // Our own block drags carry no URL and are handled below.
    if (!draggingIdRef.current) {
      const url = imageUrlFromDrop(e.dataTransfer);
      if (url) {
        insertImageUrl(url, targetId);
        return;
      }
    }

    const sourceId = draggingIdRef.current || e.dataTransfer?.getData('text/plain') || null;
    draggingIdRef.current = null;
    setDropTarget(null);
    if (!sourceId || sourceId === targetId) return;

    const pos = computeDropPosition(targetId, e.clientY);
    const computed = computeDrop(blocks, sourceId, targetId, pos);
    if (!computed) return;

    setBlocks(prev => {
      const target = prev.find(b => b.id === targetId)!;
      let next = prev.map(b => b.id === sourceId ? { ...b, parent_id: computed.newParentId, position: computed.newPosition } : b);
      // If the parent changed (we nested), auto-expand the target so the user
      // sees where the block landed.
      if (pos === 'middle' && target.collapsed) {
        next = next.map(b => b.id === targetId ? { ...b, collapsed: false } : b);
      }
      return next;
    });

    // Persist: one update per source (parent + position), plus the target's
    // collapsed reset if we nested into it.
    const sourceBlock = blocks.find(b => b.id === sourceId);
    if (sourceBlock && !sourceBlock.id.startsWith('temp-')) {
      updaterRef.current?.debounced(sourceId, { parent_id: computed.newParentId, position: computed.newPosition });
      const target = blocks.find(b => b.id === targetId);
      if (pos === 'middle' && target?.collapsed) {
        updaterRef.current?.debounced(targetId, { collapsed: false });
      }
    }
  }, [blocks, computeDrop, computeDropPosition, insertFiles, insertImageUrl, endFileDrag]);

  const handleEditorDrop = (e: React.DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      endFileDrag();
      setUploadError(null);
      // Dropped on empty space: append at the end of the document.
      insertFiles(Array.from(e.dataTransfer.files), null);
      return;
    }
    if (draggingIdRef.current) return;
    const url = imageUrlFromDrop(e.dataTransfer);
    if (url) {
      e.preventDefault();
      e.stopPropagation();
      insertImageUrl(url, null);
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files);
      const hasFiles = files.some(f => f.type.startsWith('image/') || f.size > 0);
      if (hasFiles) {
        e.preventDefault();
        setUploadError(null);
        const focusedId = focusedBlockId();
        const focused = focusedId ? blocks.find(b => b.id === focusedId) : undefined;
        if (focused) {
          // Like Notion: pasting into an empty paragraph fills it; any other
          // block gets the media right after it.
          const isEmptySlot = focused.type === 'paragraph'
            && focused.content === ''
            && !blocks.some(b => b.parent_id === focused.id);
          insertFiles(files, focused.id, isEmptySlot);
        } else {
          insertFiles(files, null);
        }
      }
    }
  };

  // Flat render: every block in tree order with its depth and "has children" flag.
  // CSS indents using block-wrapper--depth-N.
  const flatRender = useMemo(
    () => flattenForRender(blocks, { hiddenAncestors: new Set() }),
    [blocks]
  );

  return (
    <div
      className={`block-editor ${isFileDrag ? 'block-editor--file-drag' : ''}`}
      onDrop={handleEditorDrop}
      onDragEnter={handleEditorDragEnter}
      onDragLeave={handleEditorDragLeave}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files') || draggingIdRef.current || hasWebImageTypes(e.dataTransfer)) {
          e.preventDefault();
        }
      }}
      onPaste={handleEditorPaste}
    >
      {isFileDrag && (
        <div className="block-editor-drop-hint" aria-hidden="true">
          <UploadIcon />
          <span>{t('editor.dropRelease')}</span>
        </div>
      )}
      {uploadError && (
        <div className="block-editor-upload-error" role="alert">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} aria-label={t('editor.dismissError')}>
            <XIcon />
          </button>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {blocks.length === 0 && (
        <button className="add-block-btn" onClick={() => createBlock(null)}>
          + Start writing...
        </button>
      )}
      {flatRender.map(({ block, depth, hasChildren }) => (
        <Block
          key={block.id}
          block={block}
          depth={depth}
          hasChildren={hasChildren}
          onToggleCollapse={handleToggleCollapse}
          onDragStart={handleBlockDragStart}
          onDragEnd={handleBlockDragEnd}
          onDragOver={handleBlockDragOver}
          onDragLeave={handleBlockDragLeave}
          onDrop={handleBlockDrop}
          dropIndicator={dropTarget?.id === block.id ? dropTarget.position : null}
          isOnly={blocks.length === 1}
          onContentChange={handleContentChange}
          onCheckedChange={handleCheckedChange}
          onLanguageChange={handleLanguageChange}
          onPropsChange={handlePropsChange}
          onKeyDown={handleKeyDown}
          onDelete={deleteBlock}
          onTransform={handleTransform}
          onDuplicate={duplicateBlock}
          onPaste={handleBlockPaste}
          upload={uploads.get(block.id)}
          fileSize={block.type === 'file' ? uploadedSizes[block.content] : undefined}
          onPickFile={handlePickFile}
          onCancelUpload={handleCancelUpload}
          onRetryUpload={handleRetryUpload}
          onUploadSettled={dropUpload}
          blockRef={el => {
            if (el) blockRefs.current[block.id] = el;
            else delete blockRefs.current[block.id];
          }}
        />
      ))}
      {blocks.length > 0 && (
        <button className="add-block-btn" onClick={() => createBlock(blocks[blocks.length - 1].id)}>
          + Type something or press / for commands
        </button>
      )}

      {mentionOpen && mention && (
        <MentionMenu
          anchor={mention.anchor}
          results={mentionResults}
          onSelect={handleMentionSelect}
          onClose={handleMentionClose}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {slashMenu.visible && (
        <SlashMenu
          position={slashMenu.position}
          query={slashMenu.query}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(prev => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}
