import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const STORAGE_PREFIX = 'markflare:scroll:';

// In-memory map is the source of truth; sessionStorage only survives reloads.
const positions = new Map<string, number>();

function readPosition(pageId: string): number | undefined {
  const cached = positions.get(pageId);
  if (cached !== undefined) return cached;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + pageId);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writePosition(pageId: string, top: number) {
  positions.set(pageId, top);
  try {
    sessionStorage.setItem(STORAGE_PREFIX + pageId, String(Math.round(top)));
  } catch {
    // Private mode / quota: the in-memory copy is enough.
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Remembers the scrollTop of the main scroll container per page and restores
 * it when coming back. `ready` must flip to true only once the page content is
 * rendered (otherwise the container is too short to scroll and the position
 * would be clamped). A `#block-<id>` hash wins over the saved position.
 */
export function usePageScrollMemory(
  pageId: string | undefined,
  ready: boolean,
  containerRef: RefObject<HTMLElement>,
  hash: string,
) {
  // Only track scrolls while the content of `pageId` is actually on screen.
  // While loading, the spinner shrinks the container and the browser clamps
  // scrollTop to 0; saving that would wipe the real position.
  const trackingRef = useRef(false);
  const lastTopRef = useRef(0);

  // Persist on leave; the page id change is the only moment the old value is known.
  useEffect(() => {
    if (!pageId) return;
    return () => {
      if (trackingRef.current) writePosition(pageId, lastTopRef.current);
      trackingRef.current = false;
    };
  }, [pageId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pageId) return;
    let raf = 0;
    const onScroll = () => {
      if (!trackingRef.current || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!trackingRef.current) return;
        lastTopRef.current = el.scrollTop;
        writePosition(pageId, el.scrollTop);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pageId, containerRef]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !pageId || !ready) return;

    // Two frames: first lets React paint the blocks, second lets layout settle
    // (fonts, code blocks) so the target offset exists.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const anchor = hash.startsWith('#block-')
          ? document.getElementById(safeDecode(hash.slice(1)))
          : null;
        if (anchor) {
          anchor.scrollIntoView({ block: 'start' });
        } else {
          el.scrollTop = readPosition(pageId) ?? 0;
        }
        lastTopRef.current = el.scrollTop;
        trackingRef.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [pageId, ready, hash, containerRef]);
}
