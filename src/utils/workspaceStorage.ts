// Local storage utilities for Markflare. Only per-device state lives here
// (recent pages); everything that should follow the user across devices is
// stored with the page in the database.

export interface RecentPageItem {
  id: string;
  title: string;
  icon?: string;
  timestamp: number;
}

const STORAGE_KEYS = {
  RECENTS: 'markflare_recents',
  PROJECTS: 'markflare_projects',
  COVERS: 'markflare_covers',
};

// Custom events for cross-component reactivity.
export const STORAGE_EVENTS = {
  RECENTS_CHANGED: 'markflare:recents_changed',
};

function dispatchChange(eventName: string) {
  window.dispatchEvent(new Event(eventName));
}

// Recents

export function getRecentPages(): RecentPageItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Read recents error:', e);
    return [];
  }
}

export function addRecentPage(page: { id: string; title: string; icon?: string }) {
  if (!page.id) return;
  try {
    const current = getRecentPages();
    // Filter existing entries to put the new one on top.
    const filtered = current.filter(item => item.id !== page.id);
    const updated: RecentPageItem[] = [
      {
        id: page.id,
        title: page.title || 'Untitled',
        icon: page.icon || '',
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, 8); // keep up to 8 recent pages

    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(updated));
    dispatchChange(STORAGE_EVENTS.RECENTS_CHANGED);
  } catch (e) {
    console.error('Save recent error:', e);
  }
}

export function removeRecentPage(id: string) {
  try {
    const current = getRecentPages();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(updated));
    dispatchChange(STORAGE_EVENTS.RECENTS_CHANGED);
  } catch (e) {
    console.error('Remove recent error:', e);
  }
}

// Legacy projects / covers
//
// Projects and covers used to live only in this browser's localStorage, so they
// never followed the user to another device. They are now columns on the page
// (`is_project`, `cover`). These helpers only read the old keys once so the
// page provider can upload them to the server, then drop them.

export interface LegacyPageSettings {
  projects: string[];
  covers: Record<string, string>;
}

export function readLegacyPageSettings(): LegacyPageSettings | null {
  try {
    const rawProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    const rawCovers = localStorage.getItem(STORAGE_KEYS.COVERS);
    if (rawProjects === null && rawCovers === null) return null;

    const projects = rawProjects ? JSON.parse(rawProjects) : [];
    const covers = rawCovers ? JSON.parse(rawCovers) : {};
    return {
      projects: Array.isArray(projects) ? projects.filter((id): id is string => typeof id === 'string') : [],
      covers: covers && typeof covers === 'object' && !Array.isArray(covers) ? covers : {},
    };
  } catch (e) {
    console.error('Read legacy page settings error:', e);
    return null;
  }
}

export function clearLegacyPageSettings() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.COVERS);
  } catch (e) {
    console.error('Clear legacy page settings error:', e);
  }
}
