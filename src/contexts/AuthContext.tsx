import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { api, ApiUser } from '../api/client';
import { clearRecentPages } from '../utils/workspaceStorage';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  user: ApiUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const expiryTimer = useRef<number | null>(null);

  const clearExpiryTimer = () => {
    if (expiryTimer.current !== null) {
      window.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  };

  const logout = () => {
    clearExpiryTimer();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_expires_at');
    localStorage.removeItem('auth_display_name');
    localStorage.removeItem('auth_is_admin');
    clearRecentPages();
    setIsAuthenticated(false);
    setUsername(null);
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUsername = localStorage.getItem('auth_username');
    const savedDisplayName = localStorage.getItem('auth_display_name');
    const savedIsAdmin = localStorage.getItem('auth_is_admin');
    const expStr = localStorage.getItem('auth_expires_at');
    const exp = expStr ? Number(expStr) : NaN;

    if (token && savedUsername && Number.isFinite(exp)) {
      if (Date.now() < exp) {
        setIsAuthenticated(true);
        setUsername(savedUsername);
        setUser({
          id: '',
          username: savedUsername,
          displayName: savedDisplayName || savedUsername,
          isAdmin: savedIsAdmin === '1',
        });
        // Refresh display name and admin flag: tokens issued before phase 1
        // have neither in localStorage, and an admin change on another device
        // should apply here too.
        api.auth.me()
          .then(me => {
            localStorage.setItem('auth_display_name', me.displayName);
            localStorage.setItem('auth_is_admin', me.isAdmin ? '1' : '0');
            setUsername(me.username);
            setUser(me);
          })
          .catch(() => {
            // 401 already clears storage and redirects to /login.
          });
        // Auto-logout on expiry so we never operate with a dead token.
        const ms = Math.max(0, exp - Date.now());
        expiryTimer.current = window.setTimeout(() => {
          logout();
        }, ms);
      } else {
        // Expired token: clean up and force re-login.
        logout();
      }
    } else if (token) {
      // Token without expiry (old backend version): force re-login.
      logout();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (user: string, pass: string) => {
    const result = await api.auth.login(user, pass);
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('auth_username', result.username);
    localStorage.setItem('auth_display_name', result.displayName || result.username);
    localStorage.setItem('auth_is_admin', result.isAdmin ? '1' : '0');
    if (typeof result.expiresAt === 'number') {
      localStorage.setItem('auth_expires_at', String(result.expiresAt));
      const ms = Math.max(0, result.expiresAt - Date.now());
      clearExpiryTimer();
      expiryTimer.current = window.setTimeout(() => {
        logout();
      }, ms);
    }
    // Recents are per device: the previous user's page titles must not leak
    // into this session's sidebar.
    clearRecentPages();
    setIsAuthenticated(true);
    setUsername(result.username);
    setUser({
      id: '',
      username: result.username,
      displayName: result.displayName || result.username,
      isAdmin: Boolean(result.isAdmin),
    });
  };

  useEffect(() => {
    return () => clearExpiryTimer();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
