import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Page } from '../types';
import { DocumentIcon } from './Icons';
import { useLanguage } from '../i18n/LanguageContext';
import { useScrollContainer } from '../hooks/useScrollContainer';

const MENU_MAX_HEIGHT = 280;
const MENU_WIDTH = 280;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;
const MAX_RESULTS = 8;

// Pages matching what the user typed after `@` / `[[`. Prefix matches come
// first; with no query the most recently edited pages are offered.
export function filterMentionPages(pages: Page[], query: string): Page[] {
  const q = query.trim().toLowerCase();
  const byRecent = [...pages].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (!q) return byRecent.slice(0, MAX_RESULTS);
  const matches = byRecent.filter(p => (p.title || '').toLowerCase().includes(q));
  const prefix = matches.filter(p => (p.title || '').toLowerCase().startsWith(q));
  const rest = matches.filter(p => !prefix.includes(p));
  return [...prefix, ...rest].slice(0, MAX_RESULTS);
}

// Link text for a page. Brackets would end the markdown link text early.
export function mentionLinkMarkdown(page: Page, untitled: string): string {
  const title = (page.title || untitled).replace(/[[\]\n]/g, ' ').trim() || untitled;
  return `[${title}](/page/${page.id})`;
}

interface Props {
  // Viewport rect of the caret the menu hangs from.
  anchor: { top: number; bottom: number; left: number };
  results: Page[];
  onSelect: (page: Page) => void;
  // Dismiss without inserting (Escape, caret moved away, click outside).
  onClose: () => void;
}

export function MentionMenu({ anchor, results, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const keyboardNavRef = useRef(false);
  const scrollContainerRef = useScrollContainer();
  const [placement, setPlacement] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // Typing narrows the list; the old index may no longer exist.
  const resultKey = results.map(p => p.id).join(',');
  useEffect(() => {
    setSelectedIndex(0);
  }, [resultKey]);

  useEffect(() => {
    if (!keyboardNavRef.current) return;
    keyboardNavRef.current = false;
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Same placement rules as SlashMenu: below the caret, flipped above when
  // there is no room, shifted with the scroll container instead of closing.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const container = scrollContainerRef.current;
    const baseScroll = container?.scrollTop ?? 0;

    const place = () => {
      const dy = (container?.scrollTop ?? 0) - baseScroll;
      const bottom = anchor.bottom - dy;
      const top = anchor.top - dy;
      const natural = Math.min(MENU_MAX_HEIGHT, menu.scrollHeight + 2);
      const below = window.innerHeight - bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
      const above = top - ANCHOR_GAP - VIEWPORT_MARGIN;
      const flip = natural > below && above > below;
      const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, flip ? above : below));
      const height = Math.min(natural, maxHeight);
      const y = flip ? top - ANCHOR_GAP - height : bottom + ANCHOR_GAP;
      const x = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
      setPlacement(prev =>
        prev && prev.top === y && prev.left === x && prev.maxHeight === maxHeight
          ? prev
          : { top: y, left: x, maxHeight },
      );
    };

    place();
    container?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      container?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [anchor.top, anchor.bottom, anchor.left, results.length, scrollContainerRef]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        keyboardNavRef.current = true;
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        keyboardNavRef.current = true;
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (results[selectedIndex]) onSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        // The caret left the trigger text; the menu no longer applies.
        onClose();
      }
    };
    // No full-screen overlay (unlike SlashMenu): the user keeps typing in the
    // block, so a click elsewhere is detected here and closes the menu.
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [results, selectedIndex, onSelect, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="mention-menu slash-menu"
      role="listbox"
      aria-label={t('mention.title')}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
      // Keep the caret in the block: a mousedown here would blur it.
      onMouseDown={e => e.preventDefault()}
    >
      {results.map((page, idx) => (
        <div
          key={page.id}
          ref={idx === selectedIndex ? activeItemRef : undefined}
          role="option"
          aria-selected={idx === selectedIndex}
          className={`slash-menu-item ${idx === selectedIndex ? 'active' : ''}`}
          onClick={() => onSelect(page)}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <div className="mention-menu-icon">{page.icon || <DocumentIcon size={16} />}</div>
          <div className="slash-menu-item-info">
            <span className="slash-menu-item-label mention-menu-title">
              {page.title || t('sidebar.untitledPage')}
            </span>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
