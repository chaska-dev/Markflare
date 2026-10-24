import { useRef, useState } from 'react';
import type React from 'react';
import type { RefObject } from 'react';

// Smallest width (px) the resize handles allow.
export const MEDIA_MIN_WIDTH = 80;

interface Options {
  // The element that fills the column the block lives in (the width cap).
  wrapperRef: RefObject<HTMLElement>;
  // The element being resized.
  figureRef: RefObject<HTMLElement>;
  align: 'left' | 'center' | 'right';
  // props.width as saved, if any.
  savedWidth: number | undefined;
  // Called once, when a drag ends with a new width, and with undefined when a
  // double-click goes back to the natural size.
  onCommit: (width: number | undefined) => void;
}

// Side handles that resize a media block (image, embed) in px, as saved in
// props.width. Spread `handleProps(side)` on each handle element. `liveWidth` is
// the width while a handle is being dragged: local only, saved once on
// pointerup, so a drag doesn't produce a request per pixel.
export function useWidthResize({ wrapperRef, figureRef, align, savedWidth, onCommit }: Options) {
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; side: 'left' | 'right'; max: number; width: number; moved: boolean } | null>(null);

  const startResize = (e: React.PointerEvent<HTMLDivElement>, side: 'left' | 'right') => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const figure = figureRef.current;
    const wrapper = wrapperRef.current;
    if (!figure || !wrapper) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startWidth = figure.getBoundingClientRect().width;
    resizeRef.current = {
      startX: e.clientX,
      startWidth,
      side,
      // The column the block lives in: the wrapper fills it.
      max: Math.max(MEDIA_MIN_WIDTH, Math.floor(wrapper.getBoundingClientRect().width)),
      width: startWidth,
      moved: false,
    };
  };

  const moveResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    // A centered block grows on both sides at once, so the dragged edge has to
    // travel twice as far to stay under the pointer.
    const delta = (e.clientX - r.startX) * (r.side === 'right' ? 1 : -1) * (align === 'center' ? 2 : 1);
    r.width = Math.round(Math.min(r.max, Math.max(MEDIA_MIN_WIDTH, r.startWidth + delta)));
    r.moved = true;
    setLiveWidth(r.width);
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const r = resizeRef.current;
    if (!r) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setLiveWidth(null);
    if (commit && r.moved && r.width !== savedWidth) onCommit(r.width);
  };

  const handleProps = (side: 'left' | 'right') => ({
    draggable: false as const,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => startResize(e, side),
    onPointerMove: moveResize,
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => endResize(e, true),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => endResize(e, false),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (savedWidth !== undefined) onCommit(undefined);
    },
  });

  return { liveWidth, handleProps };
}
