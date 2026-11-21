import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Block } from '../types';
import { useScrollContainer } from '../hooks/useScrollContainer';
import { documentOrder } from '../utils/blockSelection';

interface Props {
  blocks: Block[];
}

interface HeadingItem {
  id: string;
  type: string;
  text: string;
  level: number;
}

export function DocumentOutline({ blocks }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredHeading, setHoveredHeading] = useState<HeadingItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number } | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useScrollContainer();

  // Filter and normalize headings. Document order, not the list's: positions
  // only compare among siblings, and the headings inside columns (which restart
  // at the same positions) have to come out column by column.
  const headings: HeadingItem[] = useMemo(() => {
    const order = new Map(documentOrder(blocks || []).map((id, i) => [id, i]));
    return (blocks || [])
      .filter(b => b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3')
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(b => {
        const clean = (b.content || '')
          .replace(/^#+\s*/, '')
          .replace(/[*_~`]/g, '')
          .trim();

        return {
          id: b.id,
          type: b.type,
          text: clean || (b.type === 'heading1' ? 'Heading 1' : b.type === 'heading2' ? 'Heading 2' : 'Heading 3'),
          level: b.type === 'heading1' ? 1 : b.type === 'heading2' ? 2 : 3,
        };
      });
  }, [blocks]);

  // ScrollSpy: detect which heading is currently active based on scroll position.
  useEffect(() => {
    if (headings.length === 0) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const headingElements = headings
        .map(h => ({
          id: h.id,
          el: document.getElementById(`block-${h.id}`),
        }))
        .filter((h): h is { id: string; el: HTMLElement } => h.el !== null);

      if (headingElements.length === 0) return;

      const threshold = 180;
      let currentActiveId = headingElements[0].id;

      for (const { id, el } of headingElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          currentActiveId = id;
        } else {
          break;
        }
      }

      setActiveId(currentActiveId);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [headings, scrollContainerRef]);

  // Hide the rail for short notes (less than 2 headings) to avoid clutter.
  if (headings.length < 2) {
    return null;
  }

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(`block-${id}`);
    const scrollContainer = scrollContainerRef.current;

    if (el && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollTop = scrollContainer.scrollTop + (elRect.top - containerRect.top) - 40;

      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
      setActiveId(id);
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, h: HeadingItem) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const railRect = railRef.current?.getBoundingClientRect();
    if (railRect) {
      setTooltipPos({ top: rect.top - railRect.top + rect.height / 2 });
    }
    setHoveredHeading(h);
  };

  const handleMouseLeave = () => {
    setHoveredHeading(null);
  };

  return (
    <nav
      ref={railRef}
      className="document-outline-rail"
      aria-label="Section navigation"
      onMouseLeave={handleMouseLeave}
    >
      <div className="document-outline-capsules">
        {headings.map((h) => {
          const isActive = activeId === h.id;
          const isHovered = hoveredHeading?.id === h.id;

          return (
            <button
              key={h.id}
              type="button"
              className={`outline-capsule outline-capsule--level-${h.level} ${isActive ? 'is-active' : ''} ${isHovered ? 'is-hovered' : ''}`}
              onClick={() => handleScrollTo(h.id)}
              onMouseEnter={(e) => handleMouseEnter(e, h)}
              aria-label={`${h.type.toUpperCase()}: ${h.text}`}
              aria-current={isActive ? 'location' : undefined}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {hoveredHeading && tooltipPos && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="outline-tooltip"
            style={{ top: tooltipPos.top }}
          >
            <span className={`outline-tooltip-badge outline-tooltip-badge--h${hoveredHeading.level}`}>
              H{hoveredHeading.level}
            </span>
            <span className="outline-tooltip-text">{hoveredHeading.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
