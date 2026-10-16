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

// Put the caret at a character offset (clamped to the end of the text).
export function placeCaret(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  let placed = false;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      range.setStart(node, remaining);
      placed = true;
      break;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  if (!placed) {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
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
