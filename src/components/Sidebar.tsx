import React, { useRef, useEffect, useMemo, useCallback, memo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { usePageContext, buildPageTree } from '../contexts/PageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Page } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { api } from '../api/client';
import {
  DownloadIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronRightSmallIcon,
  XIcon,
  DocumentIcon,
  UserIcon,
  SearchIcon,
  MoreHorizontalIcon,
  SunIcon,
  MoonIcon,
  TrashIcon,
} from './Icons';
import { StarIcon, StarFilledIcon, DuplicateIcon } from './PageIcons';
import { useTheme } from '../contexts/ThemeContext';
import { Logo } from './Logo';
import { WorkspaceSettings } from './WorkspaceSettings';
import { UserMenuPopover } from './UserMenuPopover';
import { IconColorPickerModal } from './IconColorPickerModal';
import { ApiTokenModal } from './ApiTokenModal';
import { ImportModal } from './ImportModal';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { TrashModal } from './TrashModal';
import { TrashToast } from './TrashToast';
import {
  getRecentPages,
  STORAGE_EVENTS,
  RecentPageItem,
} from '../utils/workspaceStorage';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

function hasDescendant(page: Page, targetId?: string): boolean {
  if (!targetId || !page.children) return false;
  return page.children.some(c => c.id === targetId || hasDescendant(c, targetId));
}

// Returns true if `targetId` is the same page as `root` or one of its
// descendants. Used to reject drops that would create a cycle in the
// page tree (e.g. moving "Work" into "Tasks" when "Tasks" is already
// nested under "Work").
function containsPageId(root: Page, targetId?: string | null): boolean {
  if (!targetId) return false;
  if (root.id === targetId) return true;
  return hasDescendant(root, targetId);
}

// Walk the flat pages array and return true if `descendantId` is a
// descendant of `ancestorId` in the parent_id chain. Used to detect
// cycle conditions during drag without rebuilding the full tree.
function isDescendantOf(
  flatPages: Page[],
  descendantId: string,
  ancestorId: string
): boolean {
  let current = flatPages.find(p => p.id === descendantId);
  // Hard cap the loop at 1000 hops so a corrupted parent_id chain can't
  // lock up the UI on every dragover tick.
  for (let i = 0; i < 1000 && current?.parent_id; i++) {
    if (current.parent_id === ancestorId) return true;
    current = flatPages.find(p => p.id === current!.parent_id);
  }
  return false;
}

// Build the subtree rooted at the given page id from a flat pages list.
// Returns null if the page doesn't exist. Used by drag-and-drop to detect
// cycles: "would nesting page A under page B create a cycle?" is true iff
// B is in A's subtree.
function buildDragSubtree(flatPages: Page[], rootId: string): Page | null {
  const pageMap = new Map<string, Page>();
  flatPages.forEach(p => pageMap.set(p.id, { ...p, children: [] }));
  flatPages.forEach(p => {
    const node = pageMap.get(p.id)!;
    if (p.parent_id && pageMap.has(p.parent_id)) {
      const parent = pageMap.get(p.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    }
  });
  return pageMap.get(rootId) ?? null;
}

// Drag state shared across all PageTreeItems via context. Keeps the UI
// reactive without re-rendering every item on every dragover (only the
// currently-hovered item reads it).
type DropZone = 'top' | 'center' | 'bottom';
type DragState = {
  draggingId: string | null;
  overId: string | null;
  zone: DropZone | null;
};
const DragStateContext = React.createContext<{
  state: DragState;
  setState: React.Dispatch<React.SetStateAction<DragState>>;
} | null>(null);

function useDragState() {
  const ctx = React.useContext(DragStateContext);
  if (!ctx) throw new Error('useDragState must be used within DragStateContext.Provider');
  return ctx;
}

// Compute the drop zone based on cursor Y position relative to the target
// element's bounding rect.
//   - top 33%  -> nest (center) by default; if page has children or is
//     collapsed, treat top 25% as "before sibling" instead.
//   - bottom 25% -> "after sibling"
// To keep the UX simple we use three equal thirds: top = before sibling,
// center = nest inside, bottom = after sibling. This matches the most
// common drag-to-reorder patterns (Notion, Finder, VSCode explorer).
function computeZone(clientY: number, rect: DOMRect): DropZone {
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.33) return 'top';
  if (ratio > 0.67) return 'bottom';
  return 'center';
}

type PageTreeItemProps = {
  page: Page;
  level?: number;
  collapsed: boolean;
};

const PageTreeItem = memo(function PageTreeItem({ page, level = 0, collapsed }: PageTreeItemProps) {
  const { id: currentId } = useParams();
  const isParentOfActive = hasDescendant(page, currentId);
  const [manuallyExpanded, setManuallyExpanded] = React.useState<boolean | null>(null);
  const expanded = manuallyExpanded !== null ? manuallyExpanded : isParentOfActive;
  const itemRef = useRef<HTMLDivElement | null>(null);

  // Navigating to a descendant (breadcrumb, link, search) must reveal it even if
  // the user previously collapsed this node by hand.
  useEffect(() => {
    if (isParentOfActive) setManuallyExpanded(null);
  }, [isParentOfActive, currentId]);

  const navigate = useNavigate();
  const { deletePage, createPage, refreshPages, updatePage, duplicatePage, toggleFavorite, pages: flatPages } = usePageContext();
  const { t } = useLanguage();
  const { state: dragState, setState: setDragState } = useDragState();

  // Page actions menu (the "..." button or a right click on the row).
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const isActive = currentId === page.id;
  const hasChildren = !!(page.children && page.children.length > 0);
  const isDragging = dragState.draggingId === page.id;
  const isOver = dragState.overId === page.id && dragState.zone !== null;
  // A drop on this target would create a cycle iff the target is itself
  // or already a descendant of the dragging page (because nesting parent
  // under its own descendant makes the tree circular).
  const wouldCycle = !!dragState.draggingId && (
    page.id === dragState.draggingId ||
    isDescendantOf(flatPages, page.id, dragState.draggingId)
  );

  // True when this item is being hovered AND the drop would be valid
  // (not a cycle). Used to apply the drop-zone CSS classes.
  const dropZone = isOver && !wouldCycle ? dragState.zone : null;
  const dropInvalid = isOver && wouldCycle;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/page/${page.id}`);
  }, [navigate, page.id]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setManuallyExpanded(prev => !(prev ?? expanded));
  }, [expanded]);

  const openMenuAt = useCallback((x: number, y: number) => setMenuPos({ x, y }), []);

  const handleMenuButton = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  }, [openMenuAt]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenuAt(e.clientX, e.clientY);
  }, [openMenuAt]);

  // Deleting only moves the page to Trash, so there is no confirm step: the
  // toast offers Undo and the Trash view restores it later.
  const handleMoveToTrash = useCallback(async () => {
    try {
      await deletePage(page.id);
    } catch (err) {
      console.error('Failed to move page to trash', err);
    }
  }, [deletePage, page.id]);

  const handleDuplicate = useCallback(async () => {
    try {
      await duplicatePage(page.id);
    } catch (err) {
      console.error('Failed to duplicate page', err);
    }
  }, [duplicatePage, page.id]);

  const menuItems: ContextMenuItem[] = [
    {
      label: page.is_favorite ? t('favorites.remove') : t('favorites.add'),
      icon: page.is_favorite ? <StarFilledIcon size={14} /> : <StarIcon size={14} />,
      onClick: () => { toggleFavorite(page.id).catch(err => console.error('Failed to update favorite', err)); },
    },
    {
      label: t('page.duplicate'),
      icon: <DuplicateIcon size={14} />,
      onClick: handleDuplicate,
    },
    { divider: true },
    {
      label: t('page.moveToTrash'),
      icon: <TrashIcon size={14} />,
      danger: true,
      onClick: handleMoveToTrash,
    },
  ];

  const handleAddChild = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setManuallyExpanded(true);
    try {
      const newPage = await createPage(page.id);
      try {
        await api.blocks.create(page.id, {
          type: 'subpage',
          content: newPage.id,
          position: 999_999,
        });
      } catch (e) {
        console.error('Failed to insert inline subpage block', e);
      }
      await refreshPages();
      navigate(`/page/${newPage.id}`);
    } catch (e) {
      console.error('Failed to create subpage', e);
    }
  }, [createPage, navigate, page.id, refreshPages]);

  // Drag handlers -----------------------------------------------------------

  const handleDragStart = useCallback((e: React.DragEvent) => {
    // Don't initiate a drag from buttons inside the row (add/delete) — the
    // user clicked an action, not the row itself.
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    // Set the payload as both 'text/plain' (broadly supported) and a
    // custom mime type so the drop handler can read it reliably even if
    // a browser extension or other code touches text/plain.
    e.dataTransfer.setData('text/plain', page.id);
    e.dataTransfer.setData('application/x-page-id', page.id);
    // Use the browser's default drag image. Custom drag images (clones
    // appended to body and removed via setTimeout) cause some browsers
    // to fire dragend prematurely, which can swallow the drop event.
    setDragState({ draggingId: page.id, overId: null, zone: null });
  }, [page.id, setDragState]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragState.draggingId || dragState.draggingId === page.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const zone = computeZone(e.clientY, rect);
    // Only setState when something actually changed to avoid render churn
    // during a long drag across many items.
    setDragState(prev => {
      if (prev.overId === page.id && prev.zone === zone) return prev;
      return { ...prev, overId: page.id, zone };
    });
  }, [dragState.draggingId, page.id, setDragState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when the cursor leaves this item (not when entering a
    // child). relatedTarget is the element being entered; if it's still
    // inside this item, do nothing.
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDragState(prev => {
      if (prev.overId !== page.id) return prev;
      return { ...prev, overId: null, zone: null };
    });
  }, [page.id, setDragState]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Trust the dataTransfer payload first (it's set on dragstart and
    // survives dragover re-renders). Try the custom mime first, then
    // fall back to text/plain, then to state.
    const draggingId =
      e.dataTransfer.getData('application/x-page-id') ||
      e.dataTransfer.getData('text/plain') ||
      dragState.draggingId;
    if (!draggingId || draggingId === page.id) {
      setDragState({ draggingId: null, overId: null, zone: null });
      return;
    }
    const zone = dragState.zone ?? computeZone(e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());

    // Cycle guard: reject if the target is inside the dragging page's
    // subtree (nesting parent under its own descendant creates a cycle).
    // We need the dragging page's full tree, not the flat row, because
    // children aren't denormalized into the flat pages list.
    const draggingPage = flatPages.find(p => p.id === draggingId);
    if (!draggingPage) {
      setDragState({ draggingId: null, overId: null, zone: null });
      return;
    }
    const draggingSubtree = buildDragSubtree(flatPages, draggingId);
    if (draggingSubtree && containsPageId(draggingSubtree, page.id)) {
      setDragState({ draggingId: null, overId: null, zone: null });
      return;
    }

    // Compute new parent_id and position from the drop zone.
    let newParentId: string | null;
    let newPosition: number;

    if (zone === 'center') {
      // Nest: parent becomes the target page; position is at end of its
      // children. If the target has no children, use target's position
      // + 1000 so there's room to insert before if needed later.
      const lastChild = (page.children ?? [])
        .reduce<Page | null>((max, c) => !max || c.position > max.position ? c : max, null);
      newParentId = page.id;
      newPosition = lastChild ? lastChild.position + 1000 : page.position + 1000;
    } else {
      // Sibling reorder: new parent matches the target's parent.
      newParentId = page.parent_id ?? null;
      const siblings = flatPages
        .filter(p => (p.parent_id ?? null) === newParentId)
        .sort((a, b) => a.position - b.position);
      const myIndex = siblings.findIndex(s => s.id === page.id);
      const insertBefore = zone === 'top';
      const ref = insertBefore
        ? (myIndex > 0 ? siblings[myIndex - 1] : null)   // before page: ref = previous sibling
        : siblings[myIndex + 1];                         // after page: ref = next sibling

      const refPos = ref ? ref.position : null;
      const pagePos = page.position;
      if (refPos === null) {
        // No reference sibling — push past the page or use page pos / 2.
        newPosition = insertBefore
          ? Math.max(0, pagePos - 1000)
          : pagePos + 1000;
      } else {
        newPosition = insertBefore
          ? (refPos + pagePos) / 2
          : (pagePos + refPos) / 2;
      }
    }

    // Optimistic local update so the tree moves immediately. The PUT
    // response is treated as the source of truth and `updatePage` already
    // replaces the row in `pages`, so the tree re-renders correctly.
    try {
      await updatePage(draggingId, { parent_id: newParentId, position: newPosition });
      // If we nested into the target, expand it so the user sees the
      // result of the drop.
      if (zone === 'center') setManuallyExpanded(true);
    } catch (err) {
      console.error('Failed to move page', err);
    } finally {
      setDragState({ draggingId: null, overId: null, zone: null });
    }
  }, [dragState, flatPages, page, setDragState, updatePage]);

  // End: parent component listens globally for this.
  const handleDragEnd = useCallback(() => {
    setDragState({ draggingId: null, overId: null, zone: null });
  }, [setDragState]);

  // Keep the active item visible inside .page-list. No smooth scrolling so the
  // first load does not animate; 'nearest' avoids moving when already visible.
  const isActiveItem = currentId === page.id;
  useEffect(() => {
    if (isActiveItem) itemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isActiveItem]);

  if (collapsed) {
    return (
      <div
        ref={itemRef}
        className={`page-item page-item--collapsed ${isActive ? 'active' : ''} ${isDragging ? 'page-item--dragging' : ''}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        title={page.title || t('sidebar.untitledPage')}
        role="button"
        aria-label={`Open ${page.title || t('sidebar.untitledPage')}`}
      >
        <div className="page-item-icon">
          {page.icon || <DocumentIcon size={16} />}
        </div>
      </div>
    );
  }

  const itemClass = [
    'page-item',
    isActive ? 'active' : '',
    isDragging ? 'page-item--dragging' : '',
    dropZone ? `page-item--drop-${dropZone}` : '',
    dropInvalid ? 'page-item--drop-invalid' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div
        ref={itemRef}
        className={itemClass}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className="toggle-btn"
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          onClick={handleToggle}
        >
          {expanded ? <ChevronDownIcon size={12} /> : <ChevronRightSmallIcon size={12} />}
        </div>
        <div className="page-item-icon">
          {page.icon || <DocumentIcon size={16} />}
        </div>
        <div className="page-item-title">{page.title || t('sidebar.untitledPage')}</div>
        <div className="page-item-actions">
          <button className="icon-btn" onClick={handleAddChild} title={t('sidebar.addPageInside')} aria-label={t('sidebar.addPageInside')}>
            <PlusIcon size={16} />
          </button>
          <button className="icon-btn" onClick={handleMenuButton} title={t('page.moreActions')} aria-label={t('page.moreActions')} aria-haspopup="menu">
            <MoreHorizontalIcon size={16} />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="page-children">
          {page.children!.map(child => (
            <PageTreeItem key={child.id} page={child} level={level + 1} collapsed={collapsed} />
          ))}
        </div>
      )}

      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={menuItems}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
});

export function Sidebar({ onOpenSearch }: { onOpenSearch?: () => void } = {}) {
  const { pages, createPage, updatePage, refreshPages } = usePageContext();
  const { workspace } = useWorkspace();
  const tree = useMemo(() => buildPageTree(pages), [pages]);
  const { username, logout } = useAuth();
  const {
    isMobile,
    isNarrow,
    mobileOpen,
    closeMobile,
    desktopCollapsed,
    toggleDesktopCollapsed,
  } = useSidebar();
  const { t } = useLanguage();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const workspaceHeaderRef = useRef<HTMLDivElement | null>(null);
  const userAnchorRef = useRef<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [apiTokenOpen, setApiTokenOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id: currentId } = useParams();
  const { theme, toggleTheme } = useTheme();

  // Drag state shared with PageTreeItem via DragStateContext.
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null, zone: null });

  // Global dragend safety net: if the user drops outside any item (e.g.
  // cancels with Escape, drops on a non-droppable area), make sure the
  // ghost and over-state don't linger.
  useEffect(() => {
    if (!dragState.draggingId) return;
    const reset = () => setDragState({ draggingId: null, overId: null, zone: null });
    window.addEventListener('dragend', reset);
    return () => window.removeEventListener('dragend', reset);
  }, [dragState.draggingId]);

  // Drop at root level: when the user drops on an empty tree area or on
  // the section itself (not on a specific page), move the dragged page
  // to the root of that section, appending at the end.
  const handleRootDrop = useCallback(async (sectionTree: Page[]) => {
    const draggingId = dragState.draggingId;
    if (!draggingId) return;
    const draggingPage = pages.find(p => p.id === draggingId);
    if (!draggingPage) return;
    // Cycle guard: dragging a root-level page onto its own root is fine,
    // but dragging onto a descendant while moving to the root can't
    // happen (descendants are nested, not at root). No cycle risk here.
    const last = sectionTree.reduce<Page | null>((max, p) => !max || p.position > max.position ? p : max, null);
    const newPosition = last ? last.position + 1000 : 1000;
    try {
      await updatePage(draggingId, { parent_id: null, position: newPosition });
    } catch (err) {
      console.error('Failed to move page to root', err);
    } finally {
      setDragState({ draggingId: null, overId: null, zone: null });
    }
  }, [dragState.draggingId, pages, updatePage]);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (!dragState.draggingId) return;
    // Only react if not over a specific item. Items stop propagation on
    // their own dragover so this is a fallback.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [dragState.draggingId]);

  // Recents are per device (localStorage); projects and favorites come from
  // the pages themselves so they are the same on every device.
  const [recentPages, setRecentPages] = useState<RecentPageItem[]>(() => getRecentPages());

  useEffect(() => {
    const updateRecents = () => setRecentPages(getRecentPages());
    window.addEventListener(STORAGE_EVENTS.RECENTS_CHANGED, updateRecents);
    return () => window.removeEventListener(STORAGE_EVENTS.RECENTS_CHANGED, updateRecents);
  }, []);

  // Filter out recents pointing to deleted pages.
  const validRecents = useMemo(() => {
    return recentPages.filter(r => pages.some(p => p.id === r.id)).slice(0, 5);
  }, [recentPages, pages]);

  // Split the tree into Projects and Private sections.
  const projectTree = useMemo(() => {
    return tree.filter(p => p.is_project);
  }, [tree]);

  const privateTree = useMemo(() => {
    return tree.filter(p => !p.is_project);
  }, [tree]);

  const favoritePages = useMemo(() => {
    return pages.filter(p => p.is_favorite);
  }, [pages]);

  useEffect(() => {
    if (isMobile) closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Create new project.
  const handleCreateProject = useCallback(async () => {
    try {
      const newPage = await createPage(null);
      await updatePage(newPage.id, { icon: '', title: 'New Project', is_project: true });
      await refreshPages();
      navigate(`/page/${newPage.id}`);
    } catch (err) {
      console.error('Create project error:', err);
    }
  }, [createPage, updatePage, refreshPages, navigate]);

  // Create new private page.
  const handleCreatePrivatePage = useCallback(async () => {
    try {
      const newPage = await createPage(null);
      await refreshPages();
      navigate(`/page/${newPage.id}`);
    } catch (err) {
      console.error('Create page error:', err);
    }
  }, [createPage, refreshPages, navigate]);

  const isOverlayOpen = (isMobile && mobileOpen) || (!isMobile && isNarrow && !desktopCollapsed);
  const collapsed = !isMobile && desktopCollapsed;

  const sidebarClass = [
    'sidebar',
    isMobile ? 'sidebar--mobile' : 'sidebar--desktop',
    isNarrow && !isMobile ? 'sidebar--narrow' : '',
    isOverlayOpen ? 'sidebar--mobile-open' : '',
    collapsed ? 'sidebar--collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <DragStateContext.Provider value={{ state: dragState, setState: setDragState }}>
      <>
      {isOverlayOpen && (
        <div className="sidebar-overlay" onClick={isMobile ? closeMobile : toggleDesktopCollapsed} aria-hidden="true" />
      )}
      <aside className={sidebarClass} aria-hidden={isOverlayOpen ? false : (isMobile ? !mobileOpen : false)}>
        <div className="sidebar-header">
          {!collapsed && (
            <div className="workspace-name workspace-name--brand">
              {workspace.icon ? (
                <span className="workspace-icon-emoji">{workspace.icon}</span>
              ) : (
                <Logo size={20} variant="icon" />
              )}
              <div className="workspace-brand-text">
                <span className="brand-mark">mark</span>
                <span className="brand-flare">flare</span>
              </div>
            </div>
          )}

          <div className="sidebar-actions">
            {!collapsed && (
              <>
                <button
                  className="sidebar-btn"
                  onClick={() => setImportModalOpen(true)}
                  title={t('sidebar.import')}
                  aria-label={t('sidebar.import')}
                >
                  <DownloadIcon size={16} />
                </button>
                <button
                  className="sidebar-btn"
                  onClick={handleCreatePrivatePage}
                  title={t('sidebar.newPage')}
                  aria-label={t('sidebar.newPage')}
                >
                  <PlusIcon size={16} />
                </button>
                <button
                  className="sidebar-btn"
                  onClick={onOpenSearch}
                  title={`${t('sidebar.search')} (Ctrl+K)`}
                  aria-label={`${t('sidebar.search')} (Ctrl+K)`}
                >
                  <SearchIcon size={16} />
                </button>
              </>
            )}

            <button
              className="sidebar-btn sidebar-btn--toggle"
              onClick={() => isMobile ? closeMobile() : toggleDesktopCollapsed()}
              title={
                isMobile
                  ? t('sidebar.closeSidebar')
                  : (isNarrow && !desktopCollapsed)
                    ? t('sidebar.closeSidebar') + ' (Ctrl+B)'
                    : (desktopCollapsed
                      ? t('sidebar.openSidebar') + ' (Ctrl+B)'
                      : t('sidebar.closeSidebar') + ' (Ctrl+B)')
              }
              aria-label={
                isMobile
                  ? t('sidebar.closeSidebar')
                  : (isNarrow && !desktopCollapsed)
                    ? t('sidebar.closeSidebar')
                    : (desktopCollapsed ? t('sidebar.openSidebar') : t('sidebar.closeSidebar'))
              }
            >
              {(isMobile || (isNarrow && !desktopCollapsed))
                ? <XIcon size={16} />
                : desktopCollapsed
                  ? <Logo size={18} variant="icon" />
                  : <ChevronLeftIcon size={16} />}
            </button>
          </div>
        </div>

        {/* Global search with quick Ctrl+K access */}
        {!collapsed && (
          <div
            className="sidebar-search-row"
            onClick={onOpenSearch}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSearch?.();
              }
            }}
            title={t('sidebar.searchTooltip')}
          >
            <SearchIcon size={14} />
            <span>{t('sidebar.searchPlaceholder')}</span>
            <kbd className="sidebar-kbd">Ctrl K</kbd>
          </div>
        )}

        {/* Structured list: Recents, Projects, Private */}
        <div className="page-list">
          {/* SECTION 0: FAVORITES (only when there is at least one) */}
          {!collapsed && favoritePages.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{t('favorites.title')}</span>
              </div>
              <div className="sidebar-recents-list">
                {favoritePages.map((item) => (
                  <div
                    key={item.id}
                    className={`sidebar-recent-item ${currentId === item.id ? 'active' : ''}`}
                    onClick={() => navigate(`/page/${item.id}`)}
                    role="button"
                    title={item.title}
                  >
                    {item.icon
                      ? <span className="sidebar-recent-icon">{item.icon}</span>
                      : <DocumentIcon size={14} />}
                    <span className="sidebar-recent-title">{item.title || t('sidebar.untitledPage')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 1: RECENTS */}
          {!collapsed && validRecents.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{t('sidebar.recents')}</span>
              </div>
              <div className="sidebar-recents-list">
                {validRecents.map((item) => {
                  const isItemActive = currentId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`sidebar-recent-item ${isItemActive ? 'active' : ''}`}
                      onClick={() => navigate(`/page/${item.id}`)}
                      role="button"
                      title={item.title}
                    >
                      {item.icon && <span className="sidebar-recent-icon">{item.icon}</span>}
                      <span className="sidebar-recent-title">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: PROJECTS */}
          {!collapsed && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{t('sidebar.projects')}</span>
                <button
                  className="sidebar-section-add-btn"
                  onClick={handleCreateProject}
                  title={t('sidebar.newProject')}
                  aria-label={t('sidebar.newProject')}
                >
                  <PlusIcon size={16} />
                </button>
              </div>

              {projectTree.length === 0 ? (
                <div className="sidebar-empty-hint" onClick={handleCreateProject}>
                  <PlusIcon size={16} />
                  <span>{t('sidebar.addProject')}</span>
                </div>
              ) : (
                <div
                  className="sidebar-tree-group"
                  onDragOver={handleRootDragOver}
                  onDrop={() => handleRootDrop(projectTree)}
                >
                  {projectTree.map((page) => (
                    <PageTreeItem key={page.id} page={page} collapsed={collapsed} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: PRIVATE */}
          {!collapsed && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">{t('sidebar.private')}</span>
                <button
                  className="sidebar-section-add-btn"
                  onClick={handleCreatePrivatePage}
                  title={t('sidebar.newPrivatePage')}
                  aria-label={t('sidebar.newPrivatePage')}
                >
                  <PlusIcon size={16} />
                </button>
              </div>

              {privateTree.length === 0 ? (
                <div className="sidebar-empty-hint" onClick={handleCreatePrivatePage}>
                  <PlusIcon size={16} />
                  <span>{t('sidebar.addPrivate')}</span>
                </div>
              ) : (
                <div
                  className="sidebar-tree-group"
                  onDragOver={handleRootDragOver}
                  onDrop={() => handleRootDrop(privateTree)}
                >
                  {privateTree.map((page) => (
                    <PageTreeItem key={page.id} page={page} collapsed={collapsed} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsed (icon-only) view */}
          {collapsed && (
            <div className="sidebar-collapsed-tree">
              {tree.map((page) => (
                <PageTreeItem key={page.id} page={page} collapsed={collapsed} />
              ))}
            </div>
          )}
        </div>

        {/* Trash entry, pinned above the footer */}
        {!collapsed && (
          <button
            type="button"
            className="sidebar-trash-row"
            onClick={() => setTrashOpen(true)}
          >
            <TrashIcon size={15} />
            <span>{t('trash.title')}</span>
          </button>
        )}

        {/* Footer: Profile + Theme toggle */}
        {!collapsed && (
          <div className="sidebar-footer">
            <div
              ref={userAnchorRef}
              className={`sidebar-user sidebar-user--clickable ${userMenuOpen ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(prev => !prev);
              }}
              role="button"
              tabIndex={0}
              title={t('userMenu.title')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setUserMenuOpen(prev => !prev);
                }
              }}
            >
              <div className="sidebar-user-avatar">
                <UserIcon size={14} />
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{username}</span>
                <span className="sidebar-user-role">{username === 'admin' ? t('sidebar.adminRole') : t('sidebar.userRole')}</span>
              </div>
              <MoreHorizontalIcon size={14} className="sidebar-user-more" />
            </div>

            <UserMenuPopover
              open={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              onOpenWorkspaceSettings={() => {
                setSettingsAnchor(userAnchorRef.current?.getBoundingClientRect() ?? null);
                setSettingsOpen(true);
              }}
              onOpenColorPicker={() => {
                setColorPickerOpen(true);
              }}
              onOpenApiToken={() => {
                setApiTokenOpen(true);
              }}
            />

            <div className="sidebar-footer-actions">
              <LanguageSwitcher />
              <button
                className="sidebar-theme-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
                aria-label={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
              >
                {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
              </button>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="sidebar-footer sidebar-footer--collapsed">
            <button
              className="sidebar-btn"
              onClick={() => setTrashOpen(true)}
              title={t('trash.title')}
              aria-label={t('trash.title')}
            >
              <TrashIcon size={16} />
            </button>
            <button
              className="sidebar-btn sidebar-btn--user"
              onClick={() => setUserMenuOpen(prev => !prev)}
              title={username || 'User'}
              aria-label={username || 'User'}
            >
              <UserIcon size={16} />
            </button>
            <UserMenuPopover
              open={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              onOpenWorkspaceSettings={() => {
                setSettingsAnchor(null);
                setSettingsOpen(true);
              }}
              onOpenColorPicker={() => {
                setColorPickerOpen(true);
              }}
              onOpenApiToken={() => {
                setApiTokenOpen(true);
              }}
            />
            <LanguageSwitcher />
            <button
              className="sidebar-btn sidebar-btn--theme"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
              aria-label={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
            >
              {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        )}
      </aside>

      <WorkspaceSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        anchorRect={settingsAnchor}
      />

      <IconColorPickerModal
        open={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
      />

      <ApiTokenModal
        open={apiTokenOpen}
        onClose={() => setApiTokenOpen(false)}
      />

      <TrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
      <TrashToast />

      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={async () => {
          // Refresh so the new page shows up in the tree immediately.
          await refreshPages();
        }}
      />
      </>
    </DragStateContext.Provider>
  );
}