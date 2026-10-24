import React, { useState } from 'react';
import { normalizeWebUrl } from '../utils/bookmark';
import { useLanguage } from '../i18n/LanguageContext';

// The empty state of bookmark and embed blocks: a field to paste the link into,
// confirmed with Enter or the button. A bad address shows an inline error and
// nothing is saved. Its keys stay inside the field: Enter, Backspace and the
// arrows must not reach the editor, which would add, delete or move blocks.
export function UrlField({
  icon,
  placeholder,
  initial = '',
  onSubmit,
  onCancel,
}: {
  icon: React.ReactNode;
  placeholder: string;
  initial?: string;
  onSubmit: (url: string) => void;
  // Escape: give the block's focus back to the editor.
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeWebUrl(value);
    if (url) onSubmit(url);
    else setInvalid(true);
  };

  return (
    <form className="block-url-field" onSubmit={submit} noValidate>
      <div className={`block-url-row${invalid ? ' is-invalid' : ''}`}>
        <span className="block-url-icon">{icon}</span>
        <input
          className="block-url-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={invalid}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          // The editor reacts to pastes in a block (links become blocks): here
          // the text is just the address being typed.
          onPaste={(e) => e.stopPropagation()}
        />
        <button type="submit" className="block-url-submit" disabled={!value.trim()}>
          {t('editor.urlAdd')}
        </button>
      </div>
      {invalid && <p className="block-url-error" role="alert">{t('editor.urlInvalid')}</p>}
    </form>
  );
}
