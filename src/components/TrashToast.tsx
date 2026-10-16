import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePageContext } from '../contexts/PageContext';
import { useLanguage } from '../i18n/LanguageContext';

const TOAST_MS = 7000;

// "Moved to Trash · Undo" strip shown right after a page is deleted. Deleting is
// reversible now, so this replaces the old blocking confirm dialog.
export function TrashToast() {
  const { lastTrashed, dismissLastTrashed, restorePage } = usePageContext();
  const { t } = useLanguage();

  // Each new deletion restarts the timer.
  useEffect(() => {
    if (!lastTrashed) return;
    const timer = window.setTimeout(dismissLastTrashed, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [lastTrashed, dismissLastTrashed]);

  if (!lastTrashed) return null;

  const handleUndo = async () => {
    const { id } = lastTrashed;
    dismissLastTrashed();
    try {
      await restorePage(id);
    } catch (err) {
      console.error('Failed to restore page', err);
    }
  };

  // Portal to <body>: the sidebar can be transformed off-screen on narrow
  // layouts, which would drag a position:fixed child along with it.
  return createPortal(
    <div className="trash-toast" role="status" aria-live="polite">
      <span className="trash-toast-text">
        {t('trash.moved', { title: lastTrashed.title || t('sidebar.untitledPage') })}
      </span>
      <button type="button" className="trash-toast-undo" onClick={handleUndo}>
        {t('trash.undo')}
      </button>
    </div>,
    document.body
  );
}
