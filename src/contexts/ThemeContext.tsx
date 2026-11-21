import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'light';
export type IconColorMode = 'auto' | 'custom';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  iconColorMode: IconColorMode;
  customIconColor: string;
  setIconColorMode: (mode: IconColorMode) => void;
  setCustomIconColor: (color: string) => void;
  resetIconColor: () => void;

  // Soporte dual de temas (color independiente para modo oscuro y claro)
  customIconColorDark: string;
  customIconColorLight: string;
  iconColorModeDark: IconColorMode;
  iconColorModeLight: IconColorMode;
  setCustomIconColorForTheme: (targetTheme: Theme, color: string) => void;
  setIconColorModeForTheme: (targetTheme: Theme, mode: IconColorMode) => void;
  resetIconColorForTheme: (targetTheme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'parasti_theme';
const ICON_MODE_KEY = 'parasti_icon_mode';
const ICON_COLOR_KEY = 'parasti_icon_color';

const ICON_MODE_DARK_KEY = 'parasti_icon_mode_dark';
const ICON_COLOR_DARK_KEY = 'parasti_icon_color_dark';
const ICON_MODE_LIGHT_KEY = 'parasti_icon_mode_light';
const ICON_COLOR_LIGHT_KEY = 'parasti_icon_color_light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.error('Read theme error:', e);
    }
    return 'light'; // default theme
  });

  // Dark theme: color and mode state.
  const [iconColorModeDark, setIconColorModeDark] = useState<IconColorMode>(() => {
    try {
      const saved = localStorage.getItem(ICON_MODE_DARK_KEY);
      if (saved === 'custom' || saved === 'auto') return saved;
      const legacy = localStorage.getItem(ICON_MODE_KEY);
      if (legacy === 'custom') return 'custom';
    } catch {
      // fallback
    }
    return 'auto';
  });

  const [customIconColorDark, setCustomIconColorDark] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ICON_COLOR_DARK_KEY);
      if (saved) return saved;
      const legacy = localStorage.getItem(ICON_COLOR_KEY);
      if (legacy) return legacy;
    } catch {
      // fallback
    }
    return '#FFFFFF'; // dark theme default
  });

  // Light theme: color and mode state.
  const [iconColorModeLight, setIconColorModeLight] = useState<IconColorMode>(() => {
    try {
      const saved = localStorage.getItem(ICON_MODE_LIGHT_KEY);
      if (saved === 'custom' || saved === 'auto') return saved;
      const legacy = localStorage.getItem(ICON_MODE_KEY);
      if (legacy === 'custom') return 'custom';
    } catch {
      // fallback
    }
    return 'auto';
  });

  const [customIconColorLight, setCustomIconColorLight] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ICON_COLOR_LIGHT_KEY);
      if (saved) return saved;
      const legacy = localStorage.getItem(ICON_COLOR_KEY);
      if (legacy) return legacy;
    } catch {
      // fallback
    }
    return '#111111'; // light theme default
  });

  // Sync theme to DOM and localStorage.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.error('Save theme error:', e);
    }
  }, [theme]);

function getContrastColor(hex: string): string {
  try {
    let clean = hex.replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (!isNaN(num) && clean.length === 6) {
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 150 ? '#111111' : '#FFFFFF';
    }
  } catch {
    // fallback
  }
  return '#FFFFFF';
}

  // Sync CSS variables and persistence based on the active theme.
  useEffect(() => {
    const isDark = theme === 'dark';
    const activeMode = isDark ? iconColorModeDark : iconColorModeLight;
    const activeColor = isDark ? customIconColorDark : customIconColorLight;

    if (activeMode === 'custom') {
      document.documentElement.style.setProperty('--icon-color', activeColor);
      document.documentElement.style.setProperty('--accent', activeColor);
      document.documentElement.style.setProperty('--accent-hover', activeColor);
      document.documentElement.style.setProperty('--link-color', activeColor);
      document.documentElement.style.setProperty('--accent-contrast', getContrastColor(activeColor));
    } else {
      // Auto mode: CSS variables inherit the theme's default colors.
      document.documentElement.style.removeProperty('--icon-color');
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--link-color');
      document.documentElement.style.removeProperty('--accent-contrast');
    }

    try {
      localStorage.setItem(ICON_MODE_DARK_KEY, iconColorModeDark);
      localStorage.setItem(ICON_COLOR_DARK_KEY, customIconColorDark);
      localStorage.setItem(ICON_MODE_LIGHT_KEY, iconColorModeLight);
      localStorage.setItem(ICON_COLOR_LIGHT_KEY, customIconColorLight);

      // Legacy keys (single-theme icon color).
      localStorage.setItem(ICON_MODE_KEY, activeMode);
      localStorage.setItem(ICON_COLOR_KEY, activeColor);
    } catch (e) {
      console.error('Save icon preferences error:', e);
    }
  }, [theme, iconColorModeDark, customIconColorDark, iconColorModeLight, customIconColorLight]);

  const applyTheme = (newTheme: Theme) => {
    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      try {
        (document as any).startViewTransition(() => {
          flushSync(() => {
            setThemeState(newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
          });
        });
        return;
      } catch {
        // startViewTransition fallback
      }
    }
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (newTheme: Theme) => {
    applyTheme(newTheme);
  };

  const setCustomIconColorForTheme = (targetTheme: Theme, color: string) => {
    if (targetTheme === 'dark') {
      setCustomIconColorDark(color);
      setIconColorModeDark('custom');
    } else {
      setCustomIconColorLight(color);
      setIconColorModeLight('custom');
    }
  };

  const setIconColorModeForTheme = (targetTheme: Theme, mode: IconColorMode) => {
    if (targetTheme === 'dark') {
      setIconColorModeDark(mode);
    } else {
      setIconColorModeLight(mode);
    }
  };

  const resetIconColorForTheme = (targetTheme: Theme) => {
    if (targetTheme === 'dark') {
      setIconColorModeDark('auto');
    } else {
      setIconColorModeLight('auto');
    }
  };

  // Values adapted to the active theme for backwards compatibility.
  const customIconColor = theme === 'dark' ? customIconColorDark : customIconColorLight;
  const iconColorMode = theme === 'dark' ? iconColorModeDark : iconColorModeLight;

  const setCustomIconColor = (color: string) => {
    setCustomIconColorForTheme(theme, color);
  };

  const setIconColorMode = (mode: IconColorMode) => {
    setIconColorModeForTheme(theme, mode);
  };

  const resetIconColor = () => {
    resetIconColorForTheme(theme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        iconColorMode,
        customIconColor,
        setIconColorMode,
        setCustomIconColor,
        resetIconColor,
        customIconColorDark,
        customIconColorLight,
        iconColorModeDark,
        iconColorModeLight,
        setCustomIconColorForTheme,
        setIconColorModeForTheme,
        resetIconColorForTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
