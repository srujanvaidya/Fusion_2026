import React, { useState, useMemo } from 'react';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import DISASTER_RAW from './data/disaster_sample.json';
import SatelliteMapModal from './SatelliteMapModal';

// ── Static data (bundled at build time — no fetch needed) ────────────────────
const ALL_PARCELS = DISASTER_RAW.parcels || [];
const META        = DISASTER_RAW.meta || DISASTER_RAW.metadata || {};
// Make metadata available to map modal
window.__DISASTER_META__ = META;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_META = {
  Healthy: { color: '#16a34a', bg: '#dcfce7',  border: '#16a34a', mr: 'चांगले'  },
  Drought: { color: '#d97706', bg: '#fef3c7',  border: '#d97706', mr: 'दुष्काळ' },
  Flood:   { color: '#2563eb', bg: '#dbeafe',  border: '#2563eb', mr: 'पूर'     },
};

// ── NDVI bar ──────────────────────────────────────────────────────────────────
function NDVIBar({ value, label, theme }) {
  const pct = Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
  const clr = value > 0.5 ? '#16a34a' : value > 0.2 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#111', opacity: 0.6, marginBottom: '6px', fontWeight: 600 }}>
        <span>{label}</span>
        <span style={{ color: clr, fontWeight: 700, opacity: 1 }}>{Number(value).toFixed(3)}</span>
      </div>
      <div style={{ height: '8px', background: theme.inputBg, borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${clr}88, ${clr})`, borderRadius: '4px', transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, border, theme }) {
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '24px', textAlign: 'center', flex: 1, boxShadow: theme.shadow }}>
      <div style={{ fontSize: '40px', fontWeight: 300, color: color, lineHeight: 1, marginBottom: '8px' }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#111', opacity: 0.6, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  );
}

// ── Parcel Detail Drawer ──────────────────────────────────────────────────────
function ParcelDrawer({ parcel, onClose, theme, lang, onShowMap }) {
  if (!parcel) return null;
  const m = STATUS_META[parcel.status] || STATUS_META.Healthy;
  const rows = [
    ['गट / प्लॉट क्र.',  parcel.gat_no],
    ['मालक',             parcel.owner_name],
    ['गाव',              parcel.village],
    ['तालुका',           parcel.taluka],
    ['जिल्हा',           parcel.district],
    ['क्षेत्र',          parcel.area_ha ? `${parcel.area_ha} ha` : '—'],
    ['AI स्थिती',        lang === 'mr' ? m.mr : parcel.status],
    ['विश्वास',          `${Math.round((parcel.confidence || 0) * 100)}%`],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(240,239,233,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: theme.shadow }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 400, color: '#111', letterSpacing: '-0.02em' }}>गट {parcel.gat_no || '—'}</div>
            <div style={{ fontSize: '13px', color: '#111', opacity: 0.6, marginTop: '4px' }}>
              {[parcel.village, parcel.taluka, parcel.district].filter(Boolean).join(', ')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#111', fontSize: '28px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {/* Status badge */}
        <div style={{ background: m.bg, border: `1px solid rgba(0,0,0,0.05)`, borderRadius: '16px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: m.color, marginBottom: '4px' }}>{lang === 'mr' ? m.mr : parcel.status}</div>
            <div style={{ fontSize: '12px', color: '#111', opacity: 0.6, fontWeight: 500 }}>
              AI Prediction · {Math.round((parcel.confidence || 0) * 100)}% Confidence
            </div>
          </div>
          {/* Show Map button */}
          <button onClick={onShowMap}
            style={{ marginLeft: 'auto', padding: '10px 16px', borderRadius: '30px', background: '#111', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            View Satellite Map
          </button>
        </div>

        {/* Info table */}
        <div style={{ border: `1px solid ${theme.border}`, borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)', borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
              <div style={{ width: '45%', padding: '12px 16px', fontSize: '13px', color: '#111', opacity: 0.6, borderRight: `1px solid ${theme.border}` }}>{k}</div>
              <div style={{ flex: 1, padding: '12px 16px', fontSize: '14px', color: '#111', fontWeight: 500 }}>{v || '—'}</div>
            </div>
          ))}
        </div>

        {/* Spectral section */}
        <div style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#111', opacity: 0.6, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Spectral Indices
          </div>
          <NDVIBar value={parcel.current_ndvi}  label="NDVI — Current (T₀)"     theme={theme} />
          <NDVIBar value={parcel.baseline_ndvi} label="NDVI — Baseline (T₋₁)"    theme={theme} />
          <div style={{ borderTop: `1px solid ${theme.border}`, margin: '20px 0 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: '#111', opacity: 0.6, fontWeight: 600 }}>ΔNDVI (Change)</span>
            <span style={{ fontWeight: 700, color: parcel.delta_ndvi < -0.2 ? '#dc2626' : '#16a34a' }}>
              {parcel.delta_ndvi >= 0 ? '+' : ''}{Number(parcel.delta_ndvi).toFixed(3)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#111', opacity: 0.6, fontWeight: 600 }}>ΔSAR σ⁰ (Change, dB)</span>
            <span style={{ fontWeight: 700, color: parcel.delta_sar < -6 ? '#2563eb' : '#111' }}>
              {parcel.delta_sar >= 0 ? '+' : ''}{Number(parcel.delta_sar).toFixed(2)} dB
            </span>
          </div>
        </div>

        {/* Decision explanation */}
        <div style={{ background: m.bg, border: `1px solid rgba(0,0,0,0.05)`, borderRadius: '12px', padding: '16px', fontSize: '13px', color: m.color, lineHeight: 1.6, fontWeight: 500 }}>
          {parcel.status === 'Drought' && 'Severe NDVI drop detected. Crop is under extreme water stress. Intervention recommended.'}
          {parcel.status === 'Flood'   && 'Significant SAR σ⁰ drop — surface water accumulation detected. High probability of flooding.'}
          {parcel.status === 'Healthy' && 'Both NDVI and SAR indices are within normal ranges. Crop is developing optimally.'}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const FILTER_KEYS   = ['All', 'Healthy', 'Drought', 'Flood'];
const FILTER_MR     = { All: 'सर्व', Healthy: 'चांगले', Drought: 'दुष्काळ', Flood: 'पूर' };
const PER_PAGE      = 50;
const ALLOWED_ROLES = ['talathi', 'gram_panchayat', 'field_officer'];

export default function DisasterVerification({ user, profile }) {
  const { theme }   = useTheme();
  const { lang }    = useLang();

  // ── ALL hooks must be at the top — before any conditional return ─────────────
  const [filter, setFilter]     = useState('All');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [selected, setSelected] = useState(null);
  const [mapParcel, setMapParcel] = useState(null);

  const filtered = useMemo(() => {
    let p = ALL_PARCELS;
    if (filter !== 'All') p = p.filter(x => x.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      p = p.filter(x =>
        String(x.gat_no || '').toLowerCase().includes(q) ||
        (x.owner_name || '').toLowerCase().includes(q) ||
        (x.village    || '').toLowerCase().includes(q)
      );
    }
    return p;
  }, [filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const totalH = ALL_PARCELS.filter(p => p.status === 'Healthy').length;
  const totalD = ALL_PARCELS.filter(p => p.status === 'Drought').length;
  const totalF = ALL_PARCELS.filter(p => p.status === 'Flood').length;

  // ── Conditional returns AFTER all hooks ──────────────────────────────────────
  if (profile === null || profile === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexDirection: 'column' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: theme.textDim, fontSize: '14px' }}>Loading profile…</div>
      </div>
    );
  }

  const allowed = ALLOWED_ROLES.includes(profile?.role);

  if (!allowed) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>Access Denied</div>
        <div style={{ fontSize: '14px', color: '#111', opacity: 0.6, maxWidth: '300px', lineHeight: 1.6 }}>
          This page is restricted to authorized field officials only.
        </div>
      </div>
    );
  }

  return (
    <div className="sc-page-gutter" style={{ padding: '20px 40px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div className="sc-desktop-only" style={{ fontSize: '12px', color: '#111', opacity: 0.6, letterSpacing: '0.02em', marginBottom: '4px', fontWeight: 600 }}>Satellite-Driven Intelligence</div>
          <h1 style={{ fontSize: '40px', fontWeight: 400, color: '#111', margin: 0, letterSpacing: '-0.04em' }}>
            AI Disaster Verification
          </h1>
          <div className="sc-desktop-only" style={{ fontSize: '13px', color: '#111', opacity: 0.6, marginTop: '8px' }}>
            {META.model || 'RandomForestClassifier'} · Satara District · {ALL_PARCELS.length} Parcels
          </div>
          <div className="sc-mobile-only sc-mobile-block" style={{ fontSize: '13px', color: '#111', opacity: 0.75, marginTop: '8px', fontWeight: 600 }}>
            {ALL_PARCELS.length} {lang === 'mr' ? 'पार्सल' : 'parcels'} · Satara
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="sc-disaster-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <StatCard label="Total Monitored" value={ALL_PARCELS.length} color="#111"    theme={theme} />
        <StatCard label="Optimal Health"  value={totalH}             color="#16a34a" theme={theme} />
        <StatCard label="Drought Stress"  value={totalD}             color="#d97706" theme={theme} />
        <StatCard label="Flood Detected"  value={totalF}             color="#2563eb" theme={theme} />
      </div>

      {/* AI model info */}
      <div className="sc-desktop-only" style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '24px', marginBottom: '32px', boxShadow: theme.shadow }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Model Specifications</div>
        <div className="sc-disaster-model-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
          {[
            ['Algorithm',     'Random Forest (200 trees)'],
            ['Classes',       'Healthy · Drought · Flood'],
            ['NDVI Formula',  '(B8 − B4) / (B8 + B4)'],
            ['SAR Formula',   'Δσ⁰ = σ⁰_T₀ − σ⁰_T₋₁'],
            ['S-2 Bands',     'Red (B4) + NIR (B8)'],
            ['S-1 Bands',     'VV Backscatter σ⁰'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: theme.inputBg, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#111', opacity: 0.5, fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: '13px', color: '#111', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter + Search */}
      <div className="sc-disaster-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search Gat No, Owner, or Village..."
          style={{ width: '320px', maxWidth: '100%', padding: '12px 16px', background: theme.inputBg, border: `1px solid rgba(0,0,0,0.15)`, borderRadius: '12px', color: '#111', fontSize: '14px', outline: 'none' }}
        />
        <div className="sc-disaster-filter-row" style={{ display: 'flex', gap: '12px' }}>
          {FILTER_KEYS.map(f => {
            const m = STATUS_META[f];
            const active = filter === f;
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(0); }}
                style={{ padding: '10px 20px', borderRadius: '30px', border: `1px solid ${active ? (m?.color || '#111') : 'rgba(0,0,0,0.15)'}`, background: active ? (m?.color || '#111') : 'transparent', color: active ? '#fff' : '#111', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}>
                {lang === 'mr' ? FILTER_MR[f] : f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: '13px', color: '#111', opacity: 0.6, marginBottom: '16px', fontWeight: 500 }}>
        Showing {filtered.length} parcels · Page {safePage + 1} of {totalPages}
      </div>

      {/* Table */}
      <div className="sc-disaster-table" style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', overflow: 'hidden', boxShadow: theme.shadow }}>
        {/* Header row */}
        <div className="sc-disaster-thead" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 80px 80px', padding: '16px 24px', background: theme.inputBg, borderBottom: `1px solid ${theme.border}` }}>
          {['Gat No.', 'Owner · Village', 'Status', 'NDVI', 'ΔSAR'].map(h => (
            <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#111', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {paginated.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px', color: '#111', opacity: 0.5, fontSize: '14px', fontWeight: 500 }}>No parcels matched your criteria.</div>
        ) : (
          paginated.map((p, i) => {
            const m = STATUS_META[p.status] || STATUS_META.Healthy;
            return (
              <div key={`${p.gat_no}-${i}`} onClick={() => setSelected(p)}
                className="sc-disaster-row"
                style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 80px 80px', padding: '16px 24px', borderBottom: i < paginated.length - 1 ? `1px solid ${theme.border}` : 'none', cursor: 'pointer', transition: 'background .15s', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111' }}>{p.gat_no}</div>
                <div>
                  <div style={{ fontSize: '14px', color: '#111', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{p.owner_name || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#111', opacity: 0.6, marginTop: '2px' }}>{[p.village, p.taluka].filter(Boolean).join(', ')}</div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '20px', background: m.bg, color: m.color, fontWeight: 700 }}>
                    {lang === 'mr' ? m.mr : p.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: (p.current_ndvi > 0.5 ? '#16a34a' : p.current_ndvi > 0.2 ? '#d97706' : '#dc2626'), fontWeight: 700 }}>
                  {Number(p.current_ndvi).toFixed(2)}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: p.delta_sar < -6 ? '#2563eb' : '#111' }}>
                  {p.delta_sar >= 0 ? '+' : ''}{Number(p.delta_sar).toFixed(1)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
            style={{ padding: '10px 20px', borderRadius: '30px', background: 'transparent', border: `1px solid rgba(0,0,0,0.2)`, color: '#111', cursor: safePage === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: safePage === 0 ? 0.3 : 1 }}>
            ← Previous
          </button>
          <span style={{ fontSize: '13px', color: '#111', fontWeight: 600, minWidth: '80px', textAlign: 'center' }}>
            {safePage + 1} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
            style={{ padding: '10px 20px', borderRadius: '30px', background: 'transparent', border: `1px solid rgba(0,0,0,0.2)`, color: '#111', cursor: safePage === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: safePage === totalPages - 1 ? 0.3 : 1 }}>
            Next →
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      <ParcelDrawer
        parcel={selected}
        onClose={() => setSelected(null)}
        theme={theme}
        lang={lang}
        onShowMap={() => { setMapParcel(selected); setSelected(null); }}
      />

      {/* Satellite Map Modal */}
      <SatelliteMapModal
        parcel={mapParcel}
        onClose={() => setMapParcel(null)}
        theme={theme}
        lang={lang}
      />
    </div>
  );
}
