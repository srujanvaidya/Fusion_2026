import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import Glyph from './icons/Glyph';
import NdviTileLayer, { NdviLegend } from './NdviTileLayer';
import { WMO, WeatherIcon } from '../pages/Weather';
import { analyseParcel, SEVERITY_COLOR } from '../services/earlyWarning';
import { DISTRICT_COORDS } from '../data/districtCoords';

/** Rural anchor points so fields without saved GPS open on farmland, not in a city centre. */
const FARM_ANCHOR = { Pune: [18.1508, 74.603], Satara: [17.2925, 74.1845] };

const PALETTE = ['#84cc16', '#22c55e', '#14b8a6', '#60a5fa', '#a78bfa', '#f59e0b', '#fb7185'];
const LEVEL = { healthy: ['Healthy', 'निरोगी'], watch: ['Watch', 'निरीक्षण'], warning: ['Warning', 'इशारा'], critical: ['Critical', 'गंभीर'] };

export const plotOf = (p) => p.gatNumber || p.gutNo || p.gat_no || '';
export const cropOf = (p) => String(p.crop || '').split('/')[0].trim();
const areaOf = (p) => parseFloat(p.area) || 0;

const surface = (theme) => ({ background: theme.card, borderRadius: 26, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, position: 'relative', overflow: 'hidden' });
const eyebrow = (theme) => ({ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textDim, fontWeight: 600 });

function Pill({ color, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.03em', background: `${color}22`, color }}>{children}</span>;
}

/* ═══ Land holdings ═══════════════════════════════════════════════════ */
export function LandHoldingsCard({ parcels, theme, lang, isDemo, district, onOpen }) {
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);

  const m = useMemo(() => {
    const rows = parcels.map((p) => ({ p, a: analyseParcel(p) }));
    const area = parcels.reduce((s, p) => s + areaOf(p), 0);
    // crop mix by area (falls back to field count when area is not recorded)
    const mix = new Map();
    parcels.forEach((p) => {
      const c = cropOf(p) || L('Crop not set', 'पीक नाही');
      mix.set(c, (mix.get(c) || 0) + (area ? areaOf(p) : 1));
    });
    const total = [...mix.values()].reduce((s, v) => s + v, 0) || 1;
    const crops = [...mix.entries()].sort((a, b) => b[1] - a[1]).map(([name, v], i) => ({ name, pct: (v / total) * 100, color: PALETTE[i % PALETTE.length] }));
    // average season curve across fields
    const n = rows[0]?.a.series.length || 0;
    const curve = Array.from({ length: n }, (_, i) => ({
      label: rows[0].a.series[i].label,
      ndvi: +(rows.reduce((s, r) => s + r.a.series[i].ndvi, 0) / rows.length).toFixed(3),
      base: +(rows.reduce((s, r) => s + r.a.series[i].base, 0) / rows.length).toFixed(3),
    }));
    const atRisk = rows.filter((r) => r.a.level !== 'healthy').length;
    return { area, crops, curve, atRisk, count: parcels.length };
  }, [parcels, mr]); // eslint-disable-line react-hooks/exhaustive-deps

  const tile = (label, value, sub, color) => (
    <div style={{ flex: '1 1 110px', padding: '14px 16px', borderRadius: 18, background: theme.name === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)', border: `1px solid ${theme.border}` }}>
      <div style={{ ...eyebrow(theme), fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 6, color: color || theme.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ ...surface(theme), padding: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={eyebrow(theme)}>{district}{isDemo ? ` · ${L('demo data', 'डेमो माहिती')}` : ''}</div>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 0', letterSpacing: '-0.02em' }}>{L('Land holdings', 'जमीन धारणा')}</h2>
        </div>
        <button onClick={onOpen} aria-label={L('Open My Land', 'माझी जमीन')} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {tile(L('Fields', 'शेते'), m.count)}
        {tile(L('Total area', 'एकूण क्षेत्र'), m.area ? m.area.toFixed(1) : '—', m.area ? 'ha' : L('not recorded', 'नोंद नाही'))}
        {tile(L('Need attention', 'लक्ष हवे'), m.atRisk, m.atRisk ? L('see Crop Stress Watch', 'पीक तणाव निरीक्षण पहा') : L('all healthy', 'सर्व निरोगी'), m.atRisk ? '#f59e0b' : '#22c55e')}
      </div>

      <div style={{ ...eyebrow(theme), marginBottom: 10 }}>{L('Crop mix', 'पिकांचे प्रमाण')}</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
        {m.crops.map((c) => <div key={c.name} title={c.name} style={{ width: `${c.pct}%`, background: c.color, minWidth: 6 }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 24 }}>
        {m.crops.map((c) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: theme.textDim }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />{c.name} <b style={{ color: theme.text, fontWeight: 600 }}>{Math.round(c.pct)}%</b>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={eyebrow(theme)}>{L('Crop health this season', 'या हंगामातील पीक आरोग्य')}</div>
        <div style={{ fontSize: 11, color: theme.textMuted }}>{L('average NDVI vs normal', 'सरासरी NDVI विरुद्ध सामान्य')}</div>
      </div>
      <div style={{ width: '100%', height: 150 }}>
        <ResponsiveContainer>
          <ComposedChart data={m.curve} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
            <defs>
              <linearGradient id="hsNdvi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={2} />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12 }} />
            <Area dataKey="ndvi" name="NDVI" stroke="#22c55e" strokeWidth={2.5} fill="url(#hsNdvi)" isAnimationActive={false} />
            <Line dataKey="base" name={L('Normal', 'सामान्य')} stroke={theme.textMuted} strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══ Local conditions ════════════════════════════════════════════════ */
export function LocalConditionsCard({ cur, district, theme, lang, onOpen }) {
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const cond = WMO(cur.weather_code ?? 0);
  const sprayOk = cur.wind_speed_10m < 15 && !cur.precipitation;
  const dark = theme.name === 'dark';

  const chip = (icon, label, value) => (
    <div style={{ flex: 1, padding: '12px 10px', borderRadius: 16, textAlign: 'center', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)', border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'center', color: theme.textDim, marginBottom: 6 }}><Glyph name={icon} size={16} /></div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ ...surface(theme), padding: 26, display: 'flex', flexDirection: 'column', background: dark ? 'linear-gradient(160deg, #1f3d2e 0%, #16221A 62%)' : 'linear-gradient(160deg, #e3f1dc 0%, #ffffff 68%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ ...eyebrow(theme), display: 'flex', alignItems: 'center', gap: 6 }}><Glyph name="pin" size={12} />{district}</div>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 0', letterSpacing: '-0.02em' }}>{L('Local conditions', 'स्थानिक परिस्थिती')}</h2>
        </div>
        <WeatherIcon kind={cond.kind} size={54} />
      </div>

      <div style={{ margin: '22px 0 4px', display: 'flex', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 72, fontWeight: 300, letterSpacing: '-0.05em', lineHeight: 1 }}>{Math.round(cur.temperature_2m)}</span>
        <span style={{ fontSize: 26, color: theme.textDim, marginTop: 6 }}>°C</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{cond[mr ? 'mr' : 'en']}</div>
      {cur.apparent_temperature != null && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 3 }}>{L('Feels like', 'जाणवते')} {Math.round(cur.apparent_temperature)}°C</div>}

      <div style={{ display: 'flex', gap: 8, margin: '22px 0 16px' }}>
        {chip('drop', L('Humidity', 'आर्द्रता'), `${cur.relative_humidity_2m}%`)}
        {chip('wind', L('Wind', 'वारा'), `${cur.wind_speed_10m}`)}
        {chip('cloudrain', L('Rain', 'पाऊस'), `${cur.precipitation} mm`)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, background: sprayOk ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.14)', border: `1px solid ${sprayOk ? 'rgba(34,197,94,0.28)' : 'rgba(245,158,11,0.32)'}`, fontSize: 12, lineHeight: 1.45 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sprayOk ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
        {sprayOk ? L('Good window for spraying today.', 'आज फवारणीसाठी चांगली वेळ.') : L('Avoid spraying now: wind or rain will cause drift.', 'आता फवारणी टाळा: वारा/पावसामुळे औषध वाहून जाईल.')}
      </div>

      <button onClick={onOpen} style={{ marginTop: 'auto', paddingTop: 18, background: 'none', border: 'none', color: theme.text, fontSize: 13, fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'underline', textUnderlineOffset: 4 }}>
        {L('Full forecast and field advisory', 'पूर्ण अंदाज व शेती सल्ला')} →
      </button>
    </div>
  );
}

/* ═══ Primary field scan ══════════════════════════════════════════════ */
export function FieldScanCard({ parcels, theme, lang, district, onOpen }) {
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState('sat');
  const p = parcels[Math.min(idx, parcels.length - 1)];
  const a = useMemo(() => (p ? analyseParcel(p) : null), [p]);
  if (!p) return null;

  const base = DISTRICT_COORDS[p.district || district] || DISTRICT_COORDS.Satara;
  // saved GPS if the record has it; otherwise spread fields around the district centre
  const center = p.lat != null && p.lng != null ? [+p.lat, +p.lng] : (FARM_ANCHOR[p.district] ? [FARM_ANCHOR[p.district][0] + idx * 0.003, FARM_ANCHOR[p.district][1] + idx * 0.002] : p.district ? [base[0] + 0.004 + idx * 0.002, base[1] + 0.003] : FARM_ANCHOR.Pune);
  const color = SEVERITY_COLOR[a.level];
  const seg = (m, label) => (
    <button key={m} onClick={() => setMode(m)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 700, background: mode === m ? '#F6EE74' : 'transparent', color: mode === m ? '#111' : '#fff' }}>{label}</button>
  );
  const glass = { background: 'rgba(10,16,12,0.62)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff' };

  return (
    <div className="sc-home-map" style={{ ...surface(theme), minHeight: 420, padding: 0 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapContainer key={`${center.join()}-${mode}`} center={center} zoom={17} maxZoom={19} style={{ width: '100%', height: '100%', minHeight: 420 }} scrollWheelZoom={false} zoomControl={false} attributionControl={false}>
          {mode === 'sat'
            ? <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={19} />
            : <NdviTileLayer />}
          <CircleMarker center={center} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 }} />
        </MapContainer>
      </div>

      <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 1000, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, pointerEvents: 'none' }}>
        <div style={{ ...glass, padding: '7px 13px', borderRadius: 14, fontSize: 11, fontWeight: 700, letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.3)' }} />{L('LIVE FIELD SCAN', 'थेट शेत स्कॅन')}
        </div>
        <div style={{ ...glass, borderRadius: 22, padding: 3, display: 'flex', pointerEvents: 'auto' }}>{seg('sat', L('Satellite', 'उपग्रह'))}{seg('ndvi', 'NDVI')}</div>
      </div>
      {mode === 'ndvi' && <NdviLegend style={{ top: 62, bottom: 'auto', right: 14 }} />}

      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, zIndex: 1000 }}>
        {parcels.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
            {parcels.map((fp, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{ ...glass, flexShrink: 0, padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: i === idx ? 700 : 400, background: i === idx ? 'rgba(246,238,116,0.92)' : glass.background, color: i === idx ? '#111' : '#fff' }}>
                {cropOf(fp) || `${L('Plot', 'गट')} ${plotOf(fp) || i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div style={{ ...glass, borderRadius: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px', minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 500 }}>{cropOf(p) || L('Crop not set', 'पीक नाही')}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{L('Plot', 'गट')} {plotOf(p) || '-'} · {[p.village, p.district].filter(Boolean).join(', ')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: '.06em' }}>{L('AREA', 'क्षेत्र')}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{areaOf(p) ? `${areaOf(p)} ha` : '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: '.06em' }}>NDVI</div>
            <div style={{ fontSize: 15, fontWeight: 600, color }}>{a.ndvi.toFixed(2)}</div>
          </div>
          <Pill color={color}>{LEVEL[a.level][mr ? 1 : 0]}</Pill>
          <button onClick={onOpen} aria-label={L('Open Crop Stress Watch', 'पीक तणाव निरीक्षण')} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Registered fields ═══════════════════════════════════════════════ */
export function RegisteredFieldsCard({ parcels, theme, lang, isDemo, onOpen, onAdd }) {
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const dark = theme.name === 'dark';

  return (
    <div style={{ ...surface(theme), padding: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={eyebrow(theme)}>{parcels.length} {L(parcels.length === 1 ? 'field' : 'fields', 'शेते')}{isDemo ? ` · ${L('demo data', 'डेमो माहिती')}` : ''}</div>
          <h2 style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 0', letterSpacing: '-0.02em' }}>{L('Your registered fields', 'तुमची नोंदणीकृत शेते')}</h2>
        </div>
        <button onClick={onAdd} style={{ padding: '9px 18px', borderRadius: 30, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Glyph name="sprout" size={14} /> {L('Add land', 'जमीन जोडा')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {parcels.slice(0, 5).map((p, i) => {
          const a = analyseParcel(p);
          const color = SEVERITY_COLOR[a.level];
          const crop = cropOf(p);
          const missing = [!crop && L('crop', 'पीक'), !areaOf(p) && L('area', 'क्षेत्र')].filter(Boolean);
          return (
            <button key={i} onClick={onOpen} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 20, background: dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}`, transition: 'transform .2s ease, border-color .2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = theme.border; }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: `${color}1f`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Glyph name="sprout" size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: crop ? theme.text : theme.textMuted }}>{crop || L('Crop not set', 'पीक नाही')}</span>
                  <Pill color={color}>{LEVEL[a.level][mr ? 1 : 0]}</Pill>
                </div>
                <div style={{ fontSize: 12, color: theme.textDim, marginTop: 5, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Glyph name="pin" size={12} />{[p.village, p.taluka, p.district].filter(Boolean).join(', ') || '—'}</span>
                  <span>{L('Plot', 'गट')} {plotOf(p) || '—'}</span>
                </div>
                {missing.length > 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>{L(`Add ${missing.join(' and ')} to get sharper crop advice`, `अचूक सल्ल्यासाठी ${missing.join(' व ')} जोडा`)}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>{areaOf(p) ? areaOf(p) : '—'}<span style={{ fontSize: 12, color: theme.textDim }}>{areaOf(p) ? ' ha' : ''}</span></div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>NDVI {a.ndvi.toFixed(2)}</div>
              </div>
            </button>
          );
        })}
      </div>
      {parcels.length > 5 && <button onClick={onOpen} style={{ marginTop: 14, background: 'none', border: 'none', color: theme.textDim, fontSize: 13, textDecoration: 'underline' }}>{L(`View all ${parcels.length} fields`, `सर्व ${parcels.length} शेते पहा`)}</button>}
    </div>
  );
}
