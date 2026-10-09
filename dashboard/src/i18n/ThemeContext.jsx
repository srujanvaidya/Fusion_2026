import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export const THEMES = {
  light: {
    name: 'light',
    bg:            '#F0EFE9',
    card:          '#FFFFFF',
    cardAlt:       'rgba(255,255,255,0.7)',
    border:        'rgba(0,0,0,0.06)',
    text:          '#111111',
    textDim:       '#666666',
    textMuted:     '#999999',
    accent:        '#F6EE74',       // butter-yellow (same as dark)
    accentText:    '#0E1711',
    accentBg:      'rgba(246,238,116,0.15)',
    accentBorder:  'rgba(246,238,116,0.4)',
    green:         '#22c55e',
    pill:          'transparent',
    pillHover:     'rgba(0,0,0,0.06)',
    pillText:      '#555555',
    pillActiveText:'#111111',
    danger:        '#ef4444',
    dangerBg:      'rgba(239,68,68,0.08)',
    dangerBorder:  'rgba(239,68,68,0.2)',
    warning:       '#f59e0b',
    warningBg:     'rgba(245,158,11,0.08)',
    warningBorder: 'rgba(245,158,11,0.2)',
    info:          '#3b82f6',
    infoBg:        'rgba(59,130,246,0.08)',
    inputBg:       'rgba(0,0,0,0.03)',
    inputBorder:   'rgba(0,0,0,0.08)',
    shadow:        '0 4px 20px rgba(0,0,0,0.04)',
    shadowHover:   '0 8px 30px rgba(0,0,0,0.08)',
    navBg:         '#F0EFE9',
    navBorder:     'rgba(0,0,0,0.05)',
    sectionLabel:  '#888888',
  },
  dark: {
    name: 'dark',
    bg:            '#0E1712',       // deep forest green (from screenshot)
    card:          '#16221A',       // slightly lighter moss card
    cardAlt:       '#1D2D23',
    border:        'rgba(255,255,255,0.07)',
    text:          '#F2F6F4',       // clean soft white
    textDim:       '#92A599',       // muted sage
    textMuted:     '#62776A',
    accent:        '#F6EE74',       // butter-yellow (the "New task" button color)
    accentText:    '#0E1711',
    accentBg:      'rgba(246,238,116,0.12)',
    accentBorder:  'rgba(246,238,116,0.3)',
    green:         '#34D399',
    pill:          'transparent',
    pillHover:     'rgba(255,255,255,0.07)',
    pillText:      '#92A599',
    pillActiveText:'#0E1711',
    danger:        '#FB7185',
    dangerBg:      'rgba(251,113,133,0.1)',
    dangerBorder:  'rgba(251,113,133,0.25)',
    warning:       '#FBBF24',
    warningBg:     'rgba(251,191,36,0.1)',
    warningBorder: 'rgba(251,191,36,0.25)',
    info:          '#60A5FA',
    infoBg:        'rgba(96,165,250,0.1)',
    inputBg:       '#0B1510',
    inputBorder:   'rgba(255,255,255,0.09)',
    shadow:        '0 8px 32px rgba(0,0,0,0.35)',
    shadowHover:   '0 12px 40px rgba(0,0,0,0.5)',
    navBg:         'rgba(14,23,18,0.92)',
    navBorder:     'rgba(255,255,255,0.07)',
    sectionLabel:  '#92A599',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(
    () => localStorage.getItem('skycrop_theme') || 'dark'
  );
  const toggleTheme = useCallback(() => {
    setThemeName(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('skycrop_theme', next);
      return next;
    });
  }, []);
  const theme = THEMES[themeName] || THEMES.dark;
  // Expose the active theme to plain CSS and to the browser chrome (address bar, form controls).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.name;
    root.style.colorScheme = theme.name;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
