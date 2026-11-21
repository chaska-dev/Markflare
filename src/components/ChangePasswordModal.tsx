import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import { LockIcon, XIcon, LoaderIcon, CheckIcon } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  background: 'var(--bg-secondary, #212126)',
  border: '1px solid var(--border-color, #2e2e38)',
  color: 'var(--text-primary, #e8e8ea)',
  fontSize: 13,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary, #999)',
};

export function ChangePasswordModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError(t('changePassword.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePassword.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || t('common.errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="import-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-modal-title"
        style={{ maxWidth: 420 }}
      >
        <header className="import-modal-header">
          <div className="import-modal-title-wrap">
            <LockIcon size={18} />
            <h2 id="change-password-modal-title" className="import-modal-title">
              {t('changePassword.title')}
            </h2>
          </div>
          <button
            type="button"
            className="import-modal-close-btn"
            onClick={onClose}
            aria-label={t('changePassword.close')}
          >
            <XIcon size={16} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckIcon size={16} />
              <span>{t('changePassword.success')}</span>
            </div>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>{t('changePassword.current')}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              disabled={saving}
              required
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>{t('changePassword.new')}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              disabled={saving}
              required
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>{t('changePassword.confirm')}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              disabled={saving}
              required
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'transparent',
                color: 'var(--text-secondary, #999)',
                border: '1px solid var(--border-color, #2e2e38)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('changePassword.close')}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                borderRadius: 8,
                background: 'var(--accent, #6366f1)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <LoaderIcon size={14} className="spin" /> : <LockIcon size={14} />}
              <span>{saving ? t('changePassword.submitting') : t('changePassword.submit')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
