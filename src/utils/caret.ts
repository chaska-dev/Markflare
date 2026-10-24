// Caret helpers for the contentEditable blocks. While a block is focused it
// holds plain text (see Block.tsx), so character offsets map 1:1 to its content.

// Character offset of the caret inside `el`, or null when the selection is elsewhere.
export function getCaretOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.focusNode || !el.contains(sel.focusNode)) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.toString().length;
}

// Selected character range inside `el` (start === end for a bare caret), or
// null when the selection is not entirely inside it.
export function getSelectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
  if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
  const range = sel.getRangeAt(0);
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

// DOM position of a character offset: the text node holding it and the offset
// inside that node. null when the offset is past the end of the text.
function locateOffset(el: HTMLElement, offset: number): [Node, number] | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) return [node, remaining];
    remaining -= len;
    node = walker.nextNode();
  }
  return null;
}

// Select a character range (each end clamped to the end of the text).
export function setSelectionOffsets(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const from = locateOffset(el, start);
  const to = start === end ? from : locateOffset(el, end);
  if (from) range.setStart(from[0], from[1]);
  else range.setStart(el, el.childNodes.length);
  if (to) range.setEnd(to[0], to[1]);
  else range.setEnd(el, el.childNodes.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Put the caret at a character offset (clamped to the end of the text).
export function placeCaret(el: HTMLElement, offset: number) {
  setSelectionOffsets(el, offset, offset);
}

// Viewport rect of the caret. A collapsed range in an empty block reports an
// all-zero rect, so fall back to the block's own box.
export function getCaretRect(el: HTMLElement): { top: number; bottom: number; left: number } {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && el.contains(sel.focusNode)) {
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) {
      return { top: rect.top, bottom: rect.bottom, left: rect.left };
    }
  }
  const rect = el.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, left: rect.left };
}
