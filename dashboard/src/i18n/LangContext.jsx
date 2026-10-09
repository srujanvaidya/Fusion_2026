import React, { createContext, useContext, useState, useCallback } from 'react';
import mr from './mr.js';
import en from './en.js';

const TRANSLATIONS = { mr, en };

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('skycrop_lang') || 'mr');

  const setLang = useCallback((l) => {
    localStorage.setItem('skycrop_lang', l);
    setLangState(l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'mr' ? 'en' : 'mr');
  }, [lang, setLang]);

  // t(key) returns translated string; optional interpolation via {var}
  const t = useCallback((key, vars) => {
    const str = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['en']?.[key] ?? key;
    if (!vars) return str;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
