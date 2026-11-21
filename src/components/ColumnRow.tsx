import React, { useEffect, useRef, useState } from 'react';
import { Block } from '../types';
import { columnFractions, resizePair } from '../utils/columns';

// One column_list drawn as a row of side-by-side columns. Used by the editor and
// by the read-only shared view; the caller renders the blocks of each column
// (`children`), so both keep their own block components. On narrow screens the
// CSS stacks the columns (see .block-columns in editor.css).
//
// Each column takes its share of the row (props.width, see columnFractions) and,
// in the editor, a divider between two columns can be dragged. The new widths
// are shown while dragging and handed to `onResize` once, on pointerup, so the
// whole drag is a single change.

export interface ColumnRowColumn {
  block: Block;
  // React key when it must outlive the block's id (see columnKeysRef in BlockEditor).
  key?: string;
  children: React.ReactNode;
}

interface Props {
  columns: ColumnRowColumn[];
  // Saves widths; null puts a column back to its equal share. Absent in the
  // read-only view, which has no dividers to drag.
  onResize?: (updates: { id: string; width: number | null }[]) => void;
  resizeLabel?: string;
}

interface Drag {
  index: number;
  startX: number;
  // Pixels the columns take together, to turn the pointer travel into a share.
  total: number;
  start: number[];
  next: number[];
}

const round = (n: number) => Math.round(n * 10000) / 10000;

export function ColumnRow({ columns, onResize, resizeLabel }: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const fractions = columnFractions(columns.map(c => c.block));
  const signature = fractions.join(',');
  // Widths while a divider is dragged. They stay until the saved ones arrive
  // (the signature changes), so the columns don't jump back for a frame.
  const [live, setLive] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const shown = live && live.length === fractions.length ? live : fractions;

  useEffect(() => {
    setLive(null);
  }, [signature]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    const row = rowRef.current;
    if (e.button !== 0 || !onResize || !row) return;
    const total = Array.from(row.querySelectorAll<HTMLElement>(':scope > .block-column'))
      .reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
    if (total <= 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { index, startX: e.clientX, total, start: fractions, next: fractions };
    setDragging(true);
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const [left, right] = resizePair(drag.start[drag.index], drag.start[drag.index + 1], (e.clientX - drag.startX) / drag.total);
    const next = drag.start.slice();
    next[drag.index] = left;
    next[drag.index + 1] = right;
    drag.next = next;
    setLive(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!commit || drag.next === drag.start) {
      setLive(null);
      return;
    }
    // The two columns that moved, plus any other column that already has a
    // width, so the saved set keeps adding up to the whole row.
    const updates = columns.flatMap((c, i) => {
      const moved = i === drag.index || i === drag.index + 1;
      const stored = typeof c.block.props?.width === 'number';
      return moved || stored ? [{ id: c.block.id, width: round(drag.next[i]) }] : [];
    });
    setLive(drag.next.map(round));
    onResize?.(updates);
  };

  const resetWidths = () => {
    const updates = columns
      .filter(c => c.block.props?.width !== undefined)
      .map(c => ({ id: c.block.id, width: null }));
    if (updates.length > 0) onResize?.(updates);
  };

  return (
    <div
      ref={rowRef}
      className={`block-columns${onResize ? '' : ' block-columns--readonly'}${dragging ? ' block-columns--resizing' : ''}`}
    >
      {columns.map((column, i) => (
        <React.Fragment key={column.key ?? column.block.id}>
          {i > 0 && (
            <div className="block-column-gutter">
              {onResize && (
                <div
                  className="block-column-resize"
                  role="separator"
                  aria-orientation="vertical"
                  title={resizeLabel}
                  onPointerDown={(e) => startDrag(e, i - 1)}
                  onPointerMove={moveDrag}
                  onPointerUp={(e) => endDrag(e, true)}
                  onPointerCancel={(e) => endDrag(e, false)}
                  onDoubleClick={resetWidths}
                />
              )}
            </div>
          )}
          <div className="block-column" style={{ flex: `${shown[i]} 1 0%` }}>
            {column.children}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
