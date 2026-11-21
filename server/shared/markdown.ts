// Parser markdown → bloques.
// Compartido entre el backend Hono (Cloudflare) y el server Express (local),
// así no duplicamos lógica en dos archivos. Mantenerlo puro (sin I/O) y
// determinístico.

import { parseBlockProps } from './blockProps';

export type ParsedBlock = {
  type: string;
  content: string;
  checked: boolean;
  language?: string;
};

export type ImportToken =
  | { kind: 'code'; lines: string[]; language?: string }
  | { kind: 'table'; lines: string[] }
  | { kind: 'lines'; lines: string[] };

function isTableHeader(line: string): boolean {
  const trimmed = line.trim();
  return /^\|.*\|$/.test(trimmed) && trimmed.indexOf('|', 1) !== -1;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  // | --- | --- |  o  |:---|:---:|---:|  o  --- | ---
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(trimmed) && /-+/.test(trimmed);
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return /^\|.*\|$/.test(trimmed);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    // Cells render inline markdown (bold, links, code), so it is kept as is.
    .map(c => c.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines: string[]): { columns: string[]; rows: string[][] } {
  const columns = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);
  // Pad/truncate rows so they all have the same number of cells.
  const normalized = rows.map(row => {
    if (row.length < columns.length) {
      return [...row, ...Array(columns.length - row.length).fill('')];
    }
    if (row.length > columns.length) {
      return row.slice(0, columns.length);
    }
    return row;
  });
  return { columns, rows: normalized };
}

function preprocessImports(rawLines: string[]): ImportToken[] {
  const tokens: ImportToken[] = [];
  let i = 0;
  let prevLine: string | null = null;
  // Whether the current block (run of non-blank lines) started with a list
  // item. Reset on each new run. This protects us from bullets that continue
  // over multiple lines (some indented with 4+ spaces) where the previous
  // line is the wrapped continuation, not the bullet itself.
  let blockStartedWithListItem = false;
  let lineBuf: string[] = [];

  const flushLines = () => {
    if (lineBuf.length > 0) {
      tokens.push({ kind: 'lines', lines: lineBuf });
      lineBuf = [];
    }
  };

  while (i < rawLines.length) {
    const line = rawLines[i];

    // Blank line: emit the accumulated buffer and move on. We do NOT include
    // the blank line in the buffer (it would be an empty paragraph).
    if (line.trim() === '') {
      flushLines();
      prevLine = line;
      i++;
      continue;
    }

    // Start of a new non-blank run: detect if it began with a list item.
    if (prevLine === null || prevLine.trim() === '') {
      blockStartedWithListItem = /^[ \t]*[-*+]\s/.test(line);
    }

    // Fenced code block: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const language = match ? match[1] : '';
      const codeLines: string[] = [];
      // Emit pending lines first so the blocks keep their document order.
      flushLines();
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // skip closing ```
      tokens.push({ kind: 'code', lines: codeLines, language });
      prevLine = '```';
      continue;
    }

    // HTML image: <p align="center"><img ...></p> or just <img ...>
    if (line.trim().startsWith('<p') || line.trim().startsWith('<img')) {
      let pHtml = line;
      let j = i + 1;
      if (line.trim().startsWith('<p') && !line.includes('</p>')) {
        while (j < rawLines.length && !rawLines[j - 1].includes('</p>') && j - i < 8) {
          pHtml += ' ' + rawLines[j].trim();
          j++;
        }
      }
      const imgMatch = pHtml.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch) {
        flushLines();
        const src = imgMatch[1];
        const altMatch = pHtml.match(/alt=["']([^"']+)["']/i);
        const alt = altMatch ? altMatch[1] : '';
        tokens.push({ kind: 'lines', lines: [`![${alt}](${src})`] });
        i = j;
        prevLine = '</p>';
        continue;
      }
    }

    // Indented code block (standard markdown: 4+ spaces = code).
    // BUT CommonMark says an indented code block can't interrupt a
    // paragraph: it must be preceded by a blank line. If the previous line
    // isn't blank (or this is the start of the document), indented lines
    // are a wrapped list item / paragraph, NOT code. This prevents
    // bullets with manual wraps from being broken into code blocks.
    const prevIsBlank = prevLine === null || prevLine.trim() === '';
    if (/^( {4,}|\t)/.test(line) && prevIsBlank) {
      flushLines();
      const codeLines: string[] = [];
      while (i < rawLines.length && /^( {4,}|\t)/.test(rawLines[i])) {
        codeLines.push(rawLines[i].replace(/^( {4}|\t)/, ''));
        i++;
      }
      tokens.push({ kind: 'code', lines: codeLines });
      prevLine = codeLines[codeLines.length - 1] ?? '';
      continue;
    }

    // GFM table: header row + separator + data rows (consecutive, no blanks).
    if (isTableHeader(line) && i + 1 < rawLines.length && isTableSeparator(rawLines[i + 1])) {
      flushLines();
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim() !== '' && isTableRow(rawLines[i])) {
        tableLines.push(rawLines[i]);
        i++;
      }
      tokens.push({ kind: 'table', lines: tableLines });
      prevLine = tableLines[tableLines.length - 1] ?? '';
      continue;
    }

    // ASCII art block: look ahead — if the next 2+ non-blank lines have 2+
    // consecutive spaces somewhere, it's probably layout. Requires at least
    // 2 lines so we don't convert normal paragraphs into code.
    // Leading indentation doesn't count: nested list items are indented too.
    const isAsciiArtish = (s: string) => /\S {2,}/.test(s);
    let j = i;
    let artLines: string[] = [];
    let artHits = 0;
    while (j < rawLines.length && rawLines[j].trim() !== '') {
      artLines.push(rawLines[j]);
      if (isAsciiArtish(rawLines[j])) artHits++;
      j++;
    }
    // If the current run started with a list item, it's a bullet with manual
    // wrap — NOT ASCII art. (We check blockStartedWithListItem because
    // looking only at the first line of the block fails when the wrap starts
    // with the indented continuation, not the bullet.)
    if (artLines.length >= 2 && artHits >= 1 && !blockStartedWithListItem) {
      flushLines();
      tokens.push({ kind: 'code', lines: artLines });
      i = j;
      prevLine = artLines[artLines.length - 1] ?? '';
      continue;
    }

    // Normal line: add to buffer. On blank line (or end of document), emit
    // the buffer as a single token.
    lineBuf.push(line);
    prevLine = line;
    i++;
  }
  flushLines();
  return tokens;
}

/**
 * Strip markdown emphasis markers that the editor doesn't render inline.
 * - **bold**, __bold__
 * - *italic*, _italic_
 * - `inline code` → we remove the backticks (to avoid visual noise) but
 *   preserve the content INSIDE backticks so `_` and `*` inside identifiers
 *   like `business:credit_note:role_check_missing` survive.
 *
 * We mask inline code with placeholders before applying the regexes and
 * restore at the end, so names with underscores don't get torn apart.
 */
function stripEmphasis(s: string): string {
  const codeStash: string[] = [];
  const masked = s.replace(/`([^`]+)`/g, (_, code) => {
    codeStash.push(code);
    return `\u0000${codeStash.length - 1}\u0000`;
  });
  const stripped = masked
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '$1')
    .replace(/==([^=]+)==/g, '$1');
  return stripped.replace(/\u0000(\d+)\u0000/g, (_, i) => codeStash[Number(i)]);
}

function parseLine(rawLine: string): ParsedBlock | null {
  const trimmed = rawLine.trim();
  if (trimmed === '') return null;

  // Empty blockquote line (`>` alone or with spaces). It's a separator
  // inside the quote — drop it so it doesn't show as a paragraph with a
  // literal `>`. Common when markdown has a trailing `> ` to "close" a
  // blockquote or add an empty paragraph inside.
  if (trimmed === '>') return null;

  // Empty or closing HTML container tags.
  if (/^<\/?(p|div|center|span|br)[^>]*>$/i.test(trimmed)) return null;

  let type = 'paragraph';
  let content = trimmed;
  let checked = false;

  if (trimmed.startsWith('# ')) {
    type = 'heading1';
    content = stripEmphasis(trimmed.slice(2).trim());
  } else if (trimmed.startsWith('## ')) {
    type = 'heading2';
    content = stripEmphasis(trimmed.slice(3).trim());
  } else if (trimmed.startsWith('### ')) {
    type = 'heading3';
    content = stripEmphasis(trimmed.slice(4).trim());
  } else if (/^(Slide|Step|Section|Capítulo|Parte|Chapter|Etapa)\s+\d+/i.test(trimmed)) {
    // Headings without #: "Slide 1 — Portada", "Step 3: Build", etc.
    type = 'heading1';
    content = stripEmphasis(trimmed.replace(/^(Slide|Step|Section|Capítulo|Parte|Chapter|Etapa)\s+\d+\s*[-—:.|]\s*/i, ''));
    if (!content) content = stripEmphasis(trimmed);
  } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
    type = 'todo';
    content = stripEmphasis(trimmed.slice(6).trim());
    checked = false;
  } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ') || trimmed.startsWith('* [x] ')) {
    type = 'todo';
    content = stripEmphasis(trimmed.slice(6).trim());
    checked = true;
  } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    type = 'bullet_list';
    content = stripEmphasis(trimmed.slice(2).trim());
  } else if (/^\d+\.\s/.test(trimmed)) {
    type = 'numbered_list';
    content = stripEmphasis(trimmed.replace(/^\d+\.\s+/, '').trim());
  } else if (/^!\[(.*?)\]\((.*?)\)$/.test(trimmed)) {
    const match = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    return {
      type: 'image',
      content: match ? match[2].trim() : '',
      checked: false,
      language: match ? match[1].trim() : '',
    };
  } else if (/<img\s+[^>]*src=["']([^"']+)["']/i.test(trimmed)) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    const altMatch = trimmed.match(/alt=["']([^"']+)["']/i);
    return {
      type: 'image',
      content: srcMatch ? srcMatch[1].trim() : '',
      checked: false,
      language: altMatch ? altMatch[1].trim() : '',
    };
  } else if (/^\$\$(.*?)\$\$$/.test(trimmed)) {
    const match = trimmed.match(/^\$\$(.*?)\$\$$/);
    type = 'math';
    content = match ? match[1].trim() : '';
  } else if (trimmed.startsWith('> 💡') || trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('> [!TIP]')) {
    type = 'callout';
    content = stripEmphasis(trimmed.replace(/^>\s*(💡|\[![A-Z]+\])?\s*/, '').trim());
  } else if (trimmed.startsWith('> ')) {
    type = 'quote';
    content = stripEmphasis(trimmed.slice(2).trim());
  } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
    type = 'divider';
    content = '';
  } else {
    type = 'paragraph';
    content = stripEmphasis(trimmed);
  }

  return { type, content, checked };
}

export function parseMarkdownToBlocks(markdown: string, fallbackTitle: string): { blocks: ParsedBlock[]; detectedTitle: string } {
  const normalized = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const tokens = preprocessImports(rawLines);

  const blocks: ParsedBlock[] = [];
  let inFencedCode = false;
  let fenced: string[] = [];
  let fenceLang = '';
  let detectedTitle = fallbackTitle;

  for (const tok of tokens) {
    if (inFencedCode) {
      if (tok.kind === 'lines' && tok.lines[0].trim().startsWith('```')) {
        inFencedCode = false;
        blocks.push({ type: 'code', content: fenced.join('\n'), checked: false, language: fenceLang });
        fenced = [];
        fenceLang = '';
        continue;
      }
      // Inside a fence: accumulate raw lines (no stripping).
      if (tok.kind === 'lines') {
        fenced.push(...tok.lines);
      } else {
        fenced.push(...tok.lines);
      }
      continue;
    }

    if (tok.kind === 'code') {
      blocks.push({ type: 'code', content: tok.lines.join('\n'), checked: false, language: tok.language || '' });
      continue;
    }

    if (tok.kind === 'table') {
      const table = parseTable(tok.lines);
      blocks.push({
        type: 'table',
        content: JSON.stringify(table),
        checked: false,
      });
      continue;
    }

    // tok.kind === 'lines'
    // Each `lines` token represents a run of consecutive non-blank lines
    // (guaranteed by preprocessImports). Here we evaluate each line
    // individually to detect headings/lists/quotes/etc., but when ALL
    // lines of the token are simple paragraphs, we merge them into a
    // single block (CommonMark: a paragraph = 1+ consecutive lines).
    // This avoids the "manual wrap → 2 blocks" bug that broke long paragraphs.
    const blockParseds: ParsedBlock[] = [];
    for (const line of tok.lines) {
      if (line.trim().startsWith('```')) {
        if (inFencedCode) {
          // close
          inFencedCode = false;
          blocks.push({ type: 'code', content: fenced.join('\n'), checked: false });
          fenced = [];
        } else {
          // open
          inFencedCode = true;
          fenced = [];
        }
        continue;
      }
      if (inFencedCode) {
        fenced.push(line);
        continue;
      }

      const parsed = parseLine(line);
      if (!parsed) continue;
      if (parsed.type === 'heading1' && (detectedTitle === fallbackTitle || !detectedTitle)) {
        detectedTitle = parsed.content;
      }
      blockParseds.push(parsed);
    }
    if (blockParseds.length === 0) continue;

    // If ALL token lines are simple paragraphs, merge into a single block
    // preserving the wrap with '\n'. If a heading/list/quote appears in
    // between, emit each block individually (paragraphs can't merge with
    // other types).
    const allParagraphs = blockParseds.every(p => p.type === 'paragraph');
    if (allParagraphs) {
      const merged = blockParseds.map(p => p.content).join('\n');
      blocks.push({ type: 'paragraph', content: merged, checked: false });
    } else {
      for (const p of blockParseds) blocks.push(p);
    }
  }

  if (inFencedCode && fenced.length > 0) {
    blocks.push({ type: 'code', content: fenced.join('\n'), checked: false });
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: '', checked: false });
  }

  return { blocks, detectedTitle };
}

// Block tree → markdown (the inverse of parseMarkdownToBlocks, as far as
// markdown can express each block). Shared by both backends' export route.
export type ExportBlock = {
  // blocks.props: the raw JSON text from the DB, or the already-parsed object.
  props?: unknown;
  id: string;
  type: string;
  content: string;
  checked?: number | boolean;
  language?: string | null;
  parent_id?: string | null;
  position?: number;
};

// Image/file blocks point at an uploaded file id; imported images may already
// hold a full URL, which is kept as-is.
function fileHref(content: string): string {
  return /^(https?:|data:)/i.test(content) ? content : `/api/files/${content}`;
}

function propsOf(block: ExportBlock): Record<string, unknown> | null | undefined {
  return typeof block.props === 'string' ? parseBlockProps(block.props) : (block.props as Record<string, unknown> | null | undefined);
}

// The image, plus its caption (props.caption) as an italic line right below.
function imageToMarkdown(block: ExportBlock, content: string): string {
  const image = `![${linkText(block.language || '', 'image')}](${fileHref(content)})`;
  const props = propsOf(block);
  const caption = typeof props?.caption === 'string' ? props.caption.replace(/\s+/g, ' ').trim() : '';
  return caption ? `${image}\n_${caption.replace(/[\\_*]/g, '\\$&')}_` : image;
}

// Brackets would end the link text early.
function linkText(text: string, fallback: string): string {
  return (text || '').replace(/[\[\]]/g, '').trim() || fallback;
}

// Web bookmark and embed blocks hold a URL: both export as a link to it. A
// bookmark is titled with the page title its preview cached (props.preview), an
// embed shows the address. Parentheses and spaces would end the link target.
function webLinkToMarkdown(block: ExportBlock, content: string): string {
  const url = content.trim();
  if (!/^https?:\/\//i.test(url)) return url;
  const preview = block.type === 'bookmark' ? propsOf(block)?.preview : null;
  const cachedTitle = preview && typeof preview === 'object' ? (preview as Record<string, unknown>).title : null;
  const href = url.replace(/[()\s]/g, c => (c === '(' ? '%28' : c === ')' ? '%29' : encodeURIComponent(c)));
  return `[${linkText(typeof cachedTitle === 'string' ? cachedTitle : '', url)}](${href})`;
}

function tableToMarkdown(content: string): string | null {
  let data: any;
  try { data = JSON.parse(content); } catch { return null; }
  const columns: string[] = Array.isArray(data?.columns) ? data.columns.map((c: unknown) => String(c ?? '')) : [];
  if (columns.length === 0) return null;
  const rows: unknown[][] = Array.isArray(data?.rows) ? data.rows.filter(Array.isArray) : [];
  const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const line = (cells: unknown[]) => `| ${columns.map((_, i) => cell(cells[i])).join(' | ')} |`;
  return [
    line(columns),
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(line),
  ].join('\n');
}

// Markdown for one block (may span several lines). `index` is its 1-based
// place in the current run of numbered siblings.
function blockToMarkdown(block: ExportBlock, index: number): string {
  const content = block.content ?? '';
  switch (block.type) {
    case 'heading1': return `# ${content}`;
    case 'heading2': return `## ${content}`;
    case 'heading3': return `### ${content}`;
    case 'bullet_list': return `- ${content}`;
    case 'numbered_list': return `${index}. ${content}`;
    case 'toggle': return `- ${content}`;
    case 'todo': return `- [${block.checked ? 'x' : ' '}] ${content}`;
    case 'code': return `\`\`\`${block.language || ''}\n${content}\n\`\`\``;
    case 'math': return `$$\n${content}\n$$`;
    case 'quote': return `> ${content}`;
    case 'divider': return '---';
    case 'callout': return `> 💡 ${content}`;
    case 'image': return imageToMarkdown(block, content);
    case 'bookmark':
    case 'embed': return webLinkToMarkdown(block, content);
    case 'file': return `[${linkText(block.language || '', 'file')}](${fileHref(content)})`;
    case 'table': return tableToMarkdown(content) ?? '';
    // The block only holds the child page id; the title would need a lookup.
    case 'subpage': return `[Subpage](/page/${content})`;
    case 'paragraph':
    default:
      return content;
  }
}

// Blocks that are list items in markdown. Runs of them stay on adjacent lines
// (a tight list); every other block is a paragraph-level element and needs a
// blank line around it, or markdown merges it with its neighbours (a paragraph
// right after a table becomes one more table row, two paragraphs become one).
const LIST_LIKE = new Set(['bullet_list', 'numbered_list', 'todo', 'toggle']);

// Column layout has no markdown form: the blocks of a column_list come out one
// column after another, as if they were at the level of the list itself.
const COLUMN_CONTAINERS = new Set(['column_list', 'column']);

export function blocksToMarkdown(blocks: ExportBlock[]): string {
  // Group children under their parent, ordered by position. A block whose
  // parent is missing from the list is treated as a root block.
  const ids = new Set(blocks.map(b => b.id));
  const children = new Map<string | null, ExportBlock[]>();
  for (const b of blocks) {
    const key = b.parent_id && ids.has(b.parent_id) && b.parent_id !== b.id ? b.parent_id : null;
    const list = children.get(key);
    if (list) list.push(b); else children.set(key, [b]);
  }
  for (const list of children.values()) list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  let out = '';
  // The next block starts a new paragraph even if it is a list item next to
  // one: set after an empty block, which markdown can only show as a gap.
  let breakNext = false;
  const visited = new Set<string>();
  const walk = (parent: ExportBlock | null, depth: number) => {
    const indent = '  '.repeat(depth);
    let numbered = 0;
    let prev: ExportBlock | null = null;
    for (const block of children.get(parent ? parent.id : null) ?? []) {
      if (visited.has(block.id)) continue;
      visited.add(block.id);
      if (COLUMN_CONTAINERS.has(block.type)) {
        // Set apart from what comes before and after, even from list items.
        breakNext = true;
        walk(block, depth);
        numbered = 0;
        breakNext = true;
        prev = null;
        continue;
      }
      // Numbering restarts per sibling group and after any other block.
      numbered = block.type === 'numbered_list' ? numbered + 1 : 0;
      const md = blockToMarkdown(block, numbered);
      // Tables with no columns and other empty renderings are dropped, and so
      // are empty paragraphs: the blank line between blocks already is the gap.
      if (md === '') {
        breakNext = true;
        prev = null;
      } else {
        // Tight only between list items, and for the first child of a list
        // item (it hangs under its parent). Everything else is set apart.
        const tight = out !== '' && !breakNext
          && (prev ? LIST_LIKE.has(prev.type) && LIST_LIKE.has(block.type) : parent !== null && LIST_LIKE.has(parent.type));
        const text = md.split('\n').map(l => (l ? indent + l : l)).join('\n');
        out += out === '' ? text : (tight ? '\n' : '\n\n') + text;
        breakNext = false;
        prev = block;
      }
      walk(block, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
