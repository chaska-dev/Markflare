import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  SettingsIcon,
  PaletteIcon,
  LogOutIcon,
  UserIcon,
  KeyIcon,
  LockIcon,
} from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenWorkspaceSettings: () => void;
  onOpenColorPicker: () => void;
  onOpenApiToken: () => void;
  onOpenChangePassword: () => void;
  onOpenAdminUsers: () => void;
}

export function UserMenuPopover({
  open,
  onClose,
  onOpenWorkspaceSettings,
  onOpenColorPicker,
  onOpenApiToken,
  onOpenChangePassword,
  onOpenAdminUsers,
}: Props) {
  const { username, user, logout } = useAuth();
  const { theme, iconColorMode, customIconColor } = useTheme();
  const { t } = useLanguage();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const displayName = user?.displayName || username || 'Invitado';
  const role = user?.isAdmin ? t('sidebar.adminRole') : t('sidebar.userRole');

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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

  return (
    <>
      <div className="user-popover-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={popoverRef}
        className="user-menu-popover"
        role="menu"
        aria-label={t('userMenu.title')}
      >
        <div className="user-menu-header">
          <div className="user-menu-avatar">
            <UserIcon size={16} />
          </div>
          <div className="user-menu-info">
            <span className="user-menu-name">{displayName}</span>
            <span className="user-menu-role">{role}</span>
          </div>
        </div>

        <div className="user-menu-divider" />

        <div className="user-menu-list">
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenChangePassword();
            }}
          >
            <div className="user-menu-item-icon">
              <LockIcon size={16} />
            </div>
            <span className="user-menu-item-label">{t('userMenu.changePassword')}</span>
          </button>

          {user?.isAdmin && (
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                onOpenAdminUsers();
              }}
            >
              <div className="user-menu-item-icon">
                <UserIcon size={16} />
              </div>
              <span className="user-menu-item-label">{t('userMenu.adminUsers')}</span>
            </button>
          )}

          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenWorkspaceSettings();
            }}
          >
            <div className="user-menu-item-icon">
              <SettingsIcon size={16} />
            </div>
            <span className="user-menu-item-label">{t('userMenu.workspaceSettings')}</span>
          </button>

          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenColorPicker();
            }}
          >
            <div className="user-menu-item-icon">
              <PaletteIcon size={16} />
            </div>
            <span className="user-menu-item-label">{t('userMenu.iconColor')}</span>
            <div
              className="user-menu-color-indicator"
              style={{
                backgroundColor:
                  iconColorMode === 'custom'
                    ? customIconColor
                    : theme === 'dark'
                      ? '#FFFFFF'
                      : '#111111',
              }}
              title={
                iconColorMode === 'custom'
                  ? `${t('colorPicker.modeCustom')} (${customIconColor})`
                  : `${t('colorPicker.modeAuto')} (${theme === 'dark' ? '#FFFFFF' : '#111111'})`
              }
            />
          </button>

          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenApiToken();
            }}
          >
            <div className="user-menu-item-icon">
              <KeyIcon size={16} />
            </div>
            <span className="user-menu-item-label">{t('userMenu.apiToken')}</span>
          </button>
        </div>

        <div className="user-menu-divider" />

        <button
          type="button"
          className="user-menu-item user-menu-item--logout"
          role="menuitem"
          onClick={() => {
            onClose();
            logout();
          }}
        >
          <div className="user-menu-item-icon">
            <LogOutIcon size={16} />
          </div>
          <span className="user-menu-item-label">{t('userMenu.logout')}</span>
        </button>
      </div>
    </>
  );
}
