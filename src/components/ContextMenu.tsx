import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRightSmallIcon } from './Icons';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  // Tooltip shown on hover. Most useful for disabled items so the user
  // understands why the action isn't available.
  title?: string;
  // Renders as a divider line between groups.
  divider?: boolean;
  // Renders as a non-clickable section header (e.g. "Convert to:").
  // No onClick; shown as muted text, not a button.
  header?: boolean;
  // Content of a panel that opens beside the item on hover or click (e.g. the
  // color picker). The item itself does nothing when clicked, and picking
  // something in the panel is up to the caller, who closes the menu.
  submenu?: React.ReactNode;
}

interface Props {
  // Viewport-space coordinates. Caller usually passes e.clientX/clientY from onContextMenu.
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// Panel opened by an item with a submenu. Opens to the right of the menu, to the
// left when there is no room, and slides up if it would leave the viewport.
function Submenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next: React.CSSProperties = {};
    if (rect.right > window.innerWidth - 8) {
      next.left = 'auto';
      next.right = 'calc(100% + 2px)';
    }
    const overflow = rect.bottom - (window.innerHeight - 8);
    if (overflow > 0) next.top = -5 - Math.min(overflow, Math.max(0, rect.top - 8));
    setStyle(next);
  }, []);

  return (
    <div ref={ref} className="context-submenu" role="menu" style={style}>
      {children}
    </div>
  );
}

// Floating context menu. Closes on outside click, Escape, or item click.
// Repositions if it overflows the viewport.
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x, y });
  // Index of the item whose submenu is open.
  const [openSub, setOpenSub] = useState<number | null>(null);

  // Close on Escape or outside click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // mousedown (not click) so this fires before any React onMouseDown handlers.
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  // After mount, reposition if we overflow the viewport. One tick so the
  // browser has measured the menu's size.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width > vw - 8) nx = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh - 8) ny = Math.max(8, vh - rect.height - 8);
    if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={`d-${i}`} className="context-menu-divider" role="separator" />;
        }
        if (item.header) {
          return <div key={`h-${i}`} className="context-menu-label" role="presentation">{item.label}</div>;
        }
        if (item.submenu) {
          return (
            <div
              key={`${item.label}-${i}`}
              className="context-menu-submenu-host"
              onMouseEnter={() => setOpenSub(i)}
            >
              <button
                type="button"
                className="context-menu-item"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openSub === i}
                onClick={() => setOpenSub(open => (open === i ? null : i))}
              >
                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                <span>{item.label}</span>
                <span className="context-menu-chevron"><ChevronRightSmallIcon size={12} /></span>
              </button>
              {openSub === i && <Submenu>{item.submenu}</Submenu>}
            </div>
          );
        }
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            className={`context-menu-item${item.danger ? ' context-menu-item--danger' : ''}`}
            role="menuitem"
            disabled={item.disabled}
            title={item.title}
            onMouseEnter={() => setOpenSub(null)}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}