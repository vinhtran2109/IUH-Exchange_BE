import { useState, useCallback, useMemo } from 'react';
import vi from './vi.json';
import en from './en.json';

export type Locale = 'vi' | 'en';

const translations: Record<Locale, Record<string, any>> = { vi, en };

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path;
}

const STORAGE_KEY = 'iuh-locale';

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === 'vi' || saved === 'en') ? saved : 'vi';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let value = getNestedValue(translations[locale], key);
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return value;
  }, [locale]);

  const localeNames: Record<Locale, string> = useMemo(() => ({
    vi: '🇻🇳 Tiếng Việt',
    en: '🇬🇧 English',
  }), []);

  return { locale, setLocale, t, localeNames };
}
