// Read-only block renderer used by the public shared view. Unlike Block.tsx
// it has no drag handle, context menu, or inline editing — just persisted
// content, with a navigable link for `subpage` blocks (pointing to
// /share/:token?p=pageId).

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Block } from '../types';
import { DocumentIcon, ArrowUpRightIcon, PaperclipIcon, CopyIcon, CheckIcon } from './Icons';
import { ImageLightbox } from './ImageLightbox';
import { BookmarkCard } from './BookmarkCard';
import { EmbedFrame } from './EmbedBlock';
import { useLanguage } from '../i18n/LanguageContext';
import { inlineMarkdownToHtml, plainTextToSafeHtml } from './inlineMarkdown';
import { useKatexHtml } from '../utils/katexLoader';
import { parseTableData, tableOptions, toGrid } from '../utils/table';
import { blockColor } from '../utils/blockColor';
import { blockUrl, readPreview } from '../utils/bookmark';
import { embedFromUrl } from '../utils/embed';

interface Props {
  block: Block;
  // Active share token, for constructing internal subpage URLs.
  shareToken: string;
}

// dangerouslySetInnerHTML with the inline markdown converter for block types
// where links/bold/italic/inline code make sense (headings, paragraph, quote,
// callout, lists). For code/todo we skip inline markdown because it would
// break semantics (a link inside a checkbox? no).
const renderPlain = (text: string) => ({ __html: plainTextToSafeHtml(text) });

export function ReadOnlyBlock({ block, shareToken }: Props) {
  const navigate = useNavigate();

  // Links to other pages (`/page/<id>`) are editor routes behind the login, so
  // inside a share they point at the same share's page instead. SharedView
  // falls back to the share root for pages that aren't part of it.
  const rich = (text: string) => ({
    dangerouslySetInnerHTML: {
      __html: inlineMarkdownToHtml(text, {
        pageHref: (pageId) => `/share/${encodeURIComponent(shareToken)}?p=${encodeURIComponent(pageId)}`,
      }),
    },
    onClick: (e: React.MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a.inline-link--page') as HTMLAnchorElement | null;
      // Let modified clicks (new tab, etc.) behave natively.
      if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      navigate(link.getAttribute('href') || '/');
    },
  });

  // Block color from the Color menu (text blocks only); styled in editor.css.
  const color = blockColor(block.type, block.props);

  switch (block.type) {
    case 'heading1':
      return <h1 className="readonly-block readonly-h1" data-color={color} {...rich(block.content)} />;
    case 'heading2':
      return <h2 className="readonly-block readonly-h2" data-color={color} {...rich(block.content)} />;
    case 'heading3':
      return <h3 className="readonly-block readonly-h3" data-color={color} {...rich(block.content)} />;
    case 'bullet_list':
      return (
        <div className="readonly-block readonly-list" data-color={color}>
          <span className="readonly-list-marker">•</span>
          <span {...rich(block.content)} />
        </div>
      );
    case 'numbered_list':
      // Real numbering (1, 2, 3...) would require carrying an index; in the
      // read-only view we show a generic marker that still reads as ordered.
      return (
        <div className="readonly-block readonly-list" data-color={color}>
          <span className="readonly-list-marker">1.</span>
          <span {...rich(block.content)} />
        </div>
      );
    case 'todo':
      // Todo: no inline markdown — checkbox + line-through is its own semantics.
      // Just escaped text.
      return (
        <div className="readonly-block readonly-todo" data-color={color}>
          <span className={`readonly-checkbox${block.checked ? ' checked' : ''}`}>
            {block.checked ? '✓' : ''}
          </span>
          <span style={block.checked ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                dangerouslySetInnerHTML={renderPlain(block.content)} />
        </div>
      );
    case 'quote':
      return <div className="readonly-block readonly-quote" data-color={color} {...rich(block.content)} />;
    case 'callout':
      // Callout: "💡 " prefix + rich content. inlineMarkdownToHtml escapes
      // the text so the emoji is rendered as a safe literal.
      return (
        <div className="readonly-block readonly-callout" data-color={color}>
          💡 <span {...rich(block.content)} />
        </div>
      );
    case 'divider':
      return <hr className="readonly-divider" />;
    case 'code':
      // Code block content is literal (no inline markdown). The inner <code>
      // is the semantic container without the .inline-code class.
      return (
        <div className="readonly-code-container">
          <div className="readonly-code-header">
            <span className="readonly-code-lang">{block.language || 'code'}</span>
            <CopyButton text={block.content} />
          </div>
          <pre className="readonly-block readonly-code">
            <code dangerouslySetInnerHTML={renderPlain(block.content)} />
          </pre>
        </div>
      );
    case 'math':
      return <ReadOnlyMath latex={block.content} />;
    case 'image': {
      const props = block.props ?? {};
      const width = typeof props.width === 'number' && props.width > 0 ? props.width : undefined;
      const caption = typeof props.caption === 'string' ? props.caption : '';
      return (
        <div
          className="readonly-block readonly-image"
          data-align={props.align === 'left' || props.align === 'right' ? props.align : 'center'}
        >
          {block.content ? (
            <figure
              className={`block-image-figure${width ? ' block-image-figure--sized' : ''}`}
              style={width ? { width } : undefined}
            >
              <ReadOnlyImage
                src={block.content.startsWith('http') || block.content.startsWith('/') || block.content.startsWith('data:') ? block.content : `/api/files/${block.content}`}
                alt={block.language || ''}
              />
              {caption && <figcaption className="block-image-caption">{caption}</figcaption>}
            </figure>
          ) : null}
        </div>
      );
    }
    case 'bookmark': {
      // The card comes from the preview cached in the block: the public view
      // never fetches the page itself.
      const url = blockUrl(block.content);
      if (!url) return null;
      return (
        <div className="readonly-block readonly-bookmark">
          <BookmarkCard url={url} preview={readPreview(block.props, url)} />
        </div>
      );
    }
    case 'embed': {
      const url = blockUrl(block.content);
      if (!url) return null;
      const info = embedFromUrl(url);
      // Unsupported sites are never framed: show them as a plain link card.
      if (!info) {
        return (
          <div className="readonly-block readonly-bookmark">
            <BookmarkCard url={url} preview={null} />
          </div>
        );
      }
      const width = typeof block.props?.width === 'number' && block.props.width > 0 ? block.props.width : undefined;
      return (
        <div className="readonly-block readonly-image readonly-embed" data-align="center">
          <figure
            className={`block-image-figure block-embed-figure${width ? ' block-image-figure--sized' : ''}`}
            style={width ? { width } : undefined}
          >
            <EmbedFrame info={info} />
          </figure>
        </div>
      );
    }
    case 'file':
      return (
        <a
          href={block.content ? `/api/files/${block.content}` : '#'}
          download={block.language || 'file'}
          className="readonly-block readonly-file"
        >
          <span className="readonly-file-icon"><PaperclipIcon size={16} /></span>
          <span className="readonly-file-name">{block.language || 'Attached file'}</span>
        </a>
      );
    case 'subpage':
      // Subpage inside a share: navigate using ?p=id so SharedView keeps the
      // active token and loads the child.
      return (
        <a
          href={`/share/${encodeURIComponent(shareToken)}?p=${encodeURIComponent(block.content)}`}
          className="readonly-block readonly-subpage"
          title="Open subpage"
        >
          <span className="readonly-subpage-icon"><DocumentIcon size={16} /></span>
          <span className="readonly-subpage-title">Subpage</span>
          <span className="readonly-subpage-arrow"><ArrowUpRightIcon size={12} /></span>
        </a>
      );
    case 'table':
      return <ReadOnlyTable block={block} rich={rich} />;
    case 'paragraph':
    default:
      return <div className="readonly-block readonly-paragraph" data-color={color} {...rich(block.content)} />;
  }
}

// Same grid as the editor's table (header row/column, saved column widths),
// without the controls. Cells render inline markdown like text blocks do.
function ReadOnlyTable({ block, rich }: { block: Block; rich: (text: string) => React.HTMLAttributes<HTMLDivElement> }) {
  const { t } = useLanguage();
  const data = parseTableData(block.content, (n) => t('editor.tableDefaultColumn', { n }));
  const { headerRow, headerColumn, colWidths } = tableOptions(block.props, data.columns.length);
  const grid = toGrid(data);

  return (
    <div className={`readonly-block readonly-table-scroll${colWidths ? ' block-table-scroll--fixed' : ''}`}>
      <table
        className={`block-table${colWidths ? ' block-table--fixed' : ''}`}
        style={colWidths ? { width: colWidths.reduce((sum, w) => sum + w, 0) } : undefined}
      >
        {colWidths && (
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
        )}
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const isHeader = (headerRow && ri === 0) || (headerColumn && ci === 0);
                const Cell = isHeader ? 'th' : 'td';
                return (
                  <Cell key={ci} className={isHeader ? 'block-table-th' : 'block-table-td'}>
                    <div className="block-table-cell" {...rich(cell)} />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// KaTeX is loaded on demand (see katexLoader); until then a short placeholder
// keeps the block's place in the page.
function ReadOnlyMath({ latex }: { latex: string }) {
  const { t } = useLanguage();
  const html = useKatexHtml(latex || '');
  if (html === null) {
    return <div className="readonly-block readonly-math math-loading">{t('math.loading')}</div>;
  }
  return <div className="readonly-block readonly-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Image with click-to-zoom. A real <button> wraps the picture so keyboard users
// can open the viewer too (the shared view has no editor wrapper to focus).
function ReadOnlyImage({ src, alt }: { src: string; alt: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className="media-zoom-btn"
        onClick={() => setOpen(true)}
        aria-label={alt ? `${t('editor.imageZoom')}: ${alt}` : t('editor.imageZoom')}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy={/^https?:/i.test(src) ? 'no-referrer' : undefined}
        />
      </button>
      {open && <ImageLightbox src={src} alt={alt || t('editor.imageAlt')} onClose={close} />}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      className="readonly-code-copy-btn"
      onClick={handleCopy}
      title="Copy code"
      aria-label="Copy code"
    >
      {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
