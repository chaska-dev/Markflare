import React, { useRef } from 'react';
import { Block as BlockType, BlockProps } from '../types';
import { ArrowUpRightIcon, BookmarkIcon, EmbedIcon } from './Icons';
import { UrlField } from './UrlField';
import { useWidthResize } from '../hooks/useWidthResize';
import { blockUrl } from '../utils/bookmark';
import { mergeProps } from '../utils/blockProps';
import { EmbedInfo, embedFromUrl } from '../utils/embed';
import { useLanguage } from '../i18n/LanguageContext';

// The iframe of a supported provider. Everything about it comes from
// utils/embed.ts: the sandbox, the permissions it may ask for and the address,
// which is always https and always one of the allowlisted providers.
export function EmbedFrame({ info, className = '' }: { info: EmbedInfo; className?: string }) {
  return (
    <div
      className={`embed-frame ${className}`.trim()}
      style={info.height ? { height: info.height } : { aspectRatio: info.aspectRatio }}
    >
      <iframe
        className="embed-iframe"
        src={info.src}
        title={info.title}
        sandbox={info.sandbox}
        allow={info.allow}
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}

// Embed block in the editor, sized like an image: full column by default, the
// two side handles set a width in px (props.width), a double-click resets it.
// A link of an unsupported site is never framed: the block says so and offers a
// bookmark. The block is focusable like an image: Backspace deletes it.
export function EmbedBlock({
  block,
  setRef,
  onKeyDown,
  onContentChange,
  onPropsChange,
  onConvert,
}: {
  block: BlockType;
  setRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  onContentChange: (id: string, content: string) => void;
  onPropsChange?: (id: string, props: BlockProps) => void;
  // Turn this block into a bookmark of the same link.
  onConvert: (id: string) => void;
}) {
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const url = blockUrl(block.content);
  const info = url ? embedFromUrl(url) : null;

  const props: BlockProps = block.props ?? {};
  const savedWidth = typeof props.width === 'number' && props.width > 0 ? props.width : undefined;
  const { liveWidth, handleProps } = useWidthResize({
    wrapperRef,
    figureRef,
    align: 'center',
    savedWidth,
    onCommit: (width) => onPropsChange?.(block.id, mergeProps(props, { width })),
  });
  const figureWidth = liveWidth ?? savedWidth;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter on a button inside the block belongs to the button.
    if (e.key === 'Enter' && e.target !== e.currentTarget) return;
    onKeyDown(block.id, e);
  };

  const setWrapperRef = (el: HTMLDivElement | null) => {
    wrapperRef.current = el;
    setRef(el);
  };

  // Focusing an empty embed puts the caret in its field; coming back from the
  // field (Escape) must not undo that.
  const redirectFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (url || e.target !== e.currentTarget) return;
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    e.currentTarget.querySelector<HTMLInputElement>('.block-url-input')?.focus();
  };

  if (!url) {
    return (
      <div className="block-embed block-embed--empty" ref={setWrapperRef} tabIndex={0} onKeyDown={handleKeyDown} onFocus={redirectFocus}>
        <UrlField
          icon={<EmbedIcon size={16} />}
          placeholder={t('editor.embedPlaceholder')}
          initial={block.content}
          onSubmit={(next) => {
            onContentChange(block.id, next);
            // The field unmounts with the focus in it.
            setTimeout(() => wrapperRef.current?.focus(), 0);
          }}
          onCancel={() => wrapperRef.current?.focus()}
        />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="block-embed block-embed--unsupported" ref={setWrapperRef} tabIndex={0} onKeyDown={handleKeyDown}>
        <p className="block-embed-message">{t('editor.embedUnsupported')}</p>
        <div className="block-embed-actions">
          <button type="button" className="block-embed-action block-embed-action--primary" onClick={() => onConvert(block.id)}>
            <BookmarkIcon size={14} />
            <span>{t('editor.embedCreateBookmark')}</span>
          </button>
          <a className="block-embed-action" href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
            <ArrowUpRightIcon size={12} />
            <span>{t('ctx.openInNewTab')}</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`block-image block-embed${liveWidth !== null ? ' is-resizing' : ''}`}
      data-align="center"
      ref={setWrapperRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <figure
        className={`block-image-figure block-embed-figure${figureWidth ? ' block-image-figure--sized' : ''}`}
        style={figureWidth ? { width: figureWidth } : undefined}
        ref={figureRef}
      >
        <div className="block-image-frame">
          <EmbedFrame info={info} />
          {/* Own keys must not reach the editor (Enter would add a block). */}
          <div className="block-image-toolbar" role="toolbar" onKeyDown={(e) => e.stopPropagation()}>
            <a
              className="block-image-tool"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('ctx.openInNewTab')}
              aria-label={t('ctx.openInNewTab')}
            >
              <ArrowUpRightIcon size={14} />
            </a>
            <button
              type="button"
              className="block-image-tool"
              title={t('ctx.toBookmark')}
              aria-label={t('ctx.toBookmark')}
              onClick={() => onConvert(block.id)}
            >
              <BookmarkIcon size={14} />
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
      </figure>
    </div>
  );
}
