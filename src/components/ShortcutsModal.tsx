import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/en';

// Cheat sheet for the editor's keyboard shortcuts (Ctrl/Cmd + /). Rendered in
// a portal so no ancestor can clip it.

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

interface Row {
  // Each entry is one key cap; '+' separators are drawn by the layout. A
  // { t } entry is a word for the cap (a mouse gesture), translated at render.
  keys: (string | { t: TranslationKey })[];
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
      titleKey: 'shortcuts.groupSelection',
      rows: [
        { keys: ['Esc'], labelKey: 'shortcuts.selectBlock' },
        { keys: [shift, '↑ / ↓'], labelKey: 'shortcuts.extendSelection' },
        { keys: [shift, { t: 'shortcuts.keyClick' }], labelKey: 'shortcuts.rangeSelect' },
        { keys: [{ t: 'shortcuts.keyDrag' }], labelKey: 'shortcuts.dragSelect' },
        { keys: [mod, 'A'], labelKey: 'shortcuts.selectAll' },
        { keys: ['↑ / ↓'], labelKey: 'shortcuts.moveSelection' },
        { keys: ['Enter'], labelKey: 'shortcuts.editSelected' },
        { keys: ['Tab'], labelKey: 'shortcuts.indentSelected' },
        { keys: [shift, 'Tab'], labelKey: 'shortcuts.outdentSelected' },
        { keys: [mod, 'D'], labelKey: 'shortcuts.duplicate' },
        { keys: [mod, 'C'], labelKey: 'shortcuts.copyBlocks' },
        { keys: [mod, 'X'], labelKey: 'shortcuts.cutBlocks' },
        { keys: ['⌫'], labelKey: 'shortcuts.deleteBlocks' },
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
      titleKey: 'shortcuts.groupFormat',
      rows: [
        { keys: [mod, 'B'], labelKey: 'shortcuts.bold' },
        { keys: [mod, 'I'], labelKey: 'shortcuts.italic' },
        { keys: [mod, shift, 'S'], labelKey: 'shortcuts.strike' },
        { keys: [mod, 'E'], labelKey: 'shortcuts.inlineCode' },
        // Without a selection Ctrl/Cmd+K stays the page search.
        { keys: [mod, 'K'], labelKey: 'shortcuts.link' },
      ],
    },
    {
      titleKey: 'shortcuts.groupGeneral',
      rows: [
        { keys: [mod, 'Z'], labelKey: 'shortcuts.undo' },
        { keys: [mod, shift, 'Z'], labelKey: 'shortcuts.redo' },
        ...(IS_MAC ? [] : [{ keys: [mod, 'Y'], labelKey: 'shortcuts.redo' } as Row]),
        { keys: [mod, '/'], labelKey: 'shortcuts.help' },
      ],
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
                <div
                  key={row.labelKey + row.keys.map(k => (typeof k === 'string' ? k : k.t)).join('+')}
                  className="shortcuts-row"
                >
                  <span className="shortcuts-label">{t(row.labelKey)}</span>
                  <span className="shortcuts-keys">
                    {row.keys.map((k, i) => (
                      <kbd key={i} className="shortcuts-key">{typeof k === 'string' ? k : t(k.t)}</kbd>
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
