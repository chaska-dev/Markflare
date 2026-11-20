import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, AdminUser } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  UserIcon,
  XIcon,
  PlusIcon,
  LoaderIcon,
  CheckIcon,
  KeyIcon,
} from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
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

const mutedText: React.CSSProperties = {
  color: 'var(--text-tertiary, #777)',
  fontSize: 12,
};

export function AdminUsersModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const [resetForId, setResetForId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.listUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err?.message || t('adminUsers.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setShowAdd(false);
    setNewUsername('');
    setNewDisplayName('');
    setNewPassword('');
    setNewIsAdmin(false);
    setResetForId(null);
    setResetPassword('');
    setError(null);
    setNotice(null);
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const updateUser = async (id: string, data: { isActive?: boolean; isAdmin?: boolean; displayName?: string }) => {
    setSavingId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.admin.updateUser(id, data);
      setUsers(prev => prev.map(u => (u.id === id ? res.user : u)));
    } catch (err: any) {
      setError(err?.message || t('common.errorGeneric'));
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCreating(true);
    try {
      await api.admin.createUser({
        username: newUsername,
        displayName: newDisplayName.trim() || undefined,
        password: newPassword,
        isAdmin: newIsAdmin,
      });
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewIsAdmin(false);
      setShowAdd(false);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || t('common.errorGeneric'));
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (resetPassword.length < 8) {
      setError(t('changePassword.tooShort'));
      return;
    }
    setResetting(true);
    try {
      await api.admin.resetPassword(id, resetPassword);
      setResetForId(null);
      setResetPassword('');
      setNotice(t('changePassword.success'));
    } catch (err: any) {
      setError(err?.message || t('common.errorGeneric'));
    } finally {
      setResetting(false);
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
        aria-labelledby="admin-users-modal-title"
        style={{ maxWidth: 760, maxHeight: '88vh' }}
      >
        <header className="import-modal-header">
          <div className="import-modal-title-wrap">
            <UserIcon size={18} />
            <h2 id="admin-users-modal-title" className="import-modal-title">
              {t('adminUsers.title')}
            </h2>
          </div>
          <button
            type="button"
            className="import-modal-close-btn"
            onClick={onClose}
            aria-label={t('adminUsers.close')}
          >
            <XIcon size={16} />
          </button>
        </header>

        <p className="import-modal-subtitle">{t('adminUsers.subtitle')}</p>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
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
          {notice && (
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
              <span>{notice}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setShowAdd(prev => !prev);
                setError(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                background: 'var(--accent, #6366f1)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <PlusIcon size={14} />
              <span>{t('adminUsers.add')}</span>
            </button>
          </div>

          {showAdd && (
            <form
              onSubmit={handleCreate}
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px dashed var(--border-color, #2e2e38)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>{t('adminUsers.username')}</span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={inputStyle}
                    autoComplete="off"
                    required
                    disabled={creating}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>{t('adminUsers.displayName')}</span>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    style={inputStyle}
                    autoComplete="off"
                    disabled={creating}
                  />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={labelStyle}>{t('adminUsers.password')}</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={inputStyle}
                    autoComplete="new-password"
                    required
                    disabled={creating}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 9 }}>
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    disabled={creating}
                  />
                  <span style={{ ...labelStyle, fontWeight: 500 }}>{t('adminUsers.admin')}</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'var(--text-secondary, #999)',
                    border: '1px solid var(--border-color, #2e2e38)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {t('adminUsers.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 16px',
                    borderRadius: 8,
                    background: 'var(--accent, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating && <LoaderIcon size={13} className="spin" />}
                  <span>{creating ? t('adminUsers.creating') : t('adminUsers.create')}</span>
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', ...mutedText }}>
              <LoaderIcon size={20} className="spin" />
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                border: '1px dashed var(--border-color, #2e2e38)',
                borderRadius: 8,
                ...mutedText,
              }}
            >
              {t('adminUsers.empty')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary, #999)' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('adminUsers.username')}</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('adminUsers.displayName')}</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('adminUsers.admin')}</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('adminUsers.active')}</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>{t('adminUsers.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    const busy = savingId === u.id;
                    return (
                      <React.Fragment key={u.id}>
                        <tr style={{ borderTop: '1px solid var(--border-color, #2e2e38)' }}>
                          <td style={{ padding: '10px', fontWeight: 500, color: 'var(--text-primary, #e8e8ea)' }}>
                            {u.username}
                            {isSelf && (
                              <span style={{ ...mutedText, marginLeft: 6 }}>({t('adminUsers.you')})</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-secondary, #bbb)' }}>
                            {u.displayName || u.username}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={u.isAdmin}
                                disabled={isSelf || busy}
                                onChange={(e) => updateUser(u.id, { isAdmin: e.target.checked })}
                              />
                              <span style={mutedText}>{u.isAdmin ? t('adminUsers.admin') : '—'}</span>
                            </label>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="checkbox"
                                checked={u.isActive}
                                disabled={isSelf || busy}
                                onChange={(e) => updateUser(u.id, { isActive: e.target.checked })}
                              />
                              <span style={mutedText}>
                                {u.isActive ? t('adminUsers.active') : t('adminUsers.inactive')}
                              </span>
                            </label>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setResetForId(resetForId === u.id ? null : u.id);
                                setResetPassword('');
                                setError(null);
                                setNotice(null);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '5px 10px',
                                borderRadius: 6,
                                background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                                color: 'var(--text-secondary, #ccc)',
                                border: '1px solid var(--border-color, #2e2e38)',
                                fontSize: 12,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <KeyIcon size={13} />
                              <span>{t('adminUsers.resetPassword')}</span>
                            </button>
                          </td>
                        </tr>
                        {resetForId === u.id && (
                          <tr>
                            <td colSpan={5} style={{ padding: '0 10px 12px' }}>
                              <form
                                onSubmit={(e) => handleReset(e, u.id)}
                                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                              >
                                <input
                                  type="password"
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  placeholder={t('adminUsers.newPassword')}
                                  aria-label={t('adminUsers.newPassword')}
                                  style={{ ...inputStyle, maxWidth: 280 }}
                                  autoComplete="new-password"
                                  autoFocus
                                  disabled={resetting}
                                  required
                                />
                                <button
                                  type="submit"
                                  disabled={resetting}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    background: 'var(--accent, #6366f1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: resetting ? 'not-allowed' : 'pointer',
                                    opacity: resetting ? 0.7 : 1,
                                  }}
                                >
                                  {resetting && <LoaderIcon size={13} className="spin" />}
                                  <span>{resetting ? t('adminUsers.resetting') : t('adminUsers.save')}</span>
                                </button>
                              </form>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
