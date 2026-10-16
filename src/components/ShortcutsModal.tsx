import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/en';

// Cheat sheet for the editor's keyboard shortcuts (Ctrl/Cmd + /). Rendered in
// a portal so no ancestor can clip it.

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

interface Row {
  // Each entry is one key cap; '+' separators are drawn by the layout.
  keys: string[];
  labelKey: TranslationKey;
}

interface Group {
  titleKey: TranslationKey;
  rows: Row[];
}

function buildGroups(): Group[] {
  const mod = IS_MAC ? '⌘' : 'Ctrl';
  const shift = IS_MAC ? '⇧' : 'Shift';
  // Notion's own convention: Cmd+Option on macOS, Ctrl+Shift elsewhere (Ctrl+Alt
  // is AltGr on many Windows layouts and would eat characters like @).
  const turn = IS_MAC ? [mod, '⌥'] : [mod, shift];
  return [
    {
      titleKey: 'shortcuts.groupBlocks',
      rows: [
        { keys: ['Enter'], labelKey: 'shortcuts.newBlock' },
        { keys: ['Tab'], labelKey: 'shortcuts.indent' },
        { keys: [shift, 'Tab'], labelKey: 'shortcuts.outdent' },
        { keys: [mod, 'D'], labelKey: 'shortcuts.duplicate' },
        { keys: [mod, shift, '↑'], labelKey: 'shortcuts.moveUp' },
        { keys: [mod, shift, '↓'], labelKey: 'shortcuts.moveDown' },
        { keys: ['/'], labelKey: 'shortcuts.slash' },
        { keys: ['@'], labelKey: 'shortcuts.mention' },
        { keys: ['[['], labelKey: 'shortcuts.mentionAlt' },
      ],
    },
    {
      titleKey: 'shortcuts.groupTurnInto',
      rows: [
        { keys: [...turn, '0'], labelKey: 'ctx.paragraph' },
        { keys: [...turn, '1'], labelKey: 'ctx.heading1' },
        { keys: [...turn, '2'], labelKey: 'ctx.heading2' },
        { keys: [...turn, '3'], labelKey: 'ctx.heading3' },
        { keys: [...turn, '4'], labelKey: 'ctx.todo' },
        { keys: [...turn, '5'], labelKey: 'ctx.bullet' },
        { keys: [...turn, '6'], labelKey: 'ctx.numbered' },
        { keys: [...turn, '8'], labelKey: 'ctx.code' },
      ],
    },
    {
      titleKey: 'shortcuts.groupGeneral',
      rows: [{ keys: [mod, '/'], labelKey: 'shortcuts.help' }],
    },
  ];
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const groups = React.useMemo(buildGroups, []);

  useEffect(() => {
    // Give focus back to the block that had it (the caret comes back with it).
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Capture + stop so Esc only closes the sheet, nothing underneath.
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        // The close button is the only focusable element.
        e.preventDefault();
        closeBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="shortcuts-overlay" onMouseDown={onClose}>
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title')}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="shortcuts-header">
          <h2 className="shortcuts-title">{t('shortcuts.title')}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="shortcuts-close"
            onClick={onClose}
            aria-label={t('shortcuts.close')}
            title={t('shortcuts.close')}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="shortcuts-body">
          {groups.map(group => (
            <section key={group.titleKey} className="shortcuts-group">
              <h3 className="shortcuts-group-title">{t(group.titleKey)}</h3>
              {group.rows.map(row => (
                <div key={row.labelKey + row.keys.join('+')} className="shortcuts-row">
                  <span className="shortcuts-label">{t(row.labelKey)}</span>
                  <span className="shortcuts-keys">
                    {row.keys.map((k, i) => (
                      <kbd key={i} className="shortcuts-key">{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
