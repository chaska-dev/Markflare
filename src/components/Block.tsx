import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Block as BlockType, BlockType as BType, UploadState } from '../types';
import { usePageContext } from '../contexts/PageContext';
import {
  LightbulbIcon,
  PaperclipIcon,
  DocumentIcon,
  ArrowUpRightIcon,
  MoreHorizontalIcon,
  ChevronRightSmallIcon,
  TrashIcon,
  HeadingIcon,
  TextIcon,
  ListBulletIcon,
  CheckSquareIcon,
  ListOrderedIcon,
  QuoteIcon,
  CodeIcon,
  DividerIcon,
  CopyIcon,
  CheckIcon,
  MathIcon,
  ImageIcon,
} from './Icons';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { EditLinkModal } from './EditLinkModal';
import { ImageLightbox } from './ImageLightbox';
import { UploadStatus } from './UploadStatus';
import { formatFileSize } from '../utils/uploads';
import { inlineMarkdownToHtml, plainTextToSafeHtml, InlineOptions } from './inlineMarkdown';
import { useKatexHtml } from '../utils/katexLoader';
import { useLanguage } from '../i18n/LanguageContext';

// Image block. Default 200px wide, drag the bottom-right corner to resize
// (CSS resize: both), max width capped at the md breakpoint (768px).
// Size persists per block id in localStorage.
//
// While a file is uploading the block already shows the local picture (blob:
// URL) with a progress strip on top; `upload` is that client-only state.
function ImageBlock({
  block,
  imgSrc,
  setRef,
  onKeyDown,
  upload,
  onPickFile,
  onCancelUpload,
  onRetryUpload,
  onUploadSettled,
}: {
  block: BlockType;
  imgSrc: string;
  setRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  upload?: UploadState;
  onPickFile?: (id: string) => void;
  onCancelUpload?: (id: string) => void;
  onRetryUpload?: (id: string) => void;
  onUploadSettled?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [zoomOpen, setZoomOpen] = useState(false);
  const closeZoom = useCallback(() => setZoomOpen(false), []);
  const alt = block.language || t('editor.imageAlt');

  // Keyboard focus stays on the wrapper (that's what the editor navigates
  // with). Space is free in handleKeyDown, so it triggers the block's action:
  // pick a file for an empty block, zoom for a filled one.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && e.target === e.currentTarget && !upload) {
      e.preventDefault();
      if (!block.content) onPickFile?.(block.id);
      else setZoomOpen(true);
      return;
    }
    onKeyDown(block.id, e);
  };

  // Uploading, queued or failed: local preview + status strip.
  if (upload && upload.status !== 'done') {
    return (
      <div
        className="block-image block-image--upload"
        ref={setRef as any}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {upload.previewUrl ? (
          <img
            className={upload.status === 'error' ? 'is-failed' : 'is-uploading'}
            src={upload.previewUrl}
            alt={upload.fileName}
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="block-image-placeholder">
            <ImageIcon size={20} />
            <span>{upload.fileName}</span>
          </div>
        )}
        <UploadStatus
          upload={upload}
          onCancel={onCancelUpload ? () => onCancelUpload(block.id) : undefined}
          onRetry={onRetryUpload ? () => onRetryUpload(block.id) : undefined}
        />
      </div>
    );
  }

  if (!block.content) {
    return (
      <div className="block-image" ref={setRef as any} tabIndex={0} onKeyDown={handleKeyDown}>
        <div
          className="block-image-placeholder block-image-placeholder--action"
          role="button"
          onClick={() => onPickFile?.(block.id)}
        >
          <ImageIcon size={20} />
          <span>{t('editor.imagePlaceholder')}</span>
        </div>
      </div>
    );
  }

  // Upload just finished: keep the local picture on screen until the stored
  // one has loaded, so the swap doesn't flash an empty frame.
  if (upload?.status === 'done' && upload.previewUrl) {
    return (
      <div className="block-image" ref={setRef as any} tabIndex={0} onKeyDown={handleKeyDown}>
        <img src={upload.previewUrl} alt={alt} decoding="async" draggable={false} />
        <img
          src={imgSrc}
          alt=""
          hidden
          onLoad={() => onUploadSettled?.(block.id)}
          onError={() => onUploadSettled?.(block.id)}
        />
      </div>
    );
  }

  return (
    <div
      className="block-image"
      ref={setRef as any}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <img
        className="media-zoomable"
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onClick={() => setZoomOpen(true)}
      />
      {zoomOpen && <ImageLightbox src={imgSrc} alt={alt} onClose={closeZoom} />}
    </div>
  );
}

// Block types the user can transform to from the context menu.
// Intentionally excludes image/file/subpage/table/toggle: those need an upload
// or a separate page creation flow. labelKey is translated with t() at render
// time (hooks can't run at top-level constants).
interface TransformOption {
  type: BType;
  labelKey: string;
  // Fallback for tests/SSR without a language context.
  label: string;
  icon: React.ReactNode;
}
const TRANSFORM_OPTIONS: TransformOption[] = [
  { type: 'paragraph', labelKey: 'ctx.paragraph', label: 'Paragraph', icon: <TextIcon size={14} /> },
  { type: 'heading1', labelKey: 'ctx.heading1', label: 'Heading 1', icon: <HeadingIcon size={14} /> },
  { type: 'heading2', labelKey: 'ctx.heading2', label: 'Heading 2', icon: <HeadingIcon size={14} /> },
  { type: 'heading3', labelKey: 'ctx.heading3', label: 'Heading 3', icon: <HeadingIcon size={14} /> },
  { type: 'bullet_list', labelKey: 'ctx.bullet', label: 'Bullet', icon: <ListBulletIcon size={14} /> },
  { type: 'numbered_list', labelKey: 'ctx.numbered', label: 'Numbered', icon: <ListOrderedIcon size={14} /> },
  { type: 'todo', labelKey: 'ctx.todo', label: 'To-do', icon: <CheckSquareIcon size={14} /> },
  { type: 'quote', labelKey: 'ctx.quote', label: 'Quote', icon: <QuoteIcon size={14} /> },
  { type: 'code', labelKey: 'ctx.code', label: 'Code', icon: <CodeIcon size={14} /> },
  { type: 'callout', labelKey: 'ctx.callout', label: 'Callout', icon: <LightbulbIcon size={14} /> },
  { type: 'divider', labelKey: 'ctx.divider', label: 'Divider', icon: <DividerIcon size={14} /> },
];

interface Props {
  block: BlockType;
  // depth: 0 = root level. Used by CSS to indent and draw the hierarchy guide.
  depth?: number;
  // hasChildren: whether this block has direct children. When true, we show a
  // chevron that toggles collapse/expand.
  hasChildren?: boolean;
  // Called when the chevron is toggled. The editor persists the change.
  onToggleCollapse?: (id: string) => void;
  // Optional drag & drop. If provided, the handle becomes draggable and the
  // wrapper becomes a drop target.
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragEnd?: (id: string) => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDragLeave?: (id: string) => void;
  onDrop?: (id: string, e: React.DragEvent) => void;
  // Visual drop indicator: 'top' | 'middle' | 'bottom' | null.
  dropIndicator?: 'top' | 'middle' | 'bottom' | null;
  onContentChange: (id: string, content: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  onCheckedChange?: (id: string, checked: boolean) => void;
  onLanguageChange?: (id: string, language: string) => void;
  // Optional paste handler. If provided, the contenteditable intercepts paste
  // and forwards (blockId + current DOM content) to the editor, which decides
  // whether to split into multiple blocks via the markdown parser or let the
  // browser insert plain text.
  onPaste?: (e: React.ClipboardEvent, blockId: string, currentContent: string) => void;
  blockRef: (el: HTMLElement | null) => void;
  isOnly: boolean;
  // Delete this block. If not provided, the "Delete" context menu item is disabled.
  onDelete?: (id: string) => void;
  // Transform this block to another type (same id, same content). If not
  // provided, the "Convert to ..." context menu items are hidden.
  onTransform?: (id: string, newType: BType) => void;
  // Duplicate this block (and its children) right after it. If not provided,
  // the "Duplicate" context menu item is hidden.
  onDuplicate?: (id: string) => void;
  // Client-only upload state for this block (image/file being uploaded or
  // failed). Absent for blocks that aren't mid-upload.
  upload?: UploadState;
  // Size of the file this block points at, when the editor already knows it
  // (it was uploaded in this session). Blocks loaded from the server have none.
  fileSize?: number;
  // Open the editor's file picker for this block (empty image placeholder).
  onPickFile?: (id: string) => void;
  onCancelUpload?: (id: string) => void;
  onRetryUpload?: (id: string) => void;
  // The stored image finished loading, so the local preview can be released.
  onUploadSettled?: (id: string) => void;
}

export function Block({
  block,
  depth = 0,
  hasChildren = false,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  dropIndicator = null,
  onContentChange,
  onKeyDown,
  onCheckedChange,
  onLanguageChange,
  onPaste,
  blockRef,
  isOnly,
  onDelete,
  onTransform,
  onDuplicate,
  upload,
  fileSize,
  onPickFile,
  onCancelUpload,
  onRetryUpload,
  onUploadSettled,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const internalContent = useRef(block.content);
  const navigate = useNavigate();
  const { pages } = usePageContext();
  const { t } = useLanguage();

  // Page links show the target page's icon. Resolved at render time so a
  // renamed or re-iconed page updates without touching the stored markdown.
  const inlineOpts = useMemo<InlineOptions>(() => ({
    pageIcon: (pageId) => pages.find(p => p.id === pageId)?.icon || undefined,
  }), [pages]);

  // Context menu position triggered by right-click on the handle.
  // null = closed. Viewport-space coords from the onContextMenu event.
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const [editingLink, setEditingLink] = useState<{
    originalTitle: string;
    originalUrl: string;
    title: string;
    url: string;
    anchorRect: DOMRect | null;
  } | null>(null);

  // Focused state of the contentEditable. When focused we render plain text
  // (so caret + typing work cleanly). When blurred we render inline markdown
  // (links as <a>, bold/italic, inline code) so formats are visible at a glance.
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    if (block.type === 'image' || block.type === 'file' || block.type === 'subpage' || block.type === 'table' || block.type === 'math') return;
    if (isFocused) {
      // Edit mode: plain text only. Preserves the caret and avoids React
      // rewriting the DOM on each keystroke.
      if (contentRef.current.textContent !== block.content) {
        contentRef.current.textContent = block.content;
      }
    } else {
      // View mode: render inline markdown (links, bold, italic, code). The
      // code block is the exception — we don't parse markdown inside code
      // blocks because that would break the "literal code" semantics.
      const html = block.type === 'code'
        ? plainTextToSafeHtml(block.content)
        : inlineMarkdownToHtml(block.content, inlineOpts);
      if (contentRef.current.innerHTML !== html) {
        contentRef.current.innerHTML = html;
      }
    }
    internalContent.current = block.content;
  }, [block.content, block.type, isFocused, inlineOpts]);

  const handleInput = () => {
    const text = contentRef.current?.textContent || '';
    internalContent.current = text;
    onContentChange(block.id, text);
  };

  const openLinkEditor = (linkEl: HTMLAnchorElement) => {
    const rawUrl = linkEl.getAttribute('data-url') || linkEl.getAttribute('href') || '';
    const rawTitle = linkEl.getAttribute('data-title') || linkEl.textContent || '';
    const rect = linkEl.getBoundingClientRect();
    setEditingLink({
      originalTitle: rawTitle,
      originalUrl: rawUrl,
      title: rawTitle,
      url: rawUrl,
      anchorRect: rect,
    });
  };

  const handleContentMouseDown = (e: React.MouseEvent) => {
    // If the user clicked a hyperlink rendered as <a>, prevent contentEditable
    // from taking focus and undoing the inline markdown.
    const linkEl = (e.target as HTMLElement).closest('a.inline-link') as HTMLAnchorElement | null;
    if (linkEl && (e.button === 0 || e.button === 2)) {
      e.preventDefault();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const linkEl = (e.target as HTMLElement).closest('a.inline-link') as HTMLAnchorElement | null;
    if (linkEl && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      // Links to another page open in-app (a full reload would drop pending
      // edits and the SPA state). Right-click still opens the link editor.
      const pageId = linkEl.getAttribute('data-page-id');
      if (pageId) {
        navigate(`/page/${pageId}`);
        return;
      }
      openLinkEditor(linkEl);
    }
  };

  const handleContentContextMenu = (e: React.MouseEvent) => {
    const linkEl = (e.target as HTMLElement).closest('a.inline-link') as HTMLAnchorElement | null;
    if (linkEl) {
      e.preventDefault();
      e.stopPropagation();
      openLinkEditor(linkEl);
    }
  };

  const handleSaveLink = (newTitle: string, newUrl: string) => {
    if (!editingLink) return;
    const oldMarkdown = `[${editingLink.originalTitle}](${editingLink.originalUrl})`;
    const newMarkdown = `[${newTitle}](${newUrl})`;
    let newContent = block.content;
    if (newContent.includes(oldMarkdown)) {
      newContent = newContent.replace(oldMarkdown, newMarkdown);
    } else {
      const escapedUrl = editingLink.originalUrl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\[([^\\]]*)\\]\\(${escapedUrl}\\)`);
      if (regex.test(newContent)) {
        newContent = newContent.replace(regex, newMarkdown);
      }
    }
    if (newContent !== block.content) {
      onContentChange(block.id, newContent);
    }
    setEditingLink(null);
  };

  const handleRemoveLink = () => {
    if (!editingLink) return;
    const oldMarkdown = `[${editingLink.originalTitle}](${editingLink.originalUrl})`;
    let newContent = block.content;
    if (newContent.includes(oldMarkdown)) {
      newContent = newContent.replace(oldMarkdown, editingLink.originalTitle);
    } else {
      const escapedUrl = editingLink.originalUrl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\[([^\\]]*)\\]\\(${escapedUrl}\\)`);
      if (regex.test(newContent)) {
        newContent = newContent.replace(regex, editingLink.originalTitle);
      }
    }
    if (newContent !== block.content) {
      onContentChange(block.id, newContent);
    }
    setEditingLink(null);
  };

  const setRef = (el: HTMLDivElement | null) => {
    contentRef.current = el;
    blockRef(el);
    if (el && block.type !== 'image' && block.type !== 'file' && block.type !== 'subpage' && block.type !== 'table' && block.type !== 'math') {
      // Initial render by mode. For code blocks use textContent directly
      // (no markdown parsing) so the code stays literal.
      if (block.type === 'code') {
        if (el.textContent !== block.content) el.textContent = block.content;
      } else if (!isFocused) {
        el.innerHTML = inlineMarkdownToHtml(block.content, inlineOpts);
      } else {
        if (el.textContent !== block.content) el.textContent = block.content;
      }
    }
  };

  const renderContentEditable = (className: string, placeholderKey?: string) => (
    <div
      ref={setRef}
      className={`block-content ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e) => onKeyDown(block.id, e)}
      onMouseDown={handleContentMouseDown}
      onClick={handleContentClick}
      onContextMenu={handleContentContextMenu}
      // If the editor passed onPaste, invoke it with the current DOM content
      // (not state — debounce may not have flushed yet). If it decides not
      // to intervene, it returns without calling e.preventDefault() and the
      // browser inserts plain text as usual.
      onPaste={onPaste ? (e) => onPaste(e, block.id, contentRef.current?.textContent ?? '') : undefined}
      data-placeholder={placeholderKey ? (t(placeholderKey as any) || placeholderKey) : t('editor.placeholder')}
    />
  );

  const renderBlockInner = () => {
    switch (block.type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
      case 'bullet_list':
      case 'numbered_list':
      case 'quote':
        return renderContentEditable(block.type, 'editor.headingPlaceholder');

      case 'toggle':
        // A toggle is semantically a paragraph with a chevron. If the block
        // has children, the editor renders them indented below; we only
        // handle the parent content here.
        return renderContentEditable('paragraph', 'editor.togglePlaceholder');

      case 'todo':
        return (
          <div className={`block-todo ${block.checked ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={block.checked}
              onChange={(e) => onCheckedChange?.(block.id, e.target.checked)}
            />
            {renderContentEditable('', 'editor.taskPlaceholder')}
          </div>
        );

      case 'code':
        return (
          <CodeBlock
            block={block}
            onLanguageChange={onLanguageChange}
            renderContentEditable={renderContentEditable}
          />
        );

      case 'divider':
        return (
          <div className="block-content">
            <hr className="block-divider" />
          </div>
        );

      case 'callout':
        return (
          <div className="block-callout">
            <div className="block-callout-icon"><LightbulbIcon size={18} /></div>
            {renderContentEditable('', 'editor.calloutPlaceholder')}
          </div>
        );

      case 'image': {
        const isUrlOrApi = block.content.startsWith('http') || block.content.startsWith('/') || block.content.startsWith('data:');
        const imgSrc = isUrlOrApi ? block.content : `/api/files/${block.content}`;
        return <ImageBlock
          block={block}
          imgSrc={imgSrc}
          setRef={setRef}
          onKeyDown={onKeyDown}
          upload={upload}
          onPickFile={onPickFile}
          onCancelUpload={onCancelUpload}
          onRetryUpload={onRetryUpload}
          onUploadSettled={onUploadSettled}
        />;
      }

      case 'file': {
        // Mid-upload (or failed): no download link yet, show the progress strip.
        if (upload && upload.status !== 'done') {
          return (
            <div className="block-file block-file--upload" ref={setRef as any} tabIndex={0} onKeyDown={(e) => onKeyDown(block.id, e)}>
              <span className="block-file-icon"><PaperclipIcon size={16} /></span>
              <span className="block-file-name">{upload.fileName}</span>
              <span className="block-file-size">{formatFileSize(upload.fileSize)}</span>
              <UploadStatus
                upload={upload}
                onCancel={onCancelUpload ? () => onCancelUpload(block.id) : undefined}
                onRetry={onRetryUpload ? () => onRetryUpload(block.id) : undefined}
              />
            </div>
          );
        }
        return (
          <a href={block.content ? `/api/files/${block.content}` : '#'} download={block.language || 'file'} className="block-file" ref={setRef as any} tabIndex={0} onKeyDown={(e) => onKeyDown(block.id, e)}>
            <span className="block-file-icon"><PaperclipIcon size={16} /></span>
            <span className="block-file-name">{block.language || 'Attached file'}</span>
            {fileSize !== undefined && <span className="block-file-size">{formatFileSize(fileSize)}</span>}
            <span className="block-file-download">Download</span>
          </a>
        );
      }

      case 'subpage': {
        // block.content = subpage's page_id
        const targetPage = pages.find(p => p.id === block.content);
        const icon = targetPage?.icon;
        const title = targetPage?.title || 'Page';
        return (
          <a
            href={`/page/${block.content}`}
            className="block-subpage"
            ref={setRef as any}
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/page/${block.content}`);
            }}
            onKeyDown={(e) => onKeyDown(block.id, e)}
            title={`Open ${title}`}
          >
            <span className="block-subpage-icon">{icon || <DocumentIcon size={16} />}</span>
            <span className="block-subpage-title">{title}</span>
            <span className="block-subpage-arrow"><ArrowUpRightIcon size={12} /></span>
          </a>
        );
      }

      case 'table':
        return (
          <TableBlock
            block={block}
            onContentChange={onContentChange}
            onKeyDown={onKeyDown}
            blockRef={blockRef}
          />
        );

      case 'math':
        return (
          <MathBlock
            block={block}
            onContentChange={onContentChange}
            onKeyDown={onKeyDown}
            blockRef={blockRef}
          />
        );

      case 'paragraph':
      default:
        return renderContentEditable('paragraph');
    }
  };

  // Chevron only appears if the block has children. Click toggles it. We put
  // it before the handle and content, with contentEditable=false so the caret
  // doesn't enter it when navigating with arrows. If the block has no children
  // but we're at an indented level, we leave an invisible spacer of the same
  // width so the handles stay vertically aligned.
  const isCollapsed = Boolean(block.collapsed);

  // Open the context menu at the right-click coordinates on the handle.
  const handleContextMenu = (e: React.DragEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const menuItems: ContextMenuItem[] = [
    // Transform submenu: only appears if onTransform was provided and the
    // current type is one of the transformable ones.
    ...(onTransform && TRANSFORM_OPTIONS.some(o => o.type === block.type)
      ? [
          {
            label: t('ctx.transformTo'),
            header: true,
          },
          ...TRANSFORM_OPTIONS
            .filter(opt => opt.type !== block.type)
            .map(opt => ({
              label: t(opt.labelKey as any) || opt.label,
              icon: opt.icon,
              onClick: () => onTransform(block.id, opt.type),
            })),
          { divider: true as const },
        ]
      : []),
    ...(onDuplicate
      ? [{
          label: t('ctx.duplicate'),
          icon: <CopyIcon size={14} />,
          // Same reason as delete: a second block would point at the same page.
          disabled: block.type === 'subpage',
          title: block.type === 'subpage' ? t('ctx.duplicateSubpageHint') : undefined,
          onClick: () => onDuplicate(block.id),
        }]
      : []),
    {
      label: t('ctx.delete'),
      icon: <TrashIcon size={14} />,
      danger: true,
      // subpage blocks can't be deleted inline — the reference only goes
      // away when the referenced page itself is deleted from the sidebar.
      disabled: !onDelete || isOnly || block.type === 'subpage',
      title: block.type === 'subpage' ? t('ctx.deleteSubpageHint') : undefined,
      onClick: onDelete ? () => onDelete(block.id) : () => {},
    },
  ];

  return (
    <div
      id={`block-${block.id}`}
      data-block-id={block.id}
      data-block-type={block.type}
      className={`block-wrapper ${dropIndicator ? `block-wrapper--drop-${dropIndicator} drop-${dropIndicator}` : ''}`}
      data-depth={depth}
      style={{ '--depth': depth } as React.CSSProperties}
      onDragOver={onDragOver ? (e) => {
        e.preventDefault();
        onDragOver(block.id, e);
      } : undefined}
      onDragLeave={onDragLeave ? () => onDragLeave(block.id) : undefined}
      onDrop={onDrop ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(block.id, e);
      } : undefined}
    >
      <div className="block-gutter" contentEditable={false}>
        {hasChildren ? (
          <button
            type="button"
            className={`block-collapse-btn ${isCollapsed ? 'collapsed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(block.id);
            }}
            title={isCollapsed ? 'Expand block' : 'Collapse block'}
            aria-label={isCollapsed ? 'Expand block' : 'Collapse block'}
            aria-expanded={!isCollapsed}
          >
            <ChevronRightSmallIcon size={12} />
          </button>
        ) : (
          <span className="block-collapse-spacer" aria-hidden="true" />
        )}
        <div
          className="block-handle"
          draggable={Boolean(onDragStart)}
          onDragStart={onDragStart ? (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', block.id);
            onDragStart(block.id, e);
          } : undefined}
          onDragEnd={onDragEnd ? () => onDragEnd(block.id) : undefined}
          onContextMenu={handleContextMenu}
          onClick={(e) => {
            // Also open on left-click for touch/trackpad convenience.
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setMenuPos({ x: rect.right + 4, y: rect.top });
          }}
          title="Drag to move or click for options"
          role="button"
          aria-label="Block options"
          tabIndex={-1}
        >
          <MoreHorizontalIcon size={14} />
        </div>
      </div>
      {/* Keyed by type: React would otherwise reuse the same <div> when a text
          block becomes a to-do/callout, keeping the text node written by hand. */}
      <React.Fragment key={block.type}>{renderBlockInner()}</React.Fragment>

      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={menuItems}
          onClose={() => setMenuPos(null)}
        />
      )}

      {editingLink && (
        <EditLinkModal
          open={Boolean(editingLink)}
          initialTitle={editingLink.title}
          initialUrl={editingLink.url}
          anchorRect={editingLink.anchorRect}
          onSave={handleSaveLink}
          onRemove={handleRemoveLink}
          onClose={() => setEditingLink(null)}
        />
      )}
    </div>
  );
}

// Table block: editable cells, add/remove row/col, persistence via JSON in content.

interface TableData {
  columns: string[];
  rows: string[][];
}

function parseTableData(raw: string): TableData {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
      return parsed as TableData;
    }
  } catch {
    // fallthrough to default
  }
  return { columns: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']] };
}

interface TableBlockProps {
  block: BlockType;
  onContentChange: (id: string, content: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  blockRef: (el: HTMLElement | null) => void;
}

function TableBlock({ block, onContentChange, onKeyDown, blockRef }: TableBlockProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLanguage();
  const data = parseTableData(block.content);

  const setWrapperRef = (el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    blockRef(el);
  };

  const persist = (next: TableData) => {
    onContentChange(block.id, JSON.stringify(next));
  };

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const next: TableData = {
      columns: [...data.columns],
      rows: data.rows.map((r, i) => i === rowIdx ? r.map((c, j) => j === colIdx ? value : c) : r),
    };
    persist(next);
  };

  const updateColumnHeader = (colIdx: number, value: string) => {
    const next: TableData = {
      columns: data.columns.map((c, i) => i === colIdx ? value : c),
      rows: data.rows,
    };
    persist(next);
  };

  const addRow = () => {
    const newRow = Array(data.columns.length).fill('');
    persist({ columns: data.columns, rows: [...data.rows, newRow] });
  };

  const removeRow = (rowIdx: number) => {
    if (data.rows.length <= 1) return;
    persist({ columns: data.columns, rows: data.rows.filter((_, i) => i !== rowIdx) });
  };

  const addColumn = () => {
    persist({
      columns: [...data.columns, `Column ${data.columns.length + 1}`],
      rows: data.rows.map(r => [...r, '']),
    });
  };

  const removeColumn = (colIdx: number) => {
    if (data.columns.length <= 1) return;
    persist({
      columns: data.columns.filter((_, i) => i !== colIdx),
      rows: data.rows.map(r => r.filter((_, i) => i !== colIdx)),
    });
  };

  return (
    <div
      className="block-table-wrapper"
      ref={setWrapperRef}
      tabIndex={0}
      onKeyDown={(e) => onKeyDown(block.id, e)}
    >
      <div className="block-table-scroll">
        <table className="block-table">
          <thead>
            <tr>
              {data.columns.map((col, ci) => (
                <th key={ci} className="block-table-th">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="block-table-cell"
                    data-placeholder={t('editor.tableHeaderPlaceholder')}
                    onBlur={(e) => updateColumnHeader(ci, e.currentTarget.textContent || '')}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {col}
                  </div>
                  <button
                    type="button"
                    className="block-table-col-remove"
                    onClick={() => removeColumn(ci)}
                    disabled={data.columns.length <= 1}
                    title={t('editor.removeColumn')}
                    aria-label={t('editor.removeColumn')}
                    contentEditable={false}
                  >×</button>
                </th>
              ))}
              <th className="block-table-th block-table-th--actions" contentEditable={false}>
                <button
                  type="button"
                  className="block-table-add-col"
                  onClick={addColumn}
                  title={t('editor.addColumn')}
                  aria-label={t('editor.addColumn')}
                >＋</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="block-table-td">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="block-table-cell"
                      data-placeholder={t('editor.tableCellPlaceholder')}
                      onBlur={(e) => updateCell(ri, ci, e.currentTarget.textContent || '')}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {cell}
                    </div>
                  </td>
                ))}
                <td className="block-table-td block-table-td--actions" contentEditable={false}>
                  <button
                    type="button"
                    className="block-table-row-remove"
                    onClick={() => removeRow(ri)}
                    disabled={data.rows.length <= 1}
                    title={t('editor.removeRow')}
                    aria-label={t('editor.removeRow')}
                  >×</button>
                </td>
              </tr>
            ))}
            <tr contentEditable={false}>
              <td colSpan={data.columns.length + 1} className="block-table-td block-table-td--add">
                <button
                  type="button"
                  className="block-table-add-row"
                  onClick={addRow}
                  title={t('editor.addRow')}
                >＋ {t('editor.addRow')}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Code block with language selector and copy button.

const CODE_LANGUAGES = [
  { id: 'plaintext', name: 'Plain text' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'c', name: 'C' },
  { id: 'csharp', name: 'C#' },
  { id: 'sql', name: 'SQL' },
  { id: 'html', name: 'HTML' },
  { id: 'css', name: 'CSS' },
  { id: 'json', name: 'JSON' },
  { id: 'rust', name: 'Rust' },
  { id: 'go', name: 'Go' },
  { id: 'bash', name: 'Bash / Shell' },
  { id: 'markdown', name: 'Markdown' },
];

function CodeBlock({
  block,
  onLanguageChange,
  renderContentEditable,
}: {
  block: BlockType;
  onLanguageChange?: (id: string, language: string) => void;
  renderContentEditable: (className: string, placeholderKey?: string) => React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(block.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="block-code-container">
      <div className="block-code-header" contentEditable={false}>
        <select
          className="block-code-lang-select"
          value={block.language || 'plaintext'}
          onChange={(e) => onLanguageChange?.(block.id, e.target.value)}
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="block-code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
          aria-label="Copy code"
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="block-code-pre">
        {renderContentEditable('code', 'editor.codePlaceholder')}
      </pre>
    </div>
  );
}

// Math formulas block with LaTeX + KaTeX rendering.

function MathBlock({
  block,
  onContentChange,
  onKeyDown,
  blockRef,
}: {
  block: BlockType;
  onContentChange: (id: string, content: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  blockRef: (el: HTMLElement | null) => void;
}) {
  const [editing, setEditing] = useState(!block.content);
  const [latexInput, setLatexInput] = useState(block.content || '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLatexInput(block.content || '');
  }, [block.content]);

  // KaTeX loads on demand; `null` means it is still on its way.
  const renderedHtml = useKatexHtml(editing ? latexInput : block.content);
  const { t } = useLanguage();
  const loadingFallback = <div className="math-loading">{t('math.loading')}</div>;

  const handleFinishEditing = () => {
    setEditing(false);
    if (latexInput !== block.content) {
      onContentChange(block.id, latexInput);
    }
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        blockRef(el);
      }}
      className="block-math-wrapper"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!editing && e.key === 'Enter') {
          e.preventDefault();
          setEditing(true);
        } else {
          onKeyDown(block.id, e);
        }
      }}
    >
      {editing ? (
        <div className="block-math-editor" contentEditable={false}>
          <div className="block-math-header">
            <span className="block-math-badge"><MathIcon size={14} /> LaTeX</span>
            <button
              type="button"
              className="block-math-done-btn"
              onClick={handleFinishEditing}
            >
              Done
            </button>
          </div>
          <textarea
            className="block-math-textarea"
            rows={2}
            placeholder="Write LaTeX formula (e.g. \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi})"
            value={latexInput}
            autoFocus
            onChange={(e) => setLatexInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                e.preventDefault();
                handleFinishEditing();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleFinishEditing();
              }
            }}
          />
          {renderedHtml === null ? loadingFallback : renderedHtml && (
            <div
              className="block-math-preview"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>
      ) : (
        <div
          className="block-math-display"
          onClick={() => setEditing(true)}
          title="Click to edit LaTeX formula"
        >
          {renderedHtml === null ? loadingFallback : renderedHtml ? (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          ) : (
            <div className="block-math-placeholder">
              <MathIcon size={16} />
              <span>Empty formula (click to write LaTeX)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
