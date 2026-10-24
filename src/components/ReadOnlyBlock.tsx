// Read-only block renderer used by the public shared view. Unlike Block.tsx
// it has no drag handle, context menu, or inline editing — just persisted
// content, with a navigable link for `subpage` blocks (pointing to
// /share/:token?p=pageId).

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Block } from '../types';
import { DocumentIcon, ArrowUpRightIcon, PaperclipIcon, CopyIcon, CheckIcon } from './Icons';
import { ImageLightbox } from './ImageLightbox';
import { useLanguage } from '../i18n/LanguageContext';
import { inlineMarkdownToHtml, plainTextToSafeHtml } from './inlineMarkdown';
import { useKatexHtml } from '../utils/katexLoader';

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

  switch (block.type) {
    case 'heading1':
      return <h1 className="readonly-block readonly-h1" {...rich(block.content)} />;
    case 'heading2':
      return <h2 className="readonly-block readonly-h2" {...rich(block.content)} />;
    case 'heading3':
      return <h3 className="readonly-block readonly-h3" {...rich(block.content)} />;
    case 'bullet_list':
      return (
        <div className="readonly-block readonly-list">
          <span className="readonly-list-marker">•</span>
          <span {...rich(block.content)} />
        </div>
      );
    case 'numbered_list':
      // Real numbering (1, 2, 3...) would require carrying an index; in the
      // read-only view we show a generic marker that still reads as ordered.
      return (
        <div className="readonly-block readonly-list">
          <span className="readonly-list-marker">1.</span>
          <span {...rich(block.content)} />
        </div>
      );
    case 'todo':
      // Todo: no inline markdown — checkbox + line-through is its own semantics.
      // Just escaped text.
      return (
        <div className="readonly-block readonly-todo">
          <span className={`readonly-checkbox${block.checked ? ' checked' : ''}`}>
            {block.checked ? '✓' : ''}
          </span>
          <span style={block.checked ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                dangerouslySetInnerHTML={renderPlain(block.content)} />
        </div>
      );
    case 'quote':
      return <div className="readonly-block readonly-quote" {...rich(block.content)} />;
    case 'callout':
      // Callout: "💡 " prefix + rich content. inlineMarkdownToHtml escapes
      // the text so the emoji is rendered as a safe literal.
      return (
        <div className="readonly-block readonly-callout">
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
      // Tables are a composite block (TableBlock) with internal state. In the
      // simplified public view we show a placeholder; a future build-out could
      // request the sub-render detail from the backend.
      return (
        <div className="readonly-block readonly-table-placeholder">[Table]</div>
      );
    case 'paragraph':
    default:
      return <div className="readonly-block readonly-paragraph" {...rich(block.content)} />;
  }
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
