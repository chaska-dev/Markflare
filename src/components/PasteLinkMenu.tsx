import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';

const MENU_WIDTH = 220;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;

export type PasteLinkChoice = 'link' | 'bookmark' | 'embed';

export interface PasteLinkOption {
  id: PasteLinkChoice;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  // Viewport rect of the block the link was pasted into.
  anchor: { top: number; bottom: number; left: number };
  options: PasteLinkOption[];
  onSelect: (choice: PasteLinkChoice) => void;
  // Escape, a click elsewhere or any other key: the link stays as pasted.
  onClose: () => void;
}

// "Paste as" menu shown after a lone link is pasted into an empty paragraph,
// which already holds the link as text. Arrow keys and Enter/Tab choose; typing
// anything else just closes it. Built like MentionMenu: no overlay, the user
// keeps the caret in the block.
export function PasteLinkMenu({ anchor, options, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const height = menu.offsetHeight;
    const below = window.innerHeight - anchor.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
    const top = height > below && anchor.top > below ? anchor.top - ANCHOR_GAP - height : anchor.bottom + ANCHOR_GAP;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
    setPlacement({ top, left });
  }, [anchor.top, anchor.bottom, anchor.left, options.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(options[selectedIndex].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        onClose();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onMouseDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [options, selectedIndex, onSelect, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="mention-menu slash-menu paste-link-menu"
      role="listbox"
      aria-label={t('paste.title')}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        width: MENU_WIDTH,
        visibility: placement ? 'visible' : 'hidden',
      }}
      // Keep the caret in the block: a mousedown here would blur it.
      onMouseDown={e => e.preventDefault()}
    >
      <div className="paste-link-menu-title">{t('paste.title')}</div>
      {options.map((option, idx) => (
        <div
          key={option.id}
          role="option"
          aria-selected={idx === selectedIndex}
          className={`slash-menu-item ${idx === selectedIndex ? 'active' : ''}`}
          onClick={() => onSelect(option.id)}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <div className="mention-menu-icon">{option.icon}</div>
          <div className="slash-menu-item-info">
            <span className="slash-menu-item-label">{option.label}</span>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
