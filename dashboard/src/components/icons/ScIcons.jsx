import React from 'react';

const stroke = (c) => ({
  stroke: c,
  strokeWidth: 1.75,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

/** Bottom tab bar + UI: stroke icons, no emoji */
export function NavIcon({ name, size = 22, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 };
  const p = stroke(color);

  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <rect x="3" y="3" width="7" height="9" rx="1.5" {...p} />
          <rect x="14" y="3" width="7" height="5" rx="1.5" {...p} />
          <rect x="14" y="11" width="7" height="10" rx="1.5" {...p} />
          <rect x="3" y="15" width="7" height="6" rx="1.5" {...p} />
        </svg>
      );
    case 'verify':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <circle cx="12" cy="12" r="2" {...p} />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" {...p} />
          <path d="M6.34 6.34l1.77 1.77M15.89 15.89l1.77 1.77M6.34 17.66l1.77-1.77M15.89 8.11l1.77-1.77" {...p} />
          <circle cx="12" cy="12" r="7.5" strokeDasharray="3.5 3" {...p} />
        </svg>
      );
    case 'weather':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" {...p} />
          <circle cx="12" cy="12" r="4" {...p} />
        </svg>
      );
    case 'insurance':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p} />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <circle cx="12" cy="8" r="4" {...p} />
          <path d="M6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" {...p} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden>
          <circle cx="12" cy="12" r="9" {...p} />
        </svg>
      );
  }
}

export function IconSun({ size = 18, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block' };
  const p = stroke(color);
  return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <circle cx="12" cy="12" r="4" {...p} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" {...p} />
    </svg>
  );
}

export function IconMoon({ size = 18, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block' };
  const p = stroke(color);
  return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" {...p} />
    </svg>
  );
}

export function IconSend({ size = 20, color = '#111' }) {
  const s = { width: size, height: size, display: 'block' };
  const p = stroke(color);
  return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...p} />
    </svg>
  );
}

export function IconX({ size = 22, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block' };
  const p = stroke(color);
  return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" {...p} />
    </svg>
  );
}

export function IconRayaAssistant({ size = 26, color = '#111' }) {
  const s = { width: size, height: size, display: 'block' };
  const p = stroke(color);
  return (
    <svg viewBox="0 0 24 24" style={s} aria-hidden>
      <path d="M4 5h16a2 2 0 012 2v7a2 2 0 01-2 2h-5.5L9 20v-4H4a2 2 0 01-2-2V7a2 2 0 012-2z" {...p} />
      <circle cx="9" cy="10" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="10" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="1" fill={color} stroke="none" />
    </svg>
  );
}
