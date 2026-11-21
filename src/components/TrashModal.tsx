import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { usePageContext } from '../contexts/PageContext';
import { useLanguage } from '../i18n/LanguageContext';
import { TrashedPage } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { DocumentIcon, SearchIcon, TrashIcon, XIcon } from './Icons';
import { RestoreIcon } from './PageIcons';

interface Props {
  open: boolean;
  onClose: () => void;
}

// What the confirm dialog is about to delete forever: one page, or everything.
type PendingDelete = { kind: 'one'; page: TrashedPage } | { kind: 'all' };

export function TrashModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const { restorePage } = usePageContext();
  const [items, setItems] = useState<TrashedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Reload every time the modal opens: the list changes whenever pages are
  // deleted from the sidebar, and the server also purges expired items here.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setQuery('');
    setError(null);
    setLoading(true);
    api.pages.trash()
      .then(res => { if (active) setItems(res.pages); })
      .catch(err => {
        console.error('Failed to load trash', err);
        if (active) setError(t('trash.loadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      active = false;
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes the modal, unless the confirm dialog is up (it handles its own).
  useEffect(() => {
    if (!open || pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending, onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => (p.title || '').toLowerCase().includes(q));
  }, [items, query]);

  const handleRestore = useCallback(async (page: TrashedPage) => {
    setBusyId(page.id);
    setError(null);
    try {
      await restorePage(page.id);
      setItems(prev => prev.filter(p => p.id !== page.id));
    } catch (err) {
      console.error('Failed to restore page', err);
      setError(t('trash.actionError'));
    } finally {
      setBusyId(null);
    }
  }, [restorePage, t]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pending) return;
    setDeleting(true);
    setError(null);
    try {
      if (pending.kind === 'one') {
        await api.pages.deletePermanent(pending.page.id);
        setItems(prev => prev.filter(p => p.id !== pending.page.id));
      } else {
        await api.pages.emptyTrash();
        setItems([]);
      }
      setPending(null);
    } catch (err) {
      console.error('Failed to delete permanently', err);
      setError(t('trash.actionError'));
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }, [pending, t]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="trash-backdrop"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="trash-panel" role="dialog" aria-modal="true" aria-label={t('trash.title')}>
          <div className="trash-header">
            <span className="trash-title"><TrashIcon size={16} /> {t('trash.title')}</span>
            <button type="button" className="trash-close" onClick={onClose} aria-label={t('importModal.close')}>
              <XIcon size={16} />
            </button>
          </div>

          <div className="trash-search">
            <SearchIcon size={14} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('trash.searchPlaceholder')}
              aria-label={t('trash.searchPlaceholder')}
            />
          </div>

          {error && <div className="trash-error" role="alert">{error}</div>}

          <div className="trash-list">
            {loading ? (
              <div className="trash-empty">…</div>
            ) : items.length === 0 ? (
              <div className="trash-empty">{t('trash.empty')}</div>
            ) : visible.length === 0 ? (
              <div className="trash-empty">{t('trash.noMatches', { query: query.trim() })}</div>
            ) : (
              visible.map(page => (
                <div key={page.id} className="trash-item">
                  <span className="trash-item-icon">{page.icon || <DocumentIcon size={16} />}</span>
                  <span className="trash-item-title">{page.title || t('sidebar.untitledPage')}</span>
                  <div className="trash-item-actions">
                    <button
                      type="button"
                      className="trash-item-btn"
                      onClick={() => handleRestore(page)}
                      disabled={busyId === page.id}
                      title={t('trash.restore')}
                      aria-label={`${t('trash.restore')}: ${page.title || t('sidebar.untitledPage')}`}
                    >
                      <RestoreIcon size={14} />
                    </button>
                    <button
                      type="button"
                      className="trash-item-btn trash-item-btn--danger"
                      onClick={() => setPending({ kind: 'one', page })}
                      disabled={busyId === page.id}
                      title={t('trash.deleteForever')}
                      aria-label={`${t('trash.deleteForever')}: ${page.title || t('sidebar.untitledPage')}`}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="trash-footer">
            <span className="trash-hint">{t('trash.hint')}</span>
            <button
              type="button"
              className="trash-empty-btn"
              onClick={() => setPending({ kind: 'all' })}
              disabled={items.length === 0}
            >
              {t('trash.emptyTrash')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'one'
            ? t('trash.confirmDeleteTitle', { title: pending.page.title || t('sidebar.untitledPage') })
            : t('trash.confirmEmptyTitle')
        }
        description={pending?.kind === 'one' ? t('trash.confirmDeleteBody') : t('trash.confirmEmptyBody')}
        confirmLabel={pending?.kind === 'one' ? t('trash.deleteForever') : t('trash.emptyTrash')}
        confirmTone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => { if (!deleting) setPending(null); }}
      />
    </>,
    document.body
  );
}
