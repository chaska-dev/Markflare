// Safe inline markdown → HTML converter. Applies only the transformations we
// want to allow (links, bold, italic, inline code) over text already escaped
// from HTML. The `code` block body and the link URL are re-escaped at their
// insertion point so `<script>` can't sneak in as a tag.
//
// Pipeline:
//   1. escapeHtml(text) — neutralize <, >, &, ", '.
//   2. inline code — protect content between backticks before applying
//      emphasis/link (the `_` and `*` inside inline code are left alone).
//   3. links [text](url) — reject javascript: and data: to prevent XSS.
//   4. bold ** **, italic * *, italic _ _.
//
// What it does NOT do:
//   - Block-level parsing (headings, lists, blockquotes). That lives in
//     server/shared/markdown.ts at the block level.
//   - Images ![alt](url) — not a block type yet, so we leave them literal.
//   - Escaped HTML like `&lt;a&gt;` — not meaningful in markdown.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Block dangerous protocols in href. data: and javascript: are common XSS
// vectors (data:text/html,... can execute JS on navigation).
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:|mailto:|tel:|\/|\.\/|#)/i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9_\-./?=&%#]+$/.test(trimmed)) return trimmed;
  return null;
}

// Stash placeholders so regexes only run on the "outside" text (not inside
// tags we've already emitted). Same trick as stripEmphasis in
// server/shared/markdown.ts.
const STASH_RE = /\u0000(\d+)\u0000/g;

// Links to another page are stored as `[Title](/page/<id>)` (see MentionMenu).
// They render as in-app links instead of opening a new tab.
const PAGE_LINK_RE = /^\/page\/([A-Za-z0-9_-]+)$/;

export interface InlineOptions {
  // Emoji shown before the text of a page link, when the page is known.
  pageIcon?: (pageId: string) => string | undefined;
  // Where a page link points. The shared view maps pages into the share
  // (`/share/:token?p=id`) because the editor routes need a login.
  pageHref?: (pageId: string) => string;
}

export function inlineMarkdownToHtml(text: string, opts: InlineOptions = {}): string {
  if (!text) return '';
  let out = escapeHtml(text);

  const stash: string[] = [];
  const push = (html: string) => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };

  // 1. Inline code FIRST — protects `_` and `*` inside backticks.
  out = out.replace(/`([^`]+)`/g, (_, code) => push(`<code class="inline-code">${code}</code>`));

  // 2. Links [text](url). Text already escaped; URL escaped too. If safeHref
  //    returns null, keep the literal (escaped) text so the user sees
  //    `[text](javascript:...)` as plain text instead of a clickable link.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, linkText, url) => {
    const safe = safeHref(url);
    if (safe === null) return `[${linkText}](${url})`;
    const pageMatch = PAGE_LINK_RE.exec(safe);
    if (pageMatch) {
      const pageId = pageMatch[1];
      const href = escapeHtml(opts.pageHref?.(pageId) ?? safe);
      const icon = opts.pageIcon?.(pageId);
      const iconHtml = icon ? `<span class="inline-link-icon">${escapeHtml(icon)}</span>` : '';
      return push(
        `<a href="${href}" class="inline-link inline-link--page" data-page-id="${pageId}" data-url="${safe}" data-title="${linkText}">${iconHtml}${linkText}</a>`
      );
    }
    return push(
      `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="inline-link" data-url="${safe}" data-title="${linkText}">${linkText}</a>`
    );
  });

  // 3. Bold **text**. Not greedy: **foo** shouldn't match more than one pair.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, (_, b) => push(`<strong>${b}</strong>`));
  out = out.replace(/__([^_\n]+)__/g, (_, b) => push(`<strong>${b}</strong>`));

  // 4. Italic *text* / _text_. Don't match ** or __.
  out = out.replace(/(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/g, (_, em) =>
    push(`<em>${em}</em>`)
  );
  out = out.replace(/(?<!_)_(?!_)([^_\n]+)(?<!_)_(?!_)/g, (_, em) =>
    push(`<em>${em}</em>`)
  );

  // 5. Restore stashed placeholders.
  out = out.replace(STASH_RE, (_, i) => stash[Number(i)]);
  return out;
}

// For blocks that don't want inline markdown (todo, code, etc.) — only
// escapes HTML. No links, no emphasis (they don't make sense inside a
// checkbox).
export function plainTextToSafeHtml(text: string): string {
  if (!text) return '';
  return escapeHtml(text);
}
