import React from 'react';
import { CheckIcon } from './Icons';
import { COLOR_NAMES } from '../utils/blockColor';
import { useLanguage } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/en';

interface Props {
  // Current block color (palette name); missing = default.
  value?: string;
  // Called with a palette name, or 'default' to clear the color.
  onSelect: (color: string) => void;
}

// Two columns, like Notion's Color menu: text colors and background colors.
// Used by the block context menu and by the floating format toolbar. The
// swatches take their colors from the data-color rules in editor.css.
export function ColorMenu({ value, onSelect }: Props) {
  const { t } = useLanguage();
  const current = value || 'default';

  const renderItem = (key: string, name: string, background: boolean) => {
    const selected = current === key;
    return (
      <button
        key={key}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        className="color-menu-item"
        onClick={() => onSelect(key)}
      >
        <span className="color-menu-swatch" data-color={key} data-swatch={background ? 'background' : 'text'}>A</span>
        <span className="color-menu-label">{t(`color.${name}` as TranslationKey)}</span>
        {selected && <CheckIcon size={12} className="color-menu-check" />}
      </button>
    );
  };

  return (
    <div
      className="color-menu"
      // Keep the text selection and focus in the editor while picking.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="color-menu-column" role="group" aria-label={t('color.text')}>
        <div className="color-menu-heading">{t('color.text')}</div>
        {renderItem('default', 'default', false)}
        {COLOR_NAMES.map(name => renderItem(name, name, false))}
      </div>
      <div className="color-menu-column" role="group" aria-label={t('color.background')}>
        <div className="color-menu-heading">{t('color.background')}</div>
        {COLOR_NAMES.map(name => renderItem(`${name}_background`, name, true))}
      </div>
    </div>
  );
}
