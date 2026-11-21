import React, { useRef, useState } from 'react';
import { Block as BlockType, BookmarkPreview } from '../types';
import { BookmarkIcon, LinkIcon } from './Icons';
import { UrlField } from './UrlField';
import { PreviewStatus } from '../hooks/useBookmarkPreview';
import { blockUrl, displayUrl } from '../utils/bookmark';
import { useLanguage } from '../i18n/LanguageContext';

// The link card of a web bookmark: title, description, favicon + address and the
// preview picture, all from the cached props.preview (the page is never fetched
// from here). Shared by the editor and the public view. Pictures load without a
// referrer, and only http(s) addresses reach this far (see utils/bookmark.ts).
export function BookmarkCard({ url, preview, status = 'idle' }: { url: string; preview: BookmarkPreview | null; status?: PreviewStatus }) {
  const { t } = useLanguage();
  // Pictures that failed to load are left out instead of showing a broken icon.
  const [failed, setFailed] = useState<{ image?: string; favicon?: string }>({});
  const image = preview?.image && failed.image !== preview.image ? preview.image : null;
  const favicon = preview?.favicon && failed.favicon !== preview.favicon ? preview.favicon : null;
  const title = preview?.title || displayUrl(url);
  const note = status === 'loading' ? t('editor.bookmarkLoading') : status === 'error' ? t('editor.bookmarkNoPreview') : null;

  return (
    <a
      className={`bookmark-card${status === 'loading' ? ' is-loading' : ''}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      tabIndex={-1}
      title={url}
    >
      <span className="bookmark-body">
        <span className="bookmark-title">{title}</span>
        {preview?.description && <span className="bookmark-description">{preview.description}</span>}
        {note && <span className="bookmark-note">{note}</span>}
        <span className="bookmark-meta">
          {favicon ? (
            <img
              className="bookmark-favicon"
              src={favicon}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => setFailed(f => ({ ...f, favicon }))}
            />
          ) : (
            <LinkIcon size={14} />
          )}
          <span className="bookmark-url">{displayUrl(url)}</span>
        </span>
      </span>
      {image && (
        <span className="bookmark-image">
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setFailed(f => ({ ...f, image }))}
          />
        </span>
      )}
    </a>
  );
}

// Bookmark block in the editor. With a URL it is the card; without one (new
// block, or content that isn't a web address) it asks for the link. The block
// is focusable like an image: Space opens the link, Backspace deletes the block.
export function BookmarkBlock({
  block,
  setRef,
  onKeyDown,
  onContentChange,
  preview,
  status,
}: {
  block: BlockType;
  setRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  onContentChange: (id: string, content: string) => void;
  preview: BookmarkPreview | null;
  status: PreviewStatus;
}) {
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const url = blockUrl(block.content);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter on the link itself or a button inside the block belongs to it.
    if (e.key === 'Enter' && e.target !== e.currentTarget) return;
    if (e.key === ' ' && e.target === e.currentTarget && url) {
      e.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    onKeyDown(block.id, e);
  };

  return (
    <div
      className="block-bookmark"
      ref={(el) => {
        wrapperRef.current = el;
        setRef(el);
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      // Focusing an empty bookmark (slash menu, arrow keys) puts the caret in
      // its field; coming back from the field (Escape) must not undo that.
      onFocus={(e) => {
        if (url || e.target !== e.currentTarget) return;
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        e.currentTarget.querySelector<HTMLInputElement>('.block-url-input')?.focus();
      }}
    >
      {url ? (
        <BookmarkCard url={url} preview={preview} status={status} />
      ) : (
        <UrlField
          icon={<BookmarkIcon size={16} />}
          placeholder={t('editor.bookmarkPlaceholder')}
          initial={block.content}
          onSubmit={(next) => {
            onContentChange(block.id, next);
            // The field unmounts with the focus in it.
            setTimeout(() => wrapperRef.current?.focus(), 0);
          }}
          onCancel={() => wrapperRef.current?.focus()}
        />
      )}
    </div>
  );
}
