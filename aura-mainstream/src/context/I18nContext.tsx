import { createContext, useContext, type ReactNode } from 'react';
import { en } from '@/i18n/en';

// 2026-05-11: locked to English. Chinese (zh) was removed per Zhuoyu to keep
// the demo single-locale. The Locale type is kept (as a literal union) so any
// remaining `setLocale('zh' | 'en')` callsites still typecheck, but switching
// to a non-en locale is now a no-op. The Settings "Language" section was also
// removed alongside this.
type Locale = 'en';
type Translations = typeof en;

interface I18nContextType {
  locale: Locale;
  /** No-op since the app is single-locale. Kept so callers don't break. */
  setLocale: (l: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Wipe any legacy persisted locale so old browsers don't drag zh in.
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem('aura-locale'); } catch { /* ignore */ }
  }
  return (
    <I18nContext.Provider value={{ locale: 'en', setLocale: () => {}, t: en }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
