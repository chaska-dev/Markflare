import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Page } from '../types';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import { readLegacyPageSettings, clearLegacyPageSettings } from '../utils/workspaceStorage';

// The last page(s) sent to Trash, so the UI can offer an "Undo" right after.
export interface TrashedNotice {
  id: string;
  title: string;
  // How many pages went to Trash (the page plus its subpages).
  count: number;
}

export interface PageContextType {
  pages: Page[];
  loading: boolean;
  currentPageId: string | null;
  setCurrentPageId: (id: string | null) => void;
  createPage: (parentId?: string | null) => Promise<Page>;
  updatePage: (id: string, data: Partial<Page>) => Promise<void>;
  // Moves the page and its subpages to Trash (reversible with restorePage).
  deletePage: (id: string) => Promise<void>;
  restorePage: (id: string) => Promise<Page>;
  duplicatePage: (id: string) => Promise<Page>;
  toggleFavorite: (id: string) => Promise<void>;
  lastTrashed: TrashedNotice | null;
  dismissLastTrashed: () => void;
  refreshPages: () => Promise<void>;
  getPageBreadcrumbs: (id: string) => Page[];
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function buildPageTree(pages: Page[]): Page[] {
  const pageMap = new Map<string, Page>();
  const rootPages: Page[] = [];

  pages.forEach(p => {
    pageMap.set(p.id, { ...p, children: [] });
  });

  pages.forEach(p => {
    const pageWithChildren = pageMap.get(p.id)!;
    if (p.parent_id && pageMap.has(p.parent_id)) {
      const parent = pageMap.get(p.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(pageWithChildren);
      parent.children.sort((a, b) => a.position - b.position);
    } else {
      rootPages.push(pageWithChildren);
    }
  });

  rootPages.sort((a, b) => a.position - b.position);
  return rootPages;
}

export function PageProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lastTrashed, setLastTrashed] = useState<TrashedNotice | null>(null);
  const navigate = useNavigate();

  // Mirror of `pages` for async handlers, which would otherwise read the list
  // captured by an older render.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const refreshPages = async () => {
    try {
      const res = await api.pages.list();
      setPages(res.pages);
      setLoaded(true);
    } catch (e) {
      console.error('Failed to load pages', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPages();
  }, []);

  // One-time upgrade: projects and covers used to be stored only in this
  // browser's localStorage. Once the page list is known, upload them to the
  // server (skipping anything the server already has) and drop the old keys.
  // If any upload fails the keys stay, so the next load retries.
  useEffect(() => {
    if (!loaded) return;
    const legacy = readLegacyPageSettings();
    if (!legacy) return;

    const byId = new Map(pagesRef.current.map(p => [p.id, p]));
    const ids = new Set([...legacy.projects, ...Object.keys(legacy.covers)]);
    const jobs: Promise<unknown>[] = [];
    ids.forEach(id => {
      const page = byId.get(id);
      if (!page) return; // deleted since; nothing to carry over
      const patch: Partial<Pick<Page, 'is_project' | 'cover'>> = {};
      if (legacy.projects.includes(id) && !page.is_project && !page.parent_id) patch.is_project = true;
      const cover = legacy.covers[id];
      if (typeof cover === 'string' && cover && !page.cover) patch.cover = cover;
      if (Object.keys(patch).length > 0) jobs.push(api.pages.update(id, patch));
    });

    Promise.allSettled(jobs).then(results => {
      if (results.every(r => r.status === 'fulfilled')) clearLegacyPageSettings();
      if (jobs.length > 0) refreshPages();
    });
  }, [loaded]);

  const createPage = async (parentId?: string | null) => {
    const res = await api.pages.create({ parent_id: parentId });
    setPages(prev => [...prev, res.page]);
    navigate(`/page/${res.page.id}`);
    return res.page;
  };

  // Optimistic: the change shows immediately (toggles, covers) and the PUT
  // response then replaces the row as the source of truth. On failure the
  // touched fields roll back and the error is re-thrown to the caller.
  const updatePage = async (id: string, data: Partial<Page>) => {
    const previous = pagesRef.current.find(p => p.id === id);
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    try {
      const res = await api.pages.update(id, data);
      setPages(prev => prev.map(p => p.id === id ? res.page : p));
    } catch (e) {
      if (previous) {
        const rollback: Record<string, unknown> = {};
        for (const key of Object.keys(data)) rollback[key] = (previous as any)[key];
        setPages(prev => prev.map(p => p.id === id ? { ...p, ...rollback } : p));
      }
      throw e;
    }
  };

  const deletePage = async (id: string) => {
    const current = pagesRef.current;
    await api.pages.delete(id);

    // The page and everything under it leave the tree together.
    const removed = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of current) {
        if (p.parent_id && removed.has(p.parent_id) && !removed.has(p.id)) {
          removed.add(p.id);
          grew = true;
        }
      }
    }
    setPages(prev => prev.filter(p => !removed.has(p.id)));
    setLastTrashed({
      id,
      title: current.find(p => p.id === id)?.title ?? '',
      count: removed.size,
    });

    if (currentPageId && removed.has(currentPageId)) {
      const remainingPages = current.filter(p => !removed.has(p.id));
      if (remainingPages.length > 0) {
        navigate(`/page/${remainingPages[0].id}`);
      } else {
        navigate('/');
      }
    }
  };

  const restorePage = async (id: string) => {
    const res = await api.pages.restore(id);
    setLastTrashed(prev => (prev && prev.id === id ? null : prev));
    await refreshPages();
    return res.page;
  };

  const duplicatePage = async (id: string) => {
    const res = await api.pages.duplicate(id);
    setPages(prev => [...prev, res.page]);
    navigate(`/page/${res.page.id}`);
    return res.page;
  };

  const toggleFavorite = async (id: string) => {
    const page = pagesRef.current.find(p => p.id === id);
    if (!page) return;
    await updatePage(id, { is_favorite: !page.is_favorite });
  };

  const dismissLastTrashed = () => setLastTrashed(null);

  const getPageBreadcrumbs = (id: string): Page[] => {
    const breadcrumbs: Page[] = [];
    let current = pages.find(p => p.id === id);
    while (current) {
      breadcrumbs.unshift(current);
      if (current.parent_id) {
        current = pages.find(p => p.id === current?.parent_id);
      } else {
        break;
      }
    }
    return breadcrumbs;
  };

  return (
    <PageContext.Provider value={{
      pages,
      loading,
      currentPageId,
      setCurrentPageId,
      createPage,
      updatePage,
      deletePage,
      restorePage,
      duplicatePage,
      toggleFavorite,
      lastTrashed,
      dismissLastTrashed,
      refreshPages,
      getPageBreadcrumbs
    }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePageContext must be used within PageProvider');
  return ctx;
}
