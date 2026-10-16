import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { PageWithBlocks } from '../types';
import { usePageContext } from '../contexts/PageContext';
import { BlockEditor } from './BlockEditor';
import { PlusIcon, ShareIcon, UploadIcon, TrashIcon } from './Icons';
import { StarIcon, StarFilledIcon, FullWidthIcon, RestoreIcon } from './PageIcons';
import { ConfirmDialog } from './ConfirmDialog';
import { ReadOnlyBlock } from './ReadOnlyBlock';
import { SharePopover } from './SharePopover';
import { CoverBanner } from './CoverBanner';
import { IconPicker } from './IconPicker';
import { DocumentOutline } from './DocumentOutline';
import { addRecentPage, removeRecentPage } from '../utils/workspaceStorage';
import { useLanguage } from '../i18n/LanguageContext';
import { useScrollContainer } from '../hooks/useScrollContainer';
import { usePageScrollMemory } from '../hooks/usePageScrollMemory';

export function PageView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { t } = useLanguage();
  const [page, setPage] = useState<PageWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    pages,
    createPage,
    updatePage,
    setCurrentPageId,
    getPageBreadcrumbs,
    refreshPages,
    toggleFavorite,
    restorePage,
  } = usePageContext();

  const [shareOpen, setShareOpen] = useState(false);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const [shareAnchor, setShareAnchor] = useState<DOMRect | null>(null);

  // Trash banner state (only used while the opened page is in Trash).
  const [restoring, setRestoring] = useState(false);
  const [confirmForeverOpen, setConfirmForeverOpen] = useState(false);
  const [deletingForever, setDeletingForever] = useState(false);

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconBtnRef = useRef<HTMLButtonElement | null>(null);
  const [iconAnchor, setIconAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!id) return;

    let active = true;
    setCurrentPageId(id);
    setLoading(true);

    // includeTrashed: a page in Trash still opens (read-only, with a restore
    // banner) instead of showing "not found".
    api.pages.get(id, { includeTrashed: true }).then(res => {
      if (active) {
        setPage(res.page);
        setLoading(false);
        if (!res.page.deleted_at) {
          addRecentPage({
            id: res.page.id,
            title: res.page.title,
            icon: res.page.icon,
          });
        }
      }
    }).catch(err => {
      console.error(err);
      if (active) {
        setPage(null);
        setLoading(false);
      }
    });

    return () => { active = false; };
  }, [id, setCurrentPageId]);

  // `page.id === id` guards the first render after a route change, which still
  // holds the previous page's content and must not trigger a restore.
  const scrollContainerRef = useScrollContainer();
  const contentReady = !loading && (page === null || page.id === id);
  usePageScrollMemory(id, contentReady, scrollContainerRef, hash);

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!page || !id) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <div className="empty-state-text">Page not found</div>
      </div>
    );
  }

  const isTrashed = Boolean(page.deleted_at);

  // Page preferences live in the database. The page list in the context is
  // kept current by updatePage (optimistic), so prefer it over the copy
  // fetched when the page opened; a trashed page is only in the local copy.
  const meta = pages.find(p => p.id === id) ?? page;
  const isFavorite = meta.is_favorite;
  const isFullWidth = meta.full_width;
  const isProj = meta.is_project;
  const cover = meta.cover;

  // Cover banner belongs exclusively to the project root page.
  // Subpages (parent_id !== null) and regular private notes do not get a banner.
  const isProjectRoot = isProj && !page.parent_id && !isTrashed;
  const hasCover = isProjectRoot && Boolean(cover);

  const breadcrumbs = getPageBreadcrumbs(id);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPage({ ...page, title: e.target.value });
  };

  const handleTitleBlur = () => {
    if (isTrashed) return;
    updatePage(id, { title: page.title });
    addRecentPage({ id, title: page.title, icon: page.icon });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isTrashed) return;
      updatePage(id, { title: page.title });
      addRecentPage({ id, title: page.title, icon: page.icon });
    }
  };

  const handleSelectIcon = (emoji: string) => {
    setPage({ ...page, icon: emoji });
    updatePage(id, { icon: emoji });
    addRecentPage({ id, title: page.title, icon: emoji });
  };

  const handleRemoveIcon = () => {
    setPage({ ...page, icon: '' });
    updatePage(id, { icon: '' });
    addRecentPage({ id, title: page.title, icon: '' });
  };

  const handleOpenIconPicker = () => {
    if (iconBtnRef.current) {
      setIconAnchor(iconBtnRef.current.getBoundingClientRect());
    }
    setIconPickerOpen(true);
  };

  // The context rolls the change back and rethrows if the save fails.
  const handleSetCover = (newCover: string | null) => {
    updatePage(id, { cover: newCover }).catch(err => console.error('Failed to save cover', err));
  };

  const handleToggleProject = () => {
    updatePage(id, { is_project: !isProj }).catch(err => console.error('Failed to update project', err));
  };

  const handleToggleFavorite = () => {
    toggleFavorite(id).catch(err => console.error('Failed to update favorite', err));
  };

  const handleToggleFullWidth = () => {
    updatePage(id, { full_width: !isFullWidth }).catch(err => console.error('Failed to update layout', err));
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePage(id);
      // Back in the live tree, possibly moved to the root if its parent is
      // still in Trash.
      setPage(prev => (prev ? { ...prev, deleted_at: null, parent_id: restored.parent_id } : prev));
    } catch (err) {
      console.error('Failed to restore page', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteForever = async () => {
    setDeletingForever(true);
    try {
      await api.pages.deletePermanent(id);
      removeRecentPage(id);
      setConfirmForeverOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete page permanently', err);
      setDeletingForever(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.pages.export(id);
      const blob = new Blob([res.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.title || 'export'}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleCreateSubpage = async () => {
    try {
      const newPage = await createPage(id);
      await refreshPages();
      try {
        await api.blocks.create(id, {
          type: 'subpage',
          content: newPage.id,
          position: 999_999,
        });
      } catch (e) {
        console.error('Failed to insert inline subpage block', e);
      }
      navigate(`/page/${newPage.id}`);
    } catch (err) {
      console.error('Error creating subpage', err);
    }
  };

  return (
    <div className={`page-view ${hasCover ? 'page-view--has-cover' : ''} ${isFullWidth ? 'page-view--full-width' : ''}`}>
      {isProjectRoot && (
        <CoverBanner
          cover={cover}
          onSetCover={handleSetCover}
        />
      )}

      <div className="page-main-header">
        {breadcrumbs.length > 1 && (
          <div className="page-breadcrumbs">
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={b.id}>
                {idx > 0 && <span className="breadcrumb-separator">/</span>}
                <span
                  className={`breadcrumb-link ${b.id === id ? 'active' : ''}`}
                  onClick={() => b.id !== id && navigate(`/page/${b.id}`)}
                >
                  {b.icon && <span className="breadcrumb-icon">{b.icon}</span>}
                  <span>{b.title || t('page.titlePlaceholder')}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {!isTrashed && (
        <div className="page-actions">
          <button
            className={`page-action-btn page-action-btn--icon ${isFavorite ? 'page-action-btn--active' : ''}`}
            onClick={handleToggleFavorite}
            title={isFavorite ? t('favorites.remove') : t('favorites.add')}
            aria-label={isFavorite ? t('favorites.remove') : t('favorites.add')}
            aria-pressed={isFavorite}
          >
            {isFavorite ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
          </button>
          <button
            className={`page-action-btn page-action-btn--icon ${isFullWidth ? 'page-action-btn--active' : ''}`}
            onClick={handleToggleFullWidth}
            title={isFullWidth ? t('page.standardWidth') : t('page.fullWidth')}
            aria-label={isFullWidth ? t('page.standardWidth') : t('page.fullWidth')}
            aria-pressed={isFullWidth}
          >
            <FullWidthIcon size={14} />
          </button>
          {!page.parent_id && (
            <button
              className={`page-action-btn ${isProj ? 'page-action-btn--project-active' : ''}`}
              onClick={handleToggleProject}
              title={isProj ? t('page.projectTooltipActive') : t('page.projectTooltipInactive')}
            >
              <span>{isProj ? t('page.projectBadge') : t('page.moveToProjects')}</span>
            </button>
          )}

          <button className="page-action-btn" onClick={handleExport} title={t('page.export')}>
            <UploadIcon size={14} />
            <span>{t('page.export')}</span>
          </button>
          <button className="page-action-btn" onClick={handleCreateSubpage} title={t('page.newSubpage')}>
            <PlusIcon size={14} />
            <span>{t('page.newSubpage')}</span>
          </button>
          <button
            ref={shareBtnRef}
            className="page-action-btn"
            onClick={() => {
              if (shareBtnRef.current) setShareAnchor(shareBtnRef.current.getBoundingClientRect());
              setShareOpen((v) => !v);
            }}
            aria-label={t('page.share')}
            aria-expanded={shareOpen}
          >
            <ShareIcon size={14} />
            <span>{t('share.title')}</span>
          </button>
        </div>
        )}
      </div>

      {isTrashed && (
        <div className="trash-banner" role="status">
          <span className="trash-banner-text">{t('trash.banner')}</span>
          <button className="trash-banner-btn" onClick={handleRestore} disabled={restoring}>
            <RestoreIcon size={13} />
            <span>{t('trash.restore')}</span>
          </button>
          <button
            className="trash-banner-btn trash-banner-btn--danger"
            onClick={() => setConfirmForeverOpen(true)}
            disabled={restoring}
          >
            <TrashIcon size={13} />
            <span>{t('trash.deleteForever')}</span>
          </button>
        </div>
      )}

      <SharePopover
        pageId={id}
        pageTitle={page.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        anchorRect={shareAnchor}
      />

      <div className={`page-header ${hasCover ? 'page-header--with-cover' : ''}`}>
        {page.icon && (
          <button
            ref={iconBtnRef}
            className={`page-icon-btn ${hasCover ? 'page-icon-btn--cover-overlap' : ''}`}
            onClick={handleOpenIconPicker}
            title="Change or remove icon"
          >
            {page.icon}
          </button>
        )}

        {page.icon && (
          <IconPicker
            open={iconPickerOpen}
            onClose={() => setIconPickerOpen(false)}
            onSelect={handleSelectIcon}
            onRemove={handleRemoveIcon}
            anchorRect={iconAnchor}
          />
        )}

        <input
          type="text"
          className="page-title"
          placeholder={t('page.titlePlaceholder')}
          value={page.title}
          readOnly={isTrashed}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
        />
      </div>

      {isTrashed ? (
        <>
          {/* Read-only preview: the editor would write to a page in Trash. */}
          <div className="trash-preview">
            {(page.blocks || [])
              .filter(b => b.type !== 'subpage')
              .map(b => <ReadOnlyBlock key={b.id} block={b} shareToken="" />)}
          </div>
          <ConfirmDialog
            open={confirmForeverOpen}
            title={t('trash.confirmDeleteTitle', { title: page.title || t('sidebar.untitledPage') })}
            description={t('trash.confirmDeleteBody')}
            confirmLabel={t('trash.deleteForever')}
            confirmTone="danger"
            loading={deletingForever}
            onConfirm={handleDeleteForever}
            onCancel={() => { if (!deletingForever) setConfirmForeverOpen(false); }}
          />
        </>
      ) : (
        <>
          <BlockEditor
            pageId={id}
            initialBlocks={page.blocks || []}
          />

          <DocumentOutline blocks={page.blocks || []} />
        </>
      )}
    </div>
  );
}