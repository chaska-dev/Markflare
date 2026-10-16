import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

interface SidebarContextType {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  desktopCollapsed: boolean;
  toggleDesktopCollapsed: () => void;
  isMobile: boolean;
  // "narrow" = viewport between mobile and desktop (768 ≤ width < 1100).
  // In this range the sidebar starts collapsed (icon-only) and expands as an
  // overlay over the content. On mobile (<768) it stays a regular drawer.
  isNarrow: boolean;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

const MOBILE_BREAKPOINT = 768;
const NARROW_BREAKPOINT = 1100;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// narrow = tablet / small laptop. 768 ≤ width < 1100. Excludes mobile.
function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    return w >= MOBILE_BREAKPOINT && w < NARROW_BREAKPOINT;
  });
  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      setIsNarrow(w >= MOBILE_BREAKPOINT && w < NARROW_BREAKPOINT);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isNarrow;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const isNarrow = useIsNarrow();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Initialize collapsed by viewport width: narrow starts collapsed, wide
  // desktop starts expanded. Once the user toggles, their preference sticks
  // (we don't re-sync on resize).
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    return w >= MOBILE_BREAKPOINT && w < NARROW_BREAKPOINT;
  });

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen(prev => !prev), []);
  const toggleDesktopCollapsed = useCallback(() => setDesktopCollapsed(prev => !prev), []);

  // Scroll lock on mobile while the drawer is open. The real scroller is
  // .main-content (see scroll.css), so a class on <html> locks it too without
  // this provider needing a ref to Layout's element.
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('sidebar-scroll-locked');
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove('sidebar-scroll-locked');
    };
  }, [isMobile, mobileOpen]);

  // Cmd/Ctrl+B shortcut to collapse on desktop.
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleDesktopCollapsed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, toggleDesktopCollapsed]);

  return (
    <SidebarContext.Provider value={{
      mobileOpen,
      openMobile,
      closeMobile,
      toggleMobile,
      desktopCollapsed,
      toggleDesktopCollapsed,
      isMobile,
      isNarrow,
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}