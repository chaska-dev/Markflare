import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Block as BlockType, BlockType as BType, BlockProps, UploadState } from '../types';
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
  PlusIcon,
  XIcon,
  ImageIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  CaptionIcon,
  PaletteIcon,
  BookmarkIcon,
  EmbedIcon,
  RefreshIcon,
  LinkIcon,
} from './Icons';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { ColorMenu } from './ColorMenu';
import { EditLinkModal } from './EditLinkModal';
import { ImageLightbox } from './ImageLightbox';
import { UploadStatus } from './UploadStatus';
import { BookmarkBlock } from './BookmarkCard';
import { EmbedBlock } from './EmbedBlock';
import { formatFileSize } from '../utils/uploads';
import { inlineMarkdownToHtml, plainTextToSafeHtml, InlineOptions } from './inlineMarkdown';
import { useKatexHtml } from '../utils/katexLoader';
import { useLanguage } from '../i18n/LanguageContext';
import { useWidthResize } from '../hooks/useWidthResize';
import { useBookmarkPreview } from '../hooks/useBookmarkPreview';
import { placeCaret } from '../utils/caret';
import { blockColor, isColorable } from '../utils/blockColor';
import { mergeProps } from '../utils/blockProps';
import { blockUrl, linkUrlFromText } from '../utils/bookmark';
import { embedFromUrl } from '../utils/embed';
import {
  TableData,
  TableGrid,
  TABLE_MIN_COL_WIDTH,
  TABLE_MAX_COL_WIDTH,
  TABLE_DEFAULT_COL_WIDTH,
  parseTableData,
  tableOptions,
  toGrid,
  fromGrid,
  insertAt,
  parseTsv,
} from '../utils/table';

const CAPTION_MAX_LENGTH = 500;

// Image block, Notion-style. Without props.width it renders at the image's
// natural width capped to the column. The two side handles resize it (width in
// px, saved to props.width); a hover toolbar sets the alignment and opens the
// caption. Double-clicking a handle goes back to the natural width.
//
// While a file is uploading the block already shows the local picture (blob:
// URL) with a progress strip on top; `upload` is that client-only state.
function ImageBlock({
  block,
  imgSrc,
  setRef,
  onKeyDown,
  onPropsChange,
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
  onPropsChange?: (id: string, props: BlockProps) => void;
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

  const props: BlockProps = block.props ?? {};
  const align = props.align === 'left' || props.align === 'right' ? props.align : 'center';
  const savedWidth = typeof props.width === 'number' && props.width > 0 ? props.width : undefined;
  const caption = typeof props.caption === 'string' ? props.caption : '';

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const captionRef = useRef<HTMLElement | null>(null);
  // The caption stays hidden until it has text or the user asks for it.
  const [captionOpen, setCaptionOpen] = useState(false);
  const captionVisible = caption !== '' || captionOpen;

  // The caption is uncontrolled while typing; sync it from props otherwise
  // (first render, undo, another tab's edit) without moving the caret.
  useEffect(() => {
    const el = captionRef.current;
    if (el && document.activeElement !== el && el.textContent !== caption) el.textContent = caption;
  }, [caption, captionVisible]);
  useEffect(() => {
    if (captionOpen) captionRef.current?.focus();
  }, [captionOpen]);

  const updateProps = (patch: Partial<BlockProps>) => {
    onPropsChange?.(block.id, mergeProps(props, patch));
  };

  // Width while a handle is being dragged (liveWidth) is local only; the saved
  // width is written once, when the drag ends.
  const { liveWidth, handleProps } = useWidthResize({
    wrapperRef,
    figureRef,
    align,
    savedWidth,
    onCommit: (width) => updateProps({ width }),
  });

  const commitCaption = (el: HTMLElement) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, CAPTION_MAX_LENGTH);
    if (text !== caption) updateProps({ caption: text || undefined });
    if (!text) setCaptionOpen(false);
  };

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

  const setWrapperRef = (el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    setRef(el);
  };

  // Hotlinked pictures: don't leak the editor's address to the other site.
  const referrerPolicy = /^https?:/i.test(imgSrc) ? 'no-referrer' : undefined;
  const figureWidth = liveWidth ?? savedWidth;
  const figureStyle = figureWidth ? { width: figureWidth } : undefined;
  const figureClass = `block-image-figure${figureWidth ? ' block-image-figure--sized' : ''}`;

  // Uploading, queued or failed: local preview + status strip.
  if (upload && upload.status !== 'done') {
    return (
      <div
        className="block-image block-image--upload"
        ref={setWrapperRef}
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
      <div className="block-image" ref={setWrapperRef} tabIndex={0} onKeyDown={handleKeyDown}>
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
      <div className="block-image" data-align={align} ref={setWrapperRef} tabIndex={0} onKeyDown={handleKeyDown}>
        <figure className={figureClass} style={figureStyle}>
          <img src={upload.previewUrl} alt={alt} decoding="async" draggable={false} />
          <img
            src={imgSrc}
            alt=""
            hidden
            onLoad={() => onUploadSettled?.(block.id)}
            onError={() => onUploadSettled?.(block.id)}
          />
        </figure>
      </div>
    );
  }

  const alignButtons: { value: 'left' | 'center' | 'right'; label: string; icon: React.ReactNode }[] = [
    { value: 'left', label: t('editor.imageAlignLeft'), icon: <AlignLeftIcon size={14} /> },
    { value: 'center', label: t('editor.imageAlignCenter'), icon: <AlignCenterIcon size={14} /> },
    { value: 'right', label: t('editor.imageAlignRight'), icon: <AlignRightIcon size={14} /> },
  ];

  return (
    <div
      className={`block-image${liveWidth !== null ? ' is-resizing' : ''}`}
      data-align={align}
      ref={setWrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <figure className={figureClass} style={figureStyle} ref={figureRef}>
        <div className="block-image-frame">
          <img
            className="media-zoomable"
            src={imgSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy={referrerPolicy}
            onClick={() => setZoomOpen(true)}
          />
          {/* Own keys must not reach the editor (Enter would add a block). */}
          <div className="block-image-toolbar" role="toolbar" onKeyDown={(e) => e.stopPropagation()}>
            {alignButtons.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                className="block-image-tool"
                title={label}
                aria-label={label}
                aria-pressed={align === value}
                onClick={() => updateProps({ align: value === 'center' ? undefined : value })}
              >
                {icon}
              </button>
            ))}
            <span className="block-image-tool-sep" aria-hidden="true" />
            <button
              type="button"
              className="block-image-tool"
              title={t('editor.imageCaption')}
              aria-label={t('editor.imageCaption')}
              aria-pressed={captionVisible}
              onClick={() => (captionVisible ? captionRef.current?.focus() : setCaptionOpen(true))}
            >
              <CaptionIcon size={14} />
            </button>
          </div>
          {(['left', 'right'] as const).map(side => (
            <div
              key={side}
              className={`block-image-handle block-image-handle--${side}`}
              title={t('editor.imageResize')}
              {...handleProps(side)}
            />
          ))}
        </div>
        {captionVisible && (
          <figcaption
            ref={captionRef}
            className="block-image-caption"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={t('editor.imageCaption')}
            data-placeholder={t('editor.imageCaptionPlaceholder')}
            onBlur={(e) => commitCaption(e.currentTarget)}
            onKeyDown={(e) => {
              // Single line, and the editor's block shortcuts don't apply here.
              e.stopPropagation();
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.blur();
                wrapperRef.current?.focus();
              }
            }}
            onPaste={(e) => {
              // Plain text only, on one line; a pasted image must not become a block.
              e.preventDefault();
              e.stopPropagation();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
            }}
          />
        )}
      </figure>
      {zoomOpen && <ImageLightbox src={imgSrc} alt={alt} onClose={closeZoom} />}
    </div>
  );
}

// Blocks that render their own UI instead of an editable text line.
const NOT_TEXT_BLOCKS: BType[] = ['image', 'file', 'subpage', 'table', 'math', 'bookmark', 'embed'];

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
export const TRANSFORM_OPTIONS: TransformOption[] = [
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
  // Visual drop indicator: a line above / below, a highlight (nest inside) or a
  // vertical line on the left / right edge (new column beside the block).
  dropIndicator?: 'top' | 'middle' | 'bottom' | 'left' | 'right' | null;
  onContentChange: (id: string, content: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  onCheckedChange?: (id: string, checked: boolean) => void;
  onLanguageChange?: (id: string, language: string) => void;
  // Replace the block's props bag (image width / alignment / caption, table
  // header options / column widths, bookmark preview). `record: false` saves the
  // change without adding an undo step (cache fills, see useBookmarkPreview).
  onPropsChange?: (id: string, props: BlockProps, options?: { record?: boolean }) => void;
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
  // Part of the editor's multi-block selection. A selected block draws highlighted
  // and its context menu (right-click, handle) belongs to the whole selection:
  // the editor opens it through onSelectionMenu instead of the block's own.
  selected?: boolean;
  onSelectionMenu?: (x: number, y: number) => void;
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
  onPropsChange,
  onPaste,
  blockRef,
  isOnly,
  onDelete,
  onTransform,
  onDuplicate,
  selected = false,
  onSelectionMenu,
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
  // Web bookmarks keep their card data in props.preview; this fetches it when missing.
  const bookmark = useBookmarkPreview(block, onPropsChange, block.type === 'bookmark');

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
    if (NOT_TEXT_BLOCKS.includes(block.type)) return;
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
    if (el && !NOT_TEXT_BLOCKS.includes(block.type)) {
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
          onPropsChange={onPropsChange}
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
            inlineOpts={inlineOpts}
            onContentChange={onContentChange}
            onPropsChange={onPropsChange}
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

      case 'bookmark':
        return (
          <BookmarkBlock
            block={block}
            setRef={setRef}
            onKeyDown={onKeyDown}
            onContentChange={onContentChange}
            preview={bookmark.preview}
            status={bookmark.status}
          />
        );

      case 'embed':
        return (
          <EmbedBlock
            block={block}
            setRef={setRef}
            onKeyDown={onKeyDown}
            onContentChange={onContentChange}
            onPropsChange={onPropsChange}
            onConvert={(id) => onTransform?.(id, 'bookmark')}
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
    if (selected && onSelectionMenu) {
      onSelectionMenu(e.clientX, e.clientY);
      return;
    }
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Block color (text or background). 'default' clears it.
  const color = blockColor(block.type, block.props);
  const setBlockColor = (next: string) => {
    onPropsChange?.(block.id, mergeProps(block.props ?? {}, { color: next === 'default' ? undefined : next }));
  };

  // Bookmark and embed blocks hold a web address, and a paragraph that is only
  // a link can become either of them: these get the link conversions and actions.
  const isWebBlock = block.type === 'bookmark' || block.type === 'embed';
  const linkUrl = isWebBlock ? blockUrl(block.content) : block.type === 'paragraph' ? linkUrlFromText(block.content) : null;
  const linkConversions: ContextMenuItem[] = onTransform && linkUrl
    ? [
        ...(block.type !== 'bookmark'
          ? [{ label: t('ctx.toBookmark'), icon: <BookmarkIcon size={14} />, onClick: () => onTransform(block.id, 'bookmark') }]
          : []),
        ...(block.type !== 'embed' && embedFromUrl(linkUrl)
          ? [{ label: t('ctx.toEmbed'), icon: <EmbedIcon size={14} />, onClick: () => onTransform(block.id, 'embed') }]
          : []),
        ...(isWebBlock
          ? [{ label: t('ctx.toLink'), icon: <LinkIcon size={14} />, onClick: () => onTransform(block.id, 'paragraph') }]
          : []),
      ]
    : [];
  const transformItems: ContextMenuItem[] = onTransform
    ? [
        // Only the transformable text types offer the plain conversions.
        ...(TRANSFORM_OPTIONS.some(o => o.type === block.type)
          ? TRANSFORM_OPTIONS
              .filter(opt => opt.type !== block.type)
              .map(opt => ({
                label: t(opt.labelKey as any) || opt.label,
                icon: opt.icon,
                onClick: () => onTransform(block.id, opt.type),
              }))
          : []),
        ...linkConversions,
      ]
    : [];

  const menuItems: ContextMenuItem[] = [
    // Transform submenu: only appears if onTransform was provided and the
    // current type has something to turn into.
    ...(transformItems.length > 0
      ? [
          {
            label: t('ctx.transformTo'),
            header: true,
          },
          ...transformItems,
          { divider: true as const },
        ]
      : []),
    ...(isWebBlock && linkUrl
      ? [
          {
            label: t('ctx.copyLink'),
            icon: <CopyIcon size={14} />,
            onClick: () => { navigator.clipboard.writeText(linkUrl).catch(() => {}); },
          },
          {
            label: t('ctx.openInNewTab'),
            icon: <ArrowUpRightIcon size={14} />,
            onClick: () => { window.open(linkUrl, '_blank', 'noopener,noreferrer'); },
          },
          ...(block.type === 'bookmark'
            ? [{ label: t('ctx.refreshPreview'), icon: <RefreshIcon size={14} />, onClick: bookmark.refresh }]
            : []),
          { divider: true as const },
        ]
      : []),
    ...(onPropsChange && isColorable(block.type)
      ? [{
          label: t('ctx.color'),
          icon: <PaletteIcon size={14} />,
          submenu: (
            <ColorMenu
              value={color}
              onSelect={(next) => {
                setBlockColor(next);
                setMenuPos(null);
              }}
            />
          ),
        }]
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
      data-color={color}
      className={`block-wrapper ${dropIndicator ? `block-wrapper--drop-${dropIndicator} drop-${dropIndicator}` : ''}${selected ? ' block-wrapper--selected' : ''}`}
      data-depth={depth}
      style={{ '--depth': depth } as React.CSSProperties}
      onContextMenu={selected && onSelectionMenu ? handleContextMenu : undefined}
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
            // Shift+click selects blocks (the editor handles it on mousedown).
            if (e.shiftKey) return;
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            if (selected && onSelectionMenu) {
              onSelectionMenu(rect.right + 4, rect.top);
              return;
            }
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

// Table block, Notion-style. The data is JSON in content ({columns, rows}, the
// columns being the header row) and the display options are in props:
// headerRow (default on), headerColumn and colWidths. Cells are plain text
// while focused and rendered inline markdown otherwise; a cell is saved when it
// blurs. Rows and columns are edited from the grips on their edges (a menu),
// the "+" buttons and the keyboard (see handleCellKeyDown).

// Width (px) of the trailing column that holds the "+" button; keep in sync
// with .block-table-actions in index.css.
const TABLE_ACTIONS_WIDTH = 32;

const emptyRow = (n: number): string[] => Array<string>(n).fill('');

// Text of a cell's DOM. Line breaks made by the browser (<br>, or a block
// wrapper) become "\n". Trailing breaks are dropped: browsers keep a <br> after
// a final line break only as a placeholder to show the empty line.
function readCellText(el: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.nodeValue ?? '';
      } else if (child.nodeName === 'BR') {
        out += '\n';
      } else if (child instanceof HTMLElement) {
        if (out !== '' && !out.endsWith('\n') && (child.nodeName === 'DIV' || child.nodeName === 'P')) out += '\n';
        walk(child);
      }
    });
  };
  walk(el);
  return out.replace(/\n+$/, '');
}

// Whether the caret is on the first ('up') or last ('down') visual line of the
// cell, i.e. whether the arrow key has nowhere left to go inside it.
function caretOnEdgeLine(el: HTMLElement, edge: 'up' | 'down'): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed || !el.contains(sel.anchorNode)) return false;
  const range = sel.getRangeAt(0);
  const rect = range.getClientRects()[0];
  if (!rect || (!rect.width && !rect.height)) {
    // A collapsed range can report no rect (empty cell, start of a line): look
    // for an explicit line break on the way to the edge instead.
    const probe = document.createRange();
    probe.selectNodeContents(el);
    if (edge === 'up') probe.setEnd(range.endContainer, range.endOffset);
    else probe.setStart(range.startContainer, range.startOffset);
    const rest = probe.cloneContents();
    return !(rest.textContent ?? '').includes('\n') && !rest.querySelector('br');
  }
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  const box = el.getBoundingClientRect();
  return edge === 'up'
    ? rect.top < box.top + parseFloat(style.paddingTop) + lineHeight
    : rect.bottom > box.bottom - parseFloat(style.paddingBottom) - lineHeight;
}

interface TableCellProps {
  row: number;
  col: number;
  value: string;
  placeholder: string;
  inlineOpts: InlineOptions;
  onCommit: (row: number, col: number, text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, row: number, col: number) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>, row: number, col: number) => void;
}

// One editable cell. Like a text block it shows raw text while focused (so the
// caret and typing behave) and inline markdown otherwise, but it writes to the
// DOM itself and only reports the text on blur, so typing never re-renders it.
function TableCell({ row, col, value, placeholder, inlineOpts, onCommit, onKeyDown, onPaste }: TableCellProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  // The value last put into the DOM (or committed from it). While focused the
  // DOM holds what the user typed, which only a different value may replace.
  const syncedRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (focused) {
      if (syncedRef.current !== value && readCellText(el) !== value) el.textContent = value;
    } else {
      const html = inlineMarkdownToHtml(value, inlineOpts);
      if (el.innerHTML !== html) el.innerHTML = html;
    }
    syncedRef.current = value;
  }, [value, focused, inlineOpts]);

  // Ctrl/Cmd+click opens a link; a plain click edits the cell.
  const isLinkOpen = (e: React.MouseEvent) =>
    (e.ctrlKey || e.metaKey) && Boolean((e.target as HTMLElement).closest('a.inline-link'));

  return (
    <div
      ref={ref}
      className="block-table-cell"
      contentEditable
      suppressContentEditableWarning
      data-row={row}
      data-col={col}
      data-placeholder={placeholder}
      onFocus={(e) => {
        // Rendered markdown -> raw text. Plain cells already match, which keeps
        // the caret where the click put it.
        if (readCellText(e.currentTarget) !== value) e.currentTarget.textContent = value;
        syncedRef.current = value;
        setFocused(true);
      }}
      onBlur={(e) => {
        onCommit(row, col, readCellText(e.currentTarget));
        setFocused(false);
      }}
      onInput={(e) => {
        // Emptied cells keep a lone <br> that would hide the placeholder.
        const el = e.currentTarget;
        if (el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR') el.replaceChildren();
      }}
      onKeyDown={(e) => onKeyDown(e, row, col)}
      onPaste={(e) => onPaste(e, row, col)}
      onMouseDown={(e) => {
        if (isLinkOpen(e)) e.preventDefault();
      }}
      onClick={(e) => {
        if (!isLinkOpen(e)) return;
        const link = (e.target as HTMLElement).closest('a.inline-link') as HTMLAnchorElement;
        e.preventDefault();
        e.stopPropagation();
        const pageId = link.getAttribute('data-page-id');
        if (pageId) navigate(`/page/${pageId}`);
        else window.open(link.getAttribute('href') || '', '_blank', 'noopener,noreferrer');
      }}
    />
  );
}

interface TableBlockProps {
  block: BlockType;
  inlineOpts: InlineOptions;
  onContentChange: (id: string, content: string) => void;
  onPropsChange?: (id: string, props: BlockProps) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  blockRef: (el: HTMLElement | null) => void;
}

// Open menu for a row or a column; x/y are viewport coordinates.
interface TableMenu {
  kind: 'row' | 'col';
  index: number;
  x: number;
  y: number;
}

function TableBlock({ block, inlineOpts, onContentChange, onPropsChange, onKeyDown, blockRef }: TableBlockProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const { t } = useLanguage();
  const columnLabel = (n: number) => t('editor.tableDefaultColumn', { n });
  const data = useMemo(() => parseTableData(block.content, columnLabel), [block.content, t]);
  const props: BlockProps = block.props ?? {};
  const nCols = data.columns.length;
  const { headerRow, headerColumn, colWidths } = tableOptions(props, nCols);

  // Latest data/props. Structure changes and cell commits can follow each
  // other before React re-renders (Tab commits a cell and adds a row in one
  // go), so edits build on these instead of on the render's snapshot.
  const dataRef = useRef<TableData>(data);
  dataRef.current = data;
  const propsRef = useRef<BlockProps>(props);
  propsRef.current = props;

  const [menu, setMenu] = useState<TableMenu | null>(null);
  // Column widths while a handle is dragged. Local only: saved once, on
  // pointerup, so a drag doesn't produce a request per pixel.
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null);
  const resizeRef = useRef<{ index: number; startX: number; startWidth: number; widths: number[]; moved: boolean } | null>(null);
  // Cell to focus once the next render has created it (a row added by keyboard).
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);

  const setWrapperRef = (el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    blockRef(el);
  };

  const getGrid = (): TableGrid => toGrid(dataRef.current);

  const setGrid = (grid: TableGrid) => {
    const next = fromGrid(grid);
    dataRef.current = next;
    onContentChange(block.id, JSON.stringify(next));
  };

  const updateProps = (patch: Partial<BlockProps>) => {
    const next = mergeProps(propsRef.current, patch);
    propsRef.current = next;
    onPropsChange?.(block.id, next);
  };

  const withCell = (grid: TableGrid, row: number, col: number, text: string): TableGrid =>
    grid.map((r, i) => (i === row ? r.map((v, j) => (j === col ? text : v)) : r));

  const commitCell = (row: number, col: number, text: string) => {
    const grid = getGrid();
    if (grid[row]?.[col] === undefined || grid[row][col] === text) return;
    setGrid(withCell(grid, row, col, text));
  };

  // Typed text is saved when its cell blurs, which doesn't happen when the page
  // is closed, hidden or navigated away from under a focused cell.
  const commitActiveRef = useRef<() => void>(() => {});
  commitActiveRef.current = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !wrapperRef.current?.contains(el) || el.dataset.row === undefined) return;
    commitCell(Number(el.dataset.row), Number(el.dataset.col), readCellText(el));
  };
  useLayoutEffect(() => {
    const flush = () => commitActiveRef.current();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHidden);
      // Unmounting while a cell has focus (browser back, ...): no blur comes.
      flush();
    };
  }, []);

  const focusCell = (row: number, col: number) => {
    const el = wrapperRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
    if (!el) return;
    el.focus();
    placeCaret(el, Infinity);
  };

  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    focusCell(p.row, p.col);
  });

  // Add a row at the end and focus `col` of it. `grid` already holds the text
  // of the cell being left.
  const appendRowAndFocus = (grid: TableGrid, col: number) => {
    setGrid([...grid, emptyRow(grid[0].length)]);
    pendingFocus.current = { row: grid.length, col };
  };

  // Structure changes.

  const insertRow = (row: number, below: boolean) =>
    setGrid(insertAt(getGrid(), below ? row + 1 : row, emptyRow(nCols)));

  const duplicateRow = (row: number) => {
    const grid = getGrid();
    setGrid(insertAt(grid, row + 1, [...grid[row]]));
  };

  const clearRow = (row: number) => {
    setGrid(getGrid().map((r, i) => (i === row ? r.map(() => '') : r)));
  };

  const deleteRow = (row: number) => {
    const grid = getGrid();
    if (grid.length <= 1) return;
    setGrid(grid.filter((_, i) => i !== row));
  };

  // Column changes keep the saved widths (if any) in step with the cells.
  const editColumns = (editRow: (row: string[], rowIndex: number) => string[], editWidths?: (widths: number[]) => number[]) => {
    const grid = getGrid();
    const widths = tableOptions(propsRef.current, grid[0].length).colWidths;
    setGrid(grid.map(editRow));
    if (widths && editWidths) updateProps({ colWidths: editWidths(widths) });
  };

  const insertColumn = (col: number, right: boolean) => {
    const at = right ? col + 1 : col;
    editColumns(r => insertAt(r, at, ''), w => insertAt(w, at, TABLE_DEFAULT_COL_WIDTH));
  };

  const duplicateColumn = (col: number) =>
    editColumns(r => insertAt(r, col + 1, r[col]), w => insertAt(w, col + 1, w[col]));

  const clearColumn = (col: number) => editColumns(r => r.map((v, i) => (i === col ? '' : v)));

  const deleteColumn = (col: number) => {
    if (nCols <= 1) return;
    editColumns(r => r.filter((_, i) => i !== col), w => w.filter((_, i) => i !== col));
  };

  const addRow = () => setGrid([...getGrid(), emptyRow(nCols)]);

  const addColumn = () =>
    editColumns(
      (r, i) => [...r, i === 0 && headerRow ? columnLabel(nCols + 1) : ''],
      w => [...w, TABLE_DEFAULT_COL_WIDTH],
    );

  const toggleHeaderRow = () => updateProps({ headerRow: headerRow ? false : undefined });
  const toggleHeaderColumn = () => updateProps({ headerColumn: headerColumn ? undefined : true });

  // Keyboard.

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, row: number, col: number) => {
    // Keys pressed while an input method composes text belong to it.
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const grid = getGrid();
    const lastRow = grid.length - 1;
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (e.key === 'Escape') {
      // Back to the block itself, so the editor's block navigation works again.
      handled();
      el.blur();
      wrapperRef.current?.focus();
      return;
    }

    if (e.key === 'Tab' && plain) {
      handled();
      // Cells in reading order, wrapping across rows.
      const next = row * nCols + col + (e.shiftKey ? -1 : 1);
      if (next < 0) return;
      if (next >= grid.length * nCols) appendRowAndFocus(withCell(grid, row, col, readCellText(el)), 0);
      else focusCell(Math.floor(next / nCols), next % nCols);
      return;
    }

    if (e.key === 'Enter' && plain) {
      handled();
      if (e.shiftKey) document.execCommand('insertLineBreak');
      else if (row < lastRow) focusCell(row + 1, col);
      else appendRowAndFocus(withCell(grid, row, col, readCellText(el)), col);
      return;
    }

    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && plain && !e.shiftKey) {
      const up = e.key === 'ArrowUp';
      const target = up ? row - 1 : row + 1;
      if (target >= 0 && target <= lastRow && caretOnEdgeLine(el, up ? 'up' : 'down')) {
        handled();
        focusCell(target, col);
      }
    }
  };

  // Plain text only. Text with tabs or newlines (copied from a spreadsheet)
  // fills the grid from this cell on, adding the rows and columns it needs.
  const handleCellPaste = (e: React.ClipboardEvent<HTMLDivElement>, row: number, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    if (!/[\t\r\n]/.test(text)) {
      document.execCommand('insertText', false, text);
      return;
    }
    const pasted = parseTsv(text);
    if (pasted.length === 0) return;
    if (pasted.length === 1 && pasted[0].length === 1) {
      document.execCommand('insertText', false, pasted[0][0]);
      return;
    }

    const grid = getGrid().map(r => [...r]);
    const oldCols = grid[0].length;
    const cols = Math.max(oldCols, col + Math.max(...pasted.map(r => r.length)));
    for (const r of grid) while (r.length < cols) r.push('');
    while (grid.length < row + pasted.length) grid.push(emptyRow(cols));
    pasted.forEach((line, i) => line.forEach((v, j) => {
      grid[row + i][col + j] = v.replace(/\n+$/, '');
    }));

    const widths = tableOptions(propsRef.current, oldCols).colWidths;
    setGrid(grid);
    if (widths && cols > oldCols) {
      updateProps({ colWidths: [...widths, ...Array<number>(cols - oldCols).fill(TABLE_DEFAULT_COL_WIDTH)] });
    }
    // The focused cell now holds new text; put the caret after it.
    pendingFocus.current = { row, col };
  };

  // Column resize, mirroring the image handles: pointer capture, the width is
  // only local while dragging and saved on pointerup.

  const startResize = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const headerCells = tableRef.current?.rows[0]?.cells;
    if (!headerCells) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Measure every column: the first drag turns an auto-sized table into a
    // fixed one, and the other columns must keep the width they have now.
    const widths = Array.from({ length: nCols }, (_, i) => Math.round(headerCells[i].getBoundingClientRect().width));
    resizeRef.current = { index, startX: e.clientX, startWidth: widths[index], widths, moved: false };
  };

  const moveResize = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    const width = Math.round(Math.min(TABLE_MAX_COL_WIDTH, Math.max(TABLE_MIN_COL_WIDTH, r.startWidth + e.clientX - r.startX)));
    r.widths = r.widths.map((w, i) => (i === r.index ? width : w));
    r.moved = true;
    setLiveWidths(r.widths);
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const r = resizeRef.current;
    if (!r) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setLiveWidths(null);
    if (commit && r.moved) updateProps({ colWidths: r.widths });
  };

  // Menus.

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, kind: 'row' | 'col', index: number) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu(kind === 'row'
      ? { kind, index, x: rect.right + 4, y: rect.top }
      : { kind, index, x: rect.left, y: rect.bottom + 4 });
  };

  const checkIcon = (on: boolean) =>
    on ? <CheckIcon size={14} /> : <span style={{ display: 'inline-block', width: 14, height: 14 }} />;

  const menuItems = ({ kind, index }: TableMenu): ContextMenuItem[] => [
    ...(kind === 'row'
      ? [
          { label: t('editor.tableInsertRowAbove'), icon: <PlusIcon size={14} />, onClick: () => insertRow(index, false) },
          { label: t('editor.tableInsertRowBelow'), icon: <PlusIcon size={14} />, onClick: () => insertRow(index, true) },
          { label: t('editor.tableDuplicateRow'), icon: <CopyIcon size={14} />, onClick: () => duplicateRow(index) },
          { label: t('editor.tableClearRow'), icon: <XIcon size={14} />, onClick: () => clearRow(index) },
          {
            label: t('editor.tableDeleteRow'),
            icon: <TrashIcon size={14} />,
            danger: true,
            disabled: data.rows.length === 0,
            onClick: () => deleteRow(index),
          },
        ]
      : [
          { label: t('editor.tableInsertColumnLeft'), icon: <PlusIcon size={14} />, onClick: () => insertColumn(index, false) },
          { label: t('editor.tableInsertColumnRight'), icon: <PlusIcon size={14} />, onClick: () => insertColumn(index, true) },
          { label: t('editor.tableDuplicateColumn'), icon: <CopyIcon size={14} />, onClick: () => duplicateColumn(index) },
          { label: t('editor.tableClearColumn'), icon: <XIcon size={14} />, onClick: () => clearColumn(index) },
          {
            label: t('editor.tableDeleteColumn'),
            icon: <TrashIcon size={14} />,
            danger: true,
            disabled: nCols <= 1,
            onClick: () => deleteColumn(index),
          },
        ]),
    { divider: true },
    { label: t('editor.tableHeaderRow'), icon: checkIcon(headerRow), onClick: toggleHeaderRow },
    { label: t('editor.tableHeaderColumn'), icon: checkIcon(headerColumn), onClick: toggleHeaderColumn },
  ];

  const grid = [data.columns, ...data.rows];
  const widths = liveWidths ?? colWidths;

  return (
    <div
      className="block-table-wrapper"
      ref={setWrapperRef}
      tabIndex={0}
      // Only keys pressed on the block itself are the editor's (block
      // navigation, Enter for a new block); cells and buttons handle their own.
      onKeyDown={(e) => {
        if (e.target === e.currentTarget) onKeyDown(block.id, e);
      }}
    >
      <div className={`block-table-scroll${widths ? ' block-table-scroll--fixed' : ''}`}>
        <table
          ref={tableRef}
          className={`block-table${widths ? ' block-table--fixed' : ''}`}
          style={widths ? { width: widths.reduce((sum, w) => sum + w, 0) + TABLE_ACTIONS_WIDTH } : undefined}
        >
          {widths && (
            <colgroup>
              {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
              <col style={{ width: TABLE_ACTIONS_WIDTH }} />
            </colgroup>
          )}
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const isHeader = (headerRow && ri === 0) || (headerColumn && ci === 0);
                  const Cell = isHeader ? 'th' : 'td';
                  const selected = menu !== null && (menu.kind === 'row' ? menu.index === ri : menu.index === ci);
                  return (
                    <Cell
                      key={ci}
                      className={`${isHeader ? 'block-table-th' : 'block-table-td'}${selected ? ' is-selected' : ''}`}
                    >
                      <TableCell
                        row={ri}
                        col={ci}
                        value={cell}
                        placeholder={t(headerRow && ri === 0 ? 'editor.tableHeaderPlaceholder' : 'editor.tableCellPlaceholder')}
                        inlineOpts={inlineOpts}
                        onCommit={commitCell}
                        onKeyDown={handleCellKeyDown}
                        onPaste={handleCellPaste}
                      />
                      {ci === 0 && (
                        <button
                          type="button"
                          className={`block-table-grip block-table-grip--row${menu?.kind === 'row' && menu.index === ri ? ' is-active' : ''}`}
                          tabIndex={-1}
                          title={t('editor.tableRowOptions')}
                          aria-label={t('editor.tableRowOptions')}
                          aria-haspopup="menu"
                          onClick={(e) => openMenu(e, 'row', ri)}
                        />
                      )}
                      {ri === 0 && (
                        <>
                          <button
                            type="button"
                            className={`block-table-grip block-table-grip--col${menu?.kind === 'col' && menu.index === ci ? ' is-active' : ''}`}
                            tabIndex={-1}
                            title={t('editor.tableColumnOptions')}
                            aria-label={t('editor.tableColumnOptions')}
                            aria-haspopup="menu"
                            onClick={(e) => openMenu(e, 'col', ci)}
                          />
                          <div
                            className={`block-table-resize${liveWidths && resizeRef.current?.index === ci ? ' is-active' : ''}`}
                            title={t('editor.tableResizeColumn')}
                            draggable={false}
                            onPointerDown={(e) => startResize(e, ci)}
                            onPointerMove={moveResize}
                            onPointerUp={(e) => endResize(e, true)}
                            onPointerCancel={(e) => endResize(e, false)}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (colWidths) updateProps({ colWidths: undefined });
                            }}
                          />
                        </>
                      )}
                    </Cell>
                  );
                })}
                <td className="block-table-actions">
                  {ri === 0 && (
                    <button
                      type="button"
                      className="block-table-add-col"
                      onClick={addColumn}
                      title={t('editor.addColumn')}
                      aria-label={t('editor.addColumn')}
                    >＋</button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={nCols + 1} className="block-table-add">
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
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu)}
          onClose={() => setMenu(null)}
        />
      )}
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
