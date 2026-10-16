import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BLOCK_TYPES, BlockType } from '../types';
import {
  TextIcon,
  HeadingIcon,
  ListBulletIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  CodeIcon,
  QuoteIcon,
  DividerIcon,
  LightbulbIcon,
  ImageIcon,
  PaperclipIcon,
  DocumentIcon,
  TableIcon,
  ChevronRightSmallIcon,
  MathIcon,
} from './Icons';
import { useLanguage } from '../i18n/LanguageContext';
import { useScrollContainer } from '../hooks/useScrollContainer';

const MENU_MAX_HEIGHT = 320;
const MENU_WIDTH = 280;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;

interface Props {
  // Viewport coordinates of the bottom-left corner of the block being typed in.
  position: { top: number; left: number };
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

// Mapea el `icon` string (definido en BLOCK_TYPES) al componente SVG
// correspondiente. Si no hay match, muestra un punto genérico.
function SlashIcon({ name }: { name: string }) {
  const size = 16;
  switch (name) {
    case 'paragraph':
      return <TextIcon size={size} />;
    case 'heading1':
    case 'heading2':
    case 'heading3':
      return <HeadingIcon size={size} />;
    case 'bullet':
      return <ListBulletIcon size={size} />;
    case 'numbered':
      return <ListOrderedIcon size={size} />;
    case 'todo':
      return <CheckSquareIcon size={size} />;
    case 'code':
      return <CodeIcon size={size} />;
    case 'quote':
      return <QuoteIcon size={size} />;
    case 'divider':
      return <DividerIcon size={size} />;
    case 'callout':
      return <LightbulbIcon size={size} />;
    case 'image':
      return <ImageIcon size={size} />;
    case 'file':
      return <PaperclipIcon size={size} />;
    case 'subpage':
      return <DocumentIcon size={size} />;
    case 'table':
      return <TableIcon size={size} />;
    case 'toggle':
      return <ChevronRightSmallIcon size={size} />;
    case 'math':
      return <MathIcon size={size} />;
    default:
      return <TextIcon size={size} />;
  }
}

export function SlashMenu({ position, query, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  // Only follow the selection with scrollIntoView for keyboard moves; on hover
  // it would nudge the list under the pointer.
  const keyboardNavRef = useRef(false);
  const scrollContainerRef = useScrollContainer();
  const [placement, setPlacement] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // Filtramos comparando contra los strings traducidos en el idioma actual,
  // más los fallbacks en español (por si alguien renderiza sin contexto).
  const filtered = BLOCK_TYPES.filter(item => {
    const labelTranslated = t(item.labelKey).toLowerCase();
    const descTranslated = t(item.descriptionKey).toLowerCase();
    const q = query.toLowerCase();
    return labelTranslated.includes(q)
      || descTranslated.includes(q)
      || item.label.toLowerCase().includes(q)
      || item.description.toLowerCase().includes(q);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!keyboardNavRef.current) return;
    keyboardNavRef.current = false;
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Position in viewport coordinates, flipping above the block when there is
  // no room below. `position` is captured at the moment the menu opens, so if
  // .main-content scrolls afterwards we shift by the scroll delta instead of
  // closing the menu (typing near the bottom makes the browser scroll too).
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const container = scrollContainerRef.current;
    const baseScroll = container?.scrollTop ?? 0;
    // The focused element is the block being typed in; its height tells where
    // the block starts, which is the anchor when flipping above.
    const blockHeight = (document.activeElement as HTMLElement | null)?.getBoundingClientRect().height || 28;

    const place = () => {
      const dy = (container?.scrollTop ?? 0) - baseScroll;
      const anchorBottom = position.top - dy;
      const anchorTop = anchorBottom - blockHeight;
      // +2 for the 1px border; scrollHeight excludes it.
      const natural = Math.min(MENU_MAX_HEIGHT, menu.scrollHeight + 2);
      const below = window.innerHeight - anchorBottom - ANCHOR_GAP - VIEWPORT_MARGIN;
      const above = anchorTop - ANCHOR_GAP - VIEWPORT_MARGIN;
      const flip = natural > below && above > below;
      const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, flip ? above : below));
      const height = Math.min(natural, maxHeight);
      const top = flip ? anchorTop - ANCHOR_GAP - height : anchorBottom + ANCHOR_GAP;
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(position.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
      );
      setPlacement(prev =>
        prev && prev.top === top && prev.left === left && prev.maxHeight === maxHeight
          ? prev
          : { top, left, maxHeight },
      );
    };

    place();
    container?.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      container?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
    // filtered.length: the menu height changes as the query narrows the list.
  }, [position.top, position.left, filtered.length, scrollContainerRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        keyboardNavRef.current = true;
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        keyboardNavRef.current = true;
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Portal to body: position: fixed must not be affected by transformed or
  // overflow-clipped ancestors inside the page.
  return createPortal(
    <>
      <div className="slash-menu-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className="slash-menu"
        style={{
          top: placement?.top ?? 0,
          left: placement?.left ?? 0,
          maxHeight: placement?.maxHeight,
          // Hidden for the single layout pass before we know where to put it.
          visibility: placement ? 'visible' : 'hidden',
        }}
      >
        {filtered.length === 0 ? (
          <div className="slash-menu-empty">{t('slash.empty')}</div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={item.type}
              ref={idx === selectedIndex ? activeItemRef : undefined}
              className={`slash-menu-item ${idx === selectedIndex ? 'active' : ''}`}
              onClick={() => onSelect(item.type)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="slash-menu-item-icon">
                <SlashIcon name={item.icon} />
              </div>
              <div className="slash-menu-item-info">
                <span className="slash-menu-item-label">{t(item.labelKey)}</span>
                <span className="slash-menu-item-desc">{t(item.descriptionKey)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>,
    document.body,
  );
}