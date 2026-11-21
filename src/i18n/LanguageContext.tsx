// Language context + hook.
// - Default: 'en' (English)
// - Persistencia: localStorage `app_language`
// - Cambio: setLanguage() en cualquier consumer, todos los useT() se re-renderizan
// - Interpolación mínima: t('key', { name: 'foo' }) → reemplaza {{name}} por 'foo'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { en, type TranslationKey } from './en';
import { es } from './es';

export type Language = 'en' | 'es';

const STORAGE_KEY = 'app_language';
const DEFAULT_LANGUAGE: Language = 'en';

const dictionaries: Record<Language, Record<string, string>> = { en, es };

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  // t('ctx.delete') → string. Acepta keys arbitrarias pero tipamos las comunes
  // con TranslationKey para tener autocompletado en componentes que las usen.
  t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{{1,2}(\w+)\}{1,2}/g, (_, name) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Estado inicial desde localStorage; si no hay nada, default English.
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    return DEFAULT_LANGUAGE;
  });

  // Sync a localStorage cuando cambia
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // localStorage no disponible (modo privado, quota lleno). Falla silenciosa —
      // el cambio de idioma sigue funcionando en memoria, solo no persiste entre reloads.
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey | string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[language];
      const fallback = dictionaries[DEFAULT_LANGUAGE];
      // 1) Buscar en el idioma actual; 2) fallback a inglés; 3) devolver la key literal
      const template = (dict[key] ?? fallback[key] ?? key) as string;
      return interpolate(template, vars);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
