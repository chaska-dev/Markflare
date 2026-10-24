// Table block helpers, shared by the editor (Block.tsx) and the shared view.
// A table's data is JSON in block.content ({columns, rows}, where `columns` is
// the first row of the grid); its display options live in block.props:
// headerRow (default true), headerColumn and colWidths (px per column).

import type { BlockProps } from '../types';

export interface TableData {
  columns: string[];
  rows: string[][];
}

// Rows of the whole table, the header row (`columns`) first.
export type TableGrid = string[][];

export const TABLE_MIN_COL_WIDTH = 60;
export const TABLE_MAX_COL_WIDTH = 1000;
// Width of a column without a saved one, once the table has fixed widths.
export const TABLE_DEFAULT_COL_WIDTH = 120;

const cellText = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

// `columnLabel(n)` names the default columns, so the caller can localise them.
// Rows are padded/cut to the number of columns, so old or hand-written content
// with ragged rows still loads as a rectangle.
export function parseTableData(raw: string, columnLabel: (n: number) => string): TableData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows) && parsed.columns.length > 0) {
      const columns: string[] = parsed.columns.map(cellText);
      const rows: string[][] = parsed.rows
        .filter(Array.isArray)
        .map((r: unknown[]) => columns.map((_, i) => cellText(r[i])));
      return { columns, rows };
    }
  } catch {
    // fallthrough to default
  }
  return { columns: [columnLabel(1), columnLabel(2)], rows: [['', ''], ['', '']] };
}

export const toGrid = (data: TableData): TableGrid => [data.columns, ...data.rows];

export const fromGrid = (grid: TableGrid): TableData => ({ columns: grid[0], rows: grid.slice(1) });

export function insertAt<T>(items: T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

// Display options of a table. Missing or invalid props fall back to the
// defaults, which is what tables saved before props existed look like.
// `colWidths` is null while the table has no saved widths (auto layout);
// otherwise it has exactly one entry per column.
export function tableOptions(props: BlockProps | undefined, columnCount: number) {
  const saved = props?.colWidths;
  let colWidths: number[] | null = null;
  if (Array.isArray(saved) && saved.some(w => typeof w === 'number' && w > 0)) {
    colWidths = Array.from({ length: columnCount }, (_, i) => {
      const w = saved[i];
      return typeof w === 'number' && w > 0
        ? Math.min(TABLE_MAX_COL_WIDTH, Math.max(TABLE_MIN_COL_WIDTH, w))
        : TABLE_DEFAULT_COL_WIDTH;
    });
  }
  return {
    headerRow: props?.headerRow !== false,
    headerColumn: props?.headerColumn === true,
    colWidths,
  };
}

// Parse text copied from a spreadsheet: tabs split cells, newlines split rows,
// and a "quoted" cell may hold tabs and newlines ("" is an escaped quote).
export function parseTsv(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  // The last line usually has no terminator; a trailing newline adds no row.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
