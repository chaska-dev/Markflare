import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  UserIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  SunIcon,
  MoonIcon,
} from './Icons';

export function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-top-bar">
        <LanguageSwitcher direction="down" align="right" />
        <button
          type="button"
          className="login-theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
          aria-label={theme === 'dark' ? t('sidebar.themeLight') : t('sidebar.themeDark')}
        >
          {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
      </div>

      <div className="login-ambient-glow" aria-hidden="true" />

      <motion.form
        className="login-card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="login-icon-wrapper"
          style={{ transformOrigin: '50% 100%', willChange: 'transform' }}
          animate={
            reduceMotion
              ? undefined
              : {
                  y: [0, -6, -2, 0],
                  rotate: [0, -1.4, 0.9, 0],
                  scale: [1, 1.015, 1.005, 1],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : { repeat: Infinity, duration: 6, ease: 'easeInOut', times: [0, 0.35, 0.72, 1] }
          }
        >
          <Logo size={58} variant="icon" />
        </motion.div>

        <div className="login-brand-header">
          <div className="workspace-brand-text login-brand-title">
            <Logo size={92} variant="word" />
          </div>
          <span className="login-badge">Cloudflare Workspace</span>
        </div>

        <p className="login-subtitle">{t('login.subtitle')}</p>

        {error && (
          <motion.div
            className="login-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        <div className="login-inputs-group">
          <div className="login-field">
            <div className="login-field-icon">
              <UserIcon size={16} />
            </div>
            <input
              type="text"
              className="login-input"
              placeholder={t('login.username')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <div className="login-field-icon">
              <LockIcon size={16} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="login-input login-input--password"
              placeholder={t('login.password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword(prev => !prev)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          className="login-btn"
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <span className="login-btn-content">
              <LoaderIcon size={16} />
              <span>{t('login.submit')}...</span>
            </span>
          ) : (
            t('login.submit')
          )}
        </motion.button>
      </motion.form>
    </div>
  );
}
