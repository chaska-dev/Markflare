import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export const PRESET_GRADIENTS = [
  { name: 'Parasti Terracotta', value: 'linear-gradient(135deg, #A34A2C 0%, #C05A3C 50%, #E08A6C 100%)' },
  { name: 'Sunset Coral', value: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
  { name: 'Cyberpunk', value: 'linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)' },
  { name: 'Deep Ocean', value: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)' },
  { name: 'Emerald', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Aurora', value: 'linear-gradient(135deg, #0575E6 0%, #00F260 100%)' },
  { name: 'Obsidian Dark', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Neon Dusk', value: 'linear-gradient(135deg, #2E0854 0%, #7B1FA2 100%)' },
];

export const PRESET_IMAGES = [
  {
    name: 'Minimal',
    thumb: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&auto=format&fit=crop&q=60',
    full: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Abstract 3D',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60',
    full: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Night City',
    thumb: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&auto=format&fit=crop&q=60',
    full: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Mountains',
    thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&auto=format&fit=crop&q=60',
    full: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&auto=format&fit=crop&q=80',
  },
];

interface CoverBannerProps {
  cover: string | null;
  onSetCover: (cover: string | null) => void;
}

export function CoverBanner({ cover, onSetCover }: CoverBannerProps) {
  const { t } = useLanguage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'gradients' | 'images' | 'custom'>('gradients');
  const [customUrl, setCustomUrl] = useState('');
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onSetCover(customUrl.trim());
      setCustomUrl('');
      setPickerOpen(false);
    }
  };

  const isGradient = cover?.startsWith('linear-gradient') || cover?.startsWith('radial-gradient');

  return (
    <div className="page-cover-container">
      {cover ? (
        <div
          className="page-cover-banner"
          style={
            isGradient
              ? { background: cover }
              : { backgroundImage: `url("${cover}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
          }
        >
          <div className="page-cover-actions">
            <span className="page-cover-dim-tag">1500 × 600 px</span>
            <button
              className="page-cover-action-btn"
              onClick={() => setPickerOpen(true)}
            >
              {t('cover.change')}
            </button>
            <button
              className="page-cover-action-btn page-cover-action-btn--remove"
              onClick={() => onSetCover(null)}
            >
              {t('cover.remove')}
            </button>
          </div>
        </div>
      ) : showPlaceholder ? (
        <div
          className="page-cover-placeholder"
          onClick={() => setPickerOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPickerOpen(true);
            }
          }}
          title={t('cover.clickToAdd')}
        >
          <div className="cover-placeholder-content">
            <div className="cover-placeholder-info">
              <span className="cover-placeholder-title">{t('cover.add')}</span>
              <span className="cover-placeholder-desc">
                {t('cover.requiredRes')}
              </span>
            </div>
            <div className="cover-placeholder-badges">
              <span className="cover-px-badge">1500 × 600 px</span>
              <span className="cover-ratio-badge">Ratio ~16:9</span>
            </div>
          </div>
          <button
            className="cover-placeholder-dismiss-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaceholder(false);
            }}
            title={t('cover.dismissPlaceholder')}
            aria-label={t('cover.dismissPlaceholder')}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="page-cover-hover-bar">
          <button className="page-hover-action-btn" onClick={() => setPickerOpen(true)}>
            {t('cover.add')} <span className="hover-btn-px-tag">1500 × 600 px</span>
          </button>
          <button
            className="page-hover-action-btn page-hover-action-btn--subtle"
            onClick={() => setShowPlaceholder(true)}
            title={t('cover.showFrame')}
          >
            {t('cover.showFrame')}
          </button>
        </div>
      )}

      {pickerOpen && (
        <div className="cover-picker-backdrop" onClick={() => setPickerOpen(false)}>
          <div
            ref={popoverRef}
            className="cover-picker-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t('cover.selectTitle')}
          >
            <div className="cover-picker-header">
              <span className="cover-picker-title">{t('cover.selectTitle')}</span>
              <div className="cover-picker-tabs">
                <button
                  className={`cover-picker-tab ${activeTab === 'gradients' ? 'active' : ''}`}
                  onClick={() => setActiveTab('gradients')}
                >
                  {t('cover.tabGradients')}
                </button>
                <button
                  className={`cover-picker-tab ${activeTab === 'images' ? 'active' : ''}`}
                  onClick={() => setActiveTab('images')}
                >
                  {t('cover.tabGallery')}
                </button>
                <button
                  className={`cover-picker-tab ${activeTab === 'custom' ? 'active' : ''}`}
                  onClick={() => setActiveTab('custom')}
                >
                  {t('cover.tabUrl')}
                </button>
              </div>
            </div>

            <div className="cover-picker-spec-banner">
              <div className="cover-spec-badge-group">
                <span className="cover-spec-pill">1500 × 600 px</span>
                <span className="cover-spec-ratio-pill">Ratio ~16:9 / 3:1</span>
              </div>
              <div className="cover-spec-text">
                {t('cover.specText')}
              </div>
            </div>

            <div className="cover-picker-content">
              {activeTab === 'gradients' && (
                <div className="cover-picker-grid">
                  {PRESET_GRADIENTS.map((g) => (
                    <div
                      key={g.name}
                      className="cover-preset-card"
                      style={{ background: g.value }}
                      onClick={() => {
                        onSetCover(g.value);
                        setPickerOpen(false);
                      }}
                      title={g.name}
                    >
                      <span className="cover-preset-label">{g.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'images' && (
                <div className="cover-picker-grid">
                  {PRESET_IMAGES.map((img) => (
                    <div
                      key={img.name}
                      className="cover-preset-card"
                      style={{ backgroundImage: `url("${img.thumb}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      onClick={() => {
                        onSetCover(img.full);
                        setPickerOpen(false);
                      }}
                      title={`${img.name} (1600 px)`}
                    >
                      <span className="cover-preset-label">{img.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'custom' && (
                <form onSubmit={handleCustomSubmit} className="cover-picker-form">
                  <div className="cover-picker-url-hint">
                    {t('cover.urlHint')}
                  </div>
                  <div className="cover-picker-input-group">
                    <input
                      type="url"
                      placeholder={t('cover.urlPlaceholder')}
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="cover-picker-input"
                      autoFocus
                    />
                    <button type="submit" className="cover-picker-submit-btn">
                      {t('cover.apply')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="cover-picker-footer">
              {cover && (
                <button
                  className="cover-picker-remove-btn"
                  onClick={() => {
                    onSetCover(null);
                    setPickerOpen(false);
                  }}
                >
                  {t('cover.removeCurrent')}
                </button>
              )}
              <button className="cover-picker-close-btn" onClick={() => setPickerOpen(false)}>
                {t('cover.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
