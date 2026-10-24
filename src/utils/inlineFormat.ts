import { getSelectionOffsets, setSelectionOffsets } from './caret';
import { safeHref } from '../components/inlineMarkdown';

// Inline formatting for the focused text blocks. A focused block holds the raw
// markdown (see Block.tsx), so formatting is a text edit around the selection:
// wrap it in the markers, or take them off when they are already there.

export type InlineFormat = 'bold' | 'italic' | 'strike' | 'code';

const MARKER: Record<InlineFormat, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
};

// Replace text[from, to) with `insert` and select [selStart, selEnd) afterwards.
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  selStart: number;
  selEnd: number;
}

// Consecutive `ch` characters ending at index i (going left) / starting at i.
function runBefore(text: string, i: number, ch: string): number {
  let n = 0;
  while (i - n > 0 && text[i - n - 1] === ch) n++;
  return n;
}
function runAfter(text: string, i: number, ch: string): number {
  let n = 0;
  while (i + n < text.length && text[i + n] === ch) n++;
  return n;
}

// Bold and italic share the star: ** is bold, * is italic and *** is both, so
// a run of 2 or more (on both sides) means bold and an odd run means italic.
function starsMean(format: 'bold' | 'italic', run: number): boolean {
  return format === 'bold' ? run >= 2 : run % 2 === 1;
}

// Whether the `format` markers sit right before and after text[start, end).
function surrounded(text: string, start: number, end: number, format: InlineFormat): boolean {
  if (format === 'bold' || format === 'italic') {
    return starsMean(format, Math.min(runBefore(text, start, '*'), runAfter(text, end, '*')));
  }
  const m = MARKER[format];
  return text.slice(start - m.length, start) === m && text.slice(end, end + m.length) === m;
}

// The edit that toggles `format` over text[start, end), or null when there is
// nothing sensible to do (a selection of only whitespace). Surrounding
// whitespace stays outside the markers: a double-click selects the trailing
// space too, and "** word **" would not read as bold elsewhere.
export function computeFormatEdit(text: string, start: number, end: number, format: InlineFormat): TextEdit | null {
  const m = MARKER[format];
  const n = m.length;

  if (start === end) {
    return { from: start, to: start, insert: m + m, selStart: start + n, selEnd: start + n };
  }

  const selected = text.slice(start, end);
  const core = selected.trim();
  if (core === '') return null;
  const coreStart = start + selected.indexOf(core);
  const coreEnd = coreStart + core.length;

  // The markers are part of the selection ("**word**" selected as a whole).
  let markersInside: boolean;
  if (format === 'bold' || format === 'italic') {
    const lead = runAfter(core, 0, '*');
    const trail = runBefore(core, core.length, '*');
    // Not for "**a** b **c**": those markers belong to two different spans.
    markersInside = core.length > lead + trail && starsMean(format, Math.min(lead, trail))
      && !core.slice(lead, core.length - trail).includes('*');
  } else {
    markersInside = core.length > 2 * n && core.startsWith(m) && core.endsWith(m)
      && !core.slice(n, core.length - n).includes(m);
  }
  if (markersInside) {
    const inner = core.slice(n, core.length - n);
    return { from: coreStart, to: coreEnd, insert: inner, selStart: coreStart, selEnd: coreStart + inner.length };
  }

  // The markers are right outside the selection ("**" + "word" + "**").
  if (surrounded(text, coreStart, coreEnd, format)) {
    const from = coreStart - n;
    return { from, to: coreEnd + n, insert: core, selStart: from, selEnd: from + core.length };
  }

  // Not formatted yet: wrap, and keep the text selected so the same shortcut
  // (or another format) can be applied right after.
  return {
    from: coreStart,
    to: coreEnd,
    insert: m + core + m,
    selStart: coreStart + n,
    selEnd: coreStart + n + core.length,
  };
}

// Replace text[from, to) of a focused block through the browser's editing
// pipeline, so it is one native undo step and fires the usual `input` event
// (which is how the block's content state gets updated).
export function replaceBlockText(el: HTMLElement, from: number, to: number, insert: string) {
  const before = el.textContent ?? '';
  const expected = before.slice(0, from) + insert + before.slice(to);
  setSelectionOffsets(el, from, to);
  const done = document.execCommand('insertText', false, insert);
  if (!done || el.textContent !== expected) {
    // execCommand unavailable or it did something else: write the text
    // ourselves and report it like typing would.
    el.textContent = expected;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Toggle `format` on the selection inside the focused block `el`.
export function applyInlineFormat(el: HTMLElement, format: InlineFormat): boolean {
  const range = getSelectionOffsets(el);
  if (!range) return false;
  const edit = computeFormatEdit(el.textContent ?? '', range.start, range.end, format);
  if (!edit) return false;
  replaceBlockText(el, edit.from, edit.to, edit.insert);
  setSelectionOffsets(el, edit.selStart, edit.selEnd);
  return true;
}

// The non-blank part of the selection inside `el`, as offsets into its text.
export function getSelectedTextRange(el: HTMLElement): { start: number; end: number; text: string } | null {
  const range = getSelectionOffsets(el);
  if (!range || range.start === range.end) return null;
  const selected = (el.textContent ?? '').slice(range.start, range.end);
  const text = selected.trim();
  if (!text) return null;
  const start = range.start + selected.indexOf(text);
  return { start, end: start + text.length, text };
}

// URL typed in the link dialog -> what goes between the parentheses of
// `[text](url)`, or null if it is not allowed. Same allowlist the renderer
// applies (http(s), mailto, tel, in-app and relative paths); anything else
// with a scheme (javascript:, data:...) is refused. A bare "example.com"
// becomes https://example.com and "me@example.com" a mailto: link.
export function normalizeLinkUrl(raw: string): string | null {
  // "(" is fine in the renderer's pattern, ")" and spaces end the URL early.
  let url = raw.trim().replace(/\s/g, '%20').replace(/\)/g, '%29');
  if (!url) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!/^(https?|mailto|tel):/i.test(url)) return null;
  } else if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(url)) {
    url = `mailto:${url}`;
  } else if (!/^(\/|\.\/|#)/.test(url)) {
    url = `https://${url}`;
  }
  return safeHref(url);
}

// Text shown for a link: `[` and `]` would end it early.
export function cleanLinkText(text: string): string {
  return text.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
}
