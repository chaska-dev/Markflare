import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  XIcon,
  PaletteIcon,
  SearchIcon,
  SunIcon,
  MoonIcon,
  PlusIcon,
  DocumentIcon,
  CheckIcon,
} from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS_DARK = [
  '#FFFFFF', // Pure White
  '#C05A3C', // Parasti Terracotta
  '#60A5FA', // Blue
  '#34D399', // Emerald
  '#A78BFA', // Violet
  '#F472B6', // Pink
  '#FB7185', // Strong Pink
  '#FBBF24', // Amber
  '#38BDF8', // Cyan
  '#9CA3AF', // Light Gray
];

const PRESET_COLORS_LIGHT = [
  '#111111', // Pure Black
  '#C05A3C', // Parasti Terracotta
  '#2563EB', // Strong Blue
  '#059669', // Strong Green
  '#7C3AED', // Strong Purple
  '#DB2777', // Strong Pink
  '#E11D48', // Crimson
  '#D97706', // Strong Amber
  '#0891B2', // Strong Cyan
  '#4B5563', // Charcoal Gray
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 243, g: 128, b: 32 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function IconColorPickerModal({ open, onClose }: Props) {
  const {
    theme: activeAppTheme,
    customIconColorDark,
    customIconColorLight,
    iconColorModeDark,
    iconColorModeLight,
    setCustomIconColorForTheme,
    resetIconColorForTheme,
  } = useTheme();
  const { t } = useLanguage();

  // User can toggle which theme they're configuring (Dark / Light).
  const [targetTheme, setTargetTheme] = useState<Theme>(activeAppTheme);

  const activeColorForTheme = targetTheme === 'dark' ? customIconColorDark : customIconColorLight;
  const activeModeForTheme = targetTheme === 'dark' ? iconColorModeDark : iconColorModeLight;

  const [currentColor, setCurrentColor] = useState(activeColorForTheme);
  const [rgb, setRgb] = useState(() => hexToRgb(activeColorForTheme));
  const [hexInput, setHexInput] = useState(activeColorForTheme);

  const modalRef = useRef<HTMLDivElement | null>(null);

  // On open or targetTheme change, sync local state with the target theme's color.
  useEffect(() => {
    if (open) {
      const color = targetTheme === 'dark' ? customIconColorDark : customIconColorLight;
      setCurrentColor(color);
      setRgb(hexToRgb(color));
      setHexInput(color);
    }
  }, [open, targetTheme, customIconColorDark, customIconColorLight]);

  // Close on Escape or outside click.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const updateColor = (hex: string) => {
    setCurrentColor(hex);
    setHexInput(hex);
    setRgb(hexToRgb(hex));
    setCustomIconColorForTheme(targetTheme, hex);
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const updated = { ...rgb, [channel]: value };
    setRgb(updated);
    const hex = rgbToHex(updated.r, updated.g, updated.b);
    setCurrentColor(hex);
    setHexInput(hex);
    setCustomIconColorForTheme(targetTheme, hex);
  };

  const handleHexInputChange = (value: string) => {
    setHexInput(value);
    const clean = value.trim();
    if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(clean)) {
      const formatted = clean.startsWith('#') ? clean : `#${clean}`;
      setCurrentColor(formatted);
      setRgb(hexToRgb(formatted));
      setCustomIconColorForTheme(targetTheme, formatted);
    }
  };

  const handleResetAuto = () => {
    resetIconColorForTheme(targetTheme);
    const defaultColor = targetTheme === 'dark' ? '#FFFFFF' : '#111111';
    setCurrentColor(defaultColor);
    setHexInput(defaultColor);
    setRgb(hexToRgb(defaultColor));
  };

  const presets = targetTheme === 'dark' ? PRESET_COLORS_DARK : PRESET_COLORS_LIGHT;
  const isCustomActive = activeModeForTheme === 'custom';

  return createPortal(
    <>
      <div className="icon-picker-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        className="icon-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="icon-color-picker-title"
      >
        <div className="icon-picker-header">
          <div className="icon-picker-title-wrap">
            <PaletteIcon size={18} />
            <h2 id="icon-color-picker-title" className="icon-picker-title">
              {t('colorPicker.title')}
            </h2>
          </div>
          <button
            type="button"
            className="icon-picker-close-btn"
            onClick={onClose}
            aria-label={t('colorPicker.close')}
          >
            <XIcon size={16} />
          </button>
        </div>

        <p className="icon-picker-subtitle">{t('colorPicker.subtitle')}</p>

        <div className="icon-picker-theme-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={targetTheme === 'dark'}
            className={`icon-picker-theme-tab ${targetTheme === 'dark' ? 'active' : ''}`}
            onClick={() => setTargetTheme('dark')}
          >
            <MoonIcon size={14} />
            <span>{t('colorPicker.tabDark')}</span>
            <span
              className="theme-tab-color-dot"
              style={{
                backgroundColor: iconColorModeDark === 'custom' ? customIconColorDark : '#FFFFFF',
              }}
              title={iconColorModeDark === 'custom' ? customIconColorDark : `${t('colorPicker.modeAuto')} (#FFFFFF)`}
            />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={targetTheme === 'light'}
            className={`icon-picker-theme-tab ${targetTheme === 'light' ? 'active' : ''}`}
            onClick={() => setTargetTheme('light')}
          >
            <SunIcon size={14} />
            <span>{t('colorPicker.tabLight')}</span>
            <span
              className="theme-tab-color-dot"
              style={{
                backgroundColor: iconColorModeLight === 'custom' ? customIconColorLight : '#111111',
              }}
              title={iconColorModeLight === 'custom' ? customIconColorLight : `${t('colorPicker.modeAuto')} (#111111)`}
            />
          </button>
        </div>

        <div className={`icon-picker-preview-box icon-picker-preview-box--${targetTheme}`}>
          <div className="icon-picker-preview-label">
            {t('colorPicker.preview')} ({targetTheme === 'dark' ? t('colorPicker.tabDark') : t('colorPicker.tabLight')})
          </div>
          <div
            className="icon-picker-preview-row"
            style={{
              '--icon-color': isCustomActive ? currentColor : (targetTheme === 'dark' ? '#FFFFFF' : '#111111'),
            } as React.CSSProperties}
          >
            <div className="preview-icon-wrapper" aria-hidden="true">
              <PaletteIcon size={24} />
            </div>
            <div className="preview-icon-wrapper" aria-hidden="true">
              <SearchIcon size={24} />
            </div>
            <div className="preview-icon-wrapper" aria-hidden="true">
              <SunIcon size={24} />
            </div>
            <div className="preview-icon-wrapper" aria-hidden="true">
              <PlusIcon size={24} />
            </div>
            <div className="preview-icon-wrapper" aria-hidden="true">
              <DocumentIcon size={24} />
            </div>
          </div>
          <div className="icon-picker-status-tag">
            {isCustomActive ? (
              <span className="status-tag status-tag--custom">
                ● {t('colorPicker.modeCustom')}: <code>{currentColor}</code>
              </span>
            ) : (
              <span className="status-tag status-tag--auto">
                ● {t('colorPicker.modeAuto')} ({targetTheme === 'dark' ? '#FFFFFF' : '#111111'})
              </span>
            )}
          </div>
        </div>

        <div className="icon-picker-section">
          <label className="icon-picker-label">{t('colorPicker.presets')}</label>
          <div className="icon-picker-swatches">
            {presets.map((hex) => {
              const isActive = isCustomActive && currentColor.toUpperCase() === hex.toUpperCase();
              return (
                <button
                  key={hex}
                  type="button"
                  className={`color-swatch-btn ${isActive ? 'active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => updateColor(hex)}
                  title={hex}
                  aria-label={`Color ${hex}`}
                >
                  {isActive && (
                    <CheckIcon
                      size={14}
                      style={{
                        stroke: hex.toLowerCase() === '#ffffff' ? '#111' : '#fff',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="icon-picker-section">
          <label className="icon-picker-label">{t('colorPicker.mixer')}</label>
          <div className="rgb-mixer-controls">
            <div className="rgb-slider-row">
              <span className="rgb-slider-name" style={{ color: '#ef4444' }}>
                {t('colorPicker.red')}
              </span>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.r}
                onChange={(e) => handleRgbChange('r', Number(e.target.value))}
                className="rgb-slider rgb-slider--r"
              />
              <span className="rgb-slider-value">{rgb.r}</span>
            </div>

            <div className="rgb-slider-row">
              <span className="rgb-slider-name" style={{ color: '#10b981' }}>
                {t('colorPicker.green')}
              </span>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.g}
                onChange={(e) => handleRgbChange('g', Number(e.target.value))}
                className="rgb-slider rgb-slider--g"
              />
              <span className="rgb-slider-value">{rgb.g}</span>
            </div>

            <div className="rgb-slider-row">
              <span className="rgb-slider-name" style={{ color: '#3b82f6' }}>
                {t('colorPicker.blue')}
              </span>
              <input
                type="range"
                min="0"
                max="255"
                value={rgb.b}
                onChange={(e) => handleRgbChange('b', Number(e.target.value))}
                className="rgb-slider rgb-slider--b"
              />
              <span className="rgb-slider-value">{rgb.b}</span>
            </div>
          </div>
        </div>

        <div className="icon-picker-footer-inputs">
          <div className="hex-input-group">
            <span className="hex-input-label">{t('colorPicker.hex')}</span>
            <div className="hex-input-box">
              <input
                type="color"
                value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : (targetTheme === 'dark' ? '#FFFFFF' : '#111111')}
                onChange={(e) => updateColor(e.target.value)}
                className="native-color-picker"
                title={t('colorPicker.presets')}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexInputChange(e.target.value)}
                maxLength={7}
                placeholder={targetTheme === 'dark' ? '#FFFFFF' : '#111111'}
                className="hex-text-input"
              />
            </div>
          </div>

          <button
            type="button"
            className="icon-picker-reset-btn"
            onClick={handleResetAuto}
            title={t('colorPicker.resetAuto')}
          >
            {t('colorPicker.resetAuto')}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
