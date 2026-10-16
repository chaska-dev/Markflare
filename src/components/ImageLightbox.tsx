// Full-size image viewer shared by the editor (Block) and the public shared
// view (ReadOnlyBlock). Rendered through a portal so no ancestor's overflow,
// transform or stacking context can clip it.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  const { t } = useLanguage();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // The parent passes a fresh callback on every render; keeping it in a ref lets
  // the effect below run once, otherwise it would re-save the focus target each time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Remember who had focus (the image block) so closing puts it back there.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Capture phase + stop: Esc must only close the viewer, not also reach
        // editor-level handlers (slash menu, selection, ...).
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        // The close button is the only focusable element, so Tab just stays on it.
        e.preventDefault();
        closeBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      // React events cross portals into the parent tree. The viewer renders
      // inside an image block, so without this its keys and pastes would reach
      // the block / editor handlers (Enter creating a block, Backspace deleting
      // it, a paste uploading a file).
      onKeyDown={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        // Anything but the picture itself counts as the backdrop.
        if ((e.target as HTMLElement).tagName !== 'IMG') onClose();
      }}
    >
      <button
        ref={closeBtnRef}
        type="button"
        className="media-lightbox-close"
        onClick={onClose}
        aria-label={t('editor.imageClose')}
      >
        <XIcon size={20} />
      </button>
      <img className="media-lightbox-img" src={src} alt={alt} decoding="async" draggable={false} />
    </div>,
    document.body
  );
}
