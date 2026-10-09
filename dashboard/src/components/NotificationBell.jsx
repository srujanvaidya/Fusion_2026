import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEarlyWarnings } from './EarlyWarningContext';
import { SEVERITY_COLOR } from '../services/earlyWarning';

const LEVEL_LABEL = {
  critical: { en: 'Critical', mr: 'गंभीर' },
  warning:  { en: 'Warning',  mr: 'इशारा' },
  watch:    { en: 'Watch',    mr: 'निरीक्षण' },
};

function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function NotificationBell({ theme, lang }) {
  const { alerts, unread, readIds, markRead, markAllRead, permission, enablePush, isDemo } = useEarlyWarnings();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const mr = lang === 'mr';

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={mr ? 'सूचना' : 'Notifications'}
        aria-expanded={open}
        style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: theme.card, border: `1px solid ${theme.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textDim }}
      >
        <BellIcon />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${theme.bg}` }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, width: 'min(380px, calc(100vw - 24px))', maxHeight: '70vh', overflowY: 'auto', background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, boxShadow: theme.shadowHover, zIndex: 500 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.card }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{mr ? 'पीक तणाव इशारे' : 'Crop stress alerts'}</div>
              <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>
                {mr ? 'उपग्रह NDVI विरुद्ध ऐतिहासिक सरासरी' : 'Satellite NDVI vs historical baseline'}{isDemo ? (mr ? ' · डेमो' : ' · demo fields') : ''}
              </div>
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: theme.textDim, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                {mr ? 'सर्व वाचले' : 'Mark all read'}
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: theme.textDim }}>
              {mr ? 'सर्व शेते निरोगी आहेत ✓' : 'All fields look healthy ✓'}
            </div>
          ) : alerts.map((a) => {
            const color = SEVERITY_COLOR[a.level];
            const isRead = readIds.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => { markRead([a.id]); setOpen(false); navigate('/home#early-warning'); setTimeout(() => document.getElementById('early-warning')?.scrollIntoView({ behavior: 'smooth' }), 80); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', background: isRead ? 'transparent' : (theme.name === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'), border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{LEVEL_LABEL[a.level][mr ? 'mr' : 'en']}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{a.crop} · {mr ? 'गट' : 'Gat'} {a.plot}</span>
                  {!isRead && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />}
                </div>
                <div style={{ fontSize: 12, color: theme.textDim, lineHeight: 1.5 }}>{a.message[mr ? 'mr' : 'en']}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 5 }}>
                  NDVI {a.ndvi.toFixed(2)} {mr ? 'विरुद्ध सरासरी' : 'vs baseline'} {a.baseline.toFixed(2)} · z {a.z} · {a.where}
                </div>
              </button>
            );
          })}

          {permission !== 'granted' && permission !== 'unsupported' && permission !== 'denied' && (
            <div style={{ padding: '12px 16px' }}>
              <button onClick={enablePush} style={{ width: '100%', padding: '10px 0', borderRadius: 30, border: 'none', background: theme.text, color: theme.bg, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {mr ? 'फोन/ब्राउझर पुश सूचना चालू करा' : 'Turn on push notifications'}
              </button>
            </div>
          )}
          {permission === 'granted' && (
            <div style={{ padding: '10px 16px', fontSize: 11, color: theme.textMuted }}>{mr ? '✓ गंभीर इशाऱ्यांसाठी पुश सूचना चालू' : '✓ Push on for critical alerts'}</div>
          )}
        </div>
      )}
    </div>
  );
}
