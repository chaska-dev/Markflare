import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { MenuIcon } from './Icons';
import { SearchModal } from './SearchModal';
import { ScrollContainerContext } from '../hooks/useScrollContainer';

export function Layout() {
  const { isMobile, mobileOpen, toggleMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  // Shared with PageView / DocumentOutline / SlashMenu: `.main-content` is the real scroller.
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="layout">
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <main className="main-content" ref={mainRef}>
        {isMobile && !mobileOpen && (
          <button
            className="mobile-sidebar-toggle"
            onClick={toggleMobile}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <MenuIcon size={18} />
          </button>
        )}
        <ScrollContainerContext.Provider value={mainRef}>
          <Outlet />
        </ScrollContainerContext.Provider>
      </main>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
