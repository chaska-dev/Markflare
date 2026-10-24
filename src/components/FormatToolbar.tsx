import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CodeIcon, LinkIcon } from './Icons';
import { ColorMenu } from './ColorMenu';
import { IS_MAC } from './ShortcutsModal';
import { useLanguage } from '../i18n/LanguageContext';
import { isColorable } from '../utils/blockColor';
import type { InlineFormat } from '../utils/inlineFormat';
import type { BlockType } from '../types';

// Floating toolbar over a text selection inside one block (Notion-style). It
// only reads the DOM selection and reports what was pressed; the editor does
// the actual edits, the same ones the keyboard shortcuts use.

interface Props {
  onFormat: (blockId: string, format: InlineFormat) => void;
  onLink: (blockId: string) => void;
  onColor: (blockId: string, color: string) => void;
  // Current color of a block, to mark it in the color menu.
  getColor: (blockId: string) => string | undefined;
}

interface Target {
  blockId: string;
  type: BlockType;
  // Viewport rect of the selection.
  rect: { top: number; bottom: number; left: number; width: number };
}

// Blocks whose text is not inline markdown, so the toolbar does not apply.
const NO_TOOLBAR: string[] = ['code', 'table', 'math'];

const GAP = 8;
const MARGIN = 8;

// The text block the selection sits in, or null when it spans several blocks,
// is empty, or is in a block the toolbar does not support.
function readTarget(): Target | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) return null;
  if (!sel.toString().trim()) return null;
  const elementOf = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as Element | null;
  const editable = elementOf(sel.anchorNode)?.closest<HTMLElement>('.block-content[contenteditable="true"]');
  if (!editable || !editable.contains(sel.focusNode)) return null;
  const wrapper = editable.closest<HTMLElement>('[data-block-id]');
  const type = wrapper?.dataset.blockType;
  if (!wrapper || !type || NO_TOOLBAR.includes(type)) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    blockId: wrapper.dataset.blockId as string,
    type: type as BlockType,
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
  };
}

export function FormatToolbar({ onFormat, onLink, onColor, getColor }: Props) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Follow the selection. It is hidden while the mouse is down (a drag
  // selection is not finished yet) and after Escape, until the selection changes.
  useEffect(() => {
    let pointerDown = false;
    let dismissed = false;
    const update = () => {
      const next = pointerDown || dismissed ? null : readTarget();
      setTarget(prev => {
        if (!next) return null;
        if (prev && prev.blockId === next.blockId && prev.rect.top === next.rect.top
          && prev.rect.left === next.rect.left && prev.rect.width === next.rect.width) return prev;
        return next;
      });
    };
    const inToolbar = (e: Event) => Boolean(ref.current?.contains(e.target as Node));

    const onSelectionChange = () => {
      dismissed = false;
      update();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (inToolbar(e)) return;
      pointerDown = true;
      setTarget(null);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (inToolbar(e)) return;
      pointerDown = false;
      // The final selection of a click or drag is in place after the event.
      setTimeout(update, 0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissed = true;
        setTarget(null);
      }
    };
    // Scrolling would leave it behind the text. Scrolling inside the toolbar's
    // own popup does not count.
    const onScroll = (e: Event) => {
      if (!inToolbar(e)) setTarget(null);
    };
    const hide = () => {
      pointerDown = false;
      setTarget(null);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // The color popup belongs to one selection.
  useEffect(() => {
    if (!target) setColorOpen(false);
  }, [target]);

  // Above the selection, centered, kept inside the viewport; below it when
  // there is no room on top. Measured after render because the width depends
  // on which buttons are shown.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!target || !el) {
      setPos(null);
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    let top = target.rect.top - height - GAP;
    if (top < MARGIN) top = target.rect.bottom + GAP;
    const centered = target.rect.left + target.rect.width / 2 - width / 2;
    const left = Math.max(MARGIN, Math.min(centered, vw - width - MARGIN));
    setPos(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [target]);

  // The color popup opens below the toolbar, aligned to its left edge; slide it
  // back into the viewport, or put it above the toolbar when it hits the bottom.
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!colorOpen || !el) {
      setPopoverStyle({});
      return;
    }
    const rect = el.getBoundingClientRect();
    const next: React.CSSProperties = {};
    if (rect.right > window.innerWidth - MARGIN) next.left = window.innerWidth - MARGIN - rect.right;
    else if (rect.left < MARGIN) next.left = MARGIN - rect.left;
    if (rect.bottom > window.innerHeight - MARGIN) {
      next.top = 'auto';
      next.bottom = 'calc(100% + 6px)';
    }
    setPopoverStyle(next);
  }, [colorOpen]);

  if (!target) return null;

  const mod = IS_MAC ? '⌘' : 'Ctrl+';
  const shift = IS_MAC ? '⇧' : 'Shift+';
  const buttons: { format: InlineFormat; label: string; hint: string; glyph: React.ReactNode }[] = [
    { format: 'bold', label: t('format.bold'), hint: `${mod}B`, glyph: <span className="format-toolbar-glyph format-toolbar-glyph--bold">B</span> },
    { format: 'italic', label: t('format.italic'), hint: `${mod}I`, glyph: <span className="format-toolbar-glyph format-toolbar-glyph--italic">I</span> },
    { format: 'strike', label: t('format.strike'), hint: `${mod}${shift}S`, glyph: <span className="format-toolbar-glyph format-toolbar-glyph--strike">S</span> },
    { format: 'code', label: t('format.code'), hint: `${mod}E`, glyph: <CodeIcon size={14} /> },
  ];

  return createPortal(
    <div
      ref={ref}
      className="format-toolbar"
      role="toolbar"
      aria-label={t('format.toolbar')}
      // Keeps the selection (and the block's focus) while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      {buttons.map(b => (
        <button
          key={b.format}
          type="button"
          className="format-toolbar-btn"
          title={`${b.label} (${b.hint})`}
          aria-label={b.label}
          onClick={() => onFormat(target.blockId, b.format)}
        >
          {b.glyph}
        </button>
      ))}
      <button
        type="button"
        className="format-toolbar-btn"
        title={`${t('format.link')} (${mod}K)`}
        aria-label={t('format.link')}
        onClick={() => onLink(target.blockId)}
      >
        <LinkIcon size={14} />
      </button>
      {isColorable(target.type) && (
        <>
          <span className="format-toolbar-sep" aria-hidden="true" />
          {/* Color is per block, not per selection: inline colored spans would
              need markup the inline markdown has no syntax for. */}
          <button
            type="button"
            className={`format-toolbar-btn format-toolbar-btn--color${colorOpen ? ' is-active' : ''}`}
            title={t('format.color')}
            aria-label={t('format.color')}
            aria-haspopup="menu"
            aria-expanded={colorOpen}
            onClick={() => setColorOpen(open => !open)}
          >
            <span className="format-toolbar-glyph format-toolbar-color-glyph" data-color={getColor(target.blockId) || 'default'}>A</span>
          </button>
          {colorOpen && (
            <div ref={popoverRef} className="format-toolbar-popover" role="menu" style={popoverStyle}>
              <ColorMenu
                value={getColor(target.blockId)}
                onSelect={(color) => {
                  setColorOpen(false);
                  onColor(target.blockId, color);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
