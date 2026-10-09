import React, { useMemo, useState } from 'react';
import { MapContainer, CircleMarker, Tooltip as MapTip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEarlyWarnings } from './EarlyWarningContext';
import NdviTileLayer, { NdviLegend } from './NdviTileLayer';
import { DISTRICT_COORDS } from '../data/districtCoords';
import { analyseParcel, SEVERITY_COLOR, SEVERITY_ORDER } from '../services/earlyWarning';

const LABEL = {
  healthy:  { en: 'Healthy',  mr: 'निरोगी' },
  watch:    { en: 'Watch',    mr: 'निरीक्षण' },
  warning:  { en: 'Warning',  mr: 'इशारा' },
  critical: { en: 'Critical', mr: 'गंभीर' },
};


/** Parcels carry no lat/lng — place each near its district centre, stable per parcel. */
function parcelLatLng(p, i) {
  if (p.lat != null && p.lng != null) return [+p.lat, +p.lng];
  const base = DISTRICT_COORDS[p.district] || DISTRICT_COORDS.Satara;
  const a = (i * 2.399) % (2 * Math.PI); // golden-angle spread
  const r = 0.004 + 0.0035 * (i % 5);
  return [base[0] + Math.sin(a) * r, base[1] + Math.cos(a) * r];
}

export default function EarlyWarningPanel({ theme, lang }) {
  const mr = lang === 'mr';
  const { parcels, isDemo } = useEarlyWarnings();
  const [sel, setSel] = useState(0);

  const rows = useMemo(() => parcels.map((p, i) => ({ p, i, a: analyseParcel(p), pos: parcelLatLng(p, i) })), [parcels]);
  const sorted = useMemo(() => [...rows].sort((x, y) => SEVERITY_ORDER[y.a.level] - SEVERITY_ORDER[x.a.level] || x.a.z - y.a.z), [rows]);
  const current = rows[Math.min(sel, rows.length - 1)];
  const counts = rows.reduce((m, r) => ({ ...m, [r.a.level]: (m[r.a.level] || 0) + 1 }), {});

  if (!current) return null;
  const { a } = current;
  const color = SEVERITY_COLOR[a.level];
  const card = { background: theme.card, borderRadius: 20, padding: 24, boxShadow: theme.shadow, border: `1px solid ${theme.border}` };

  return (
    <div id="early-warning" style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 260px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 6px', color: theme.text }}>
            {mr ? 'पीक तणाव पूर्वसूचना' : 'Crop Stress Early Warning'}
          </h2>
          <p style={{ fontSize: 13, color: theme.textDim, margin: 0, lineHeight: 1.55 }}>
            {mr
              ? 'प्रत्येक शेताचा NDVI त्या पिकाच्या ऐतिहासिक हंगामी सरासरीशी तुलना करून असामान्य घसरण लवकर ओळखली जाते.'
              : "Each field's NDVI is compared with that crop's historical seasonal baseline so abnormal decline is flagged weeks before yield loss."}
            {isDemo && <span style={{ color: theme.textMuted }}> {mr ? '(डेमो शेते)' : '(demo fields)'}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['critical', 'warning', 'watch', 'healthy'].map((l) => (
            <div key={l} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${SEVERITY_COLOR[l]}55`, background: `${SEVERITY_COLOR[l]}14`, fontSize: 12, color: theme.text, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[l] }} />
              {counts[l] || 0} {LABEL[l][mr ? 'mr' : 'en']}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Field list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
          {sorted.map(({ p, i, a: ra }) => {
            const c = SEVERITY_COLOR[ra.level];
            const active = i === sel;
            return (
              <button key={i} onClick={() => setSel(i)}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: active ? theme.cardAlt : 'transparent', border: `1px solid ${active ? c : theme.border}`, color: theme.text }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.crop ? String(p.crop).split('/')[0].trim() : '—'} · {mr ? 'गट' : 'Gat'} {p.gutNo || p.gatNumber || i + 1}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{LABEL[ra.level][mr ? 'mr' : 'en']}</span>
                </div>
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>
                  {[p.village, p.district].filter(Boolean).join(', ')} · NDVI {ra.ndvi.toFixed(2)} ({ra.z > 0 ? '+' : ''}{ra.z}σ)
                </div>
              </button>
            );
          })}
        </div>

        {/* Chart + advice */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color }}>{a.ndvi.toFixed(2)}</div>
            <div style={{ fontSize: 12, color: theme.textDim }}>
              NDVI · {mr ? 'सरासरी' : 'baseline'} {a.baseline.toFixed(2)} · {mr ? 'सरासरीपेक्षा' : 'vs baseline'} {a.ndvi - a.baseline < 0 ? '−' : '+'}{Math.abs(a.ndvi - a.baseline).toFixed(2)}
            </div>
          </div>
          <div style={{ width: '100%', height: 190 }}>
            <ResponsiveContainer>
              <ComposedChart data={a.series.map((s) => ({ ...s, band: [s.low, s.high] }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={1} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12 }}
                  formatter={(v, n) => (Array.isArray(v) ? [`${v[0].toFixed(2)} – ${v[1].toFixed(2)}`, mr ? 'सामान्य श्रेणी' : 'Normal range'] : [v, n])} />
                <Area dataKey="band" stroke="none" fill="#22c55e" fillOpacity={0.14} isAnimationActive={false} name="normal" />
                <Line dataKey="base" stroke={theme.textMuted} strokeDasharray="4 4" dot={false} strokeWidth={1.5} name={mr ? 'ऐतिहासिक सरासरी' : 'Baseline'} isAnimationActive={false} />
                <Line dataKey="ndvi" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} name="NDVI" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted, margin: '2px 0 10px' }}>
            {mr ? 'हिरवा पट्टा = ऐतिहासिक सामान्य श्रेणी (±२σ). रेषा त्याखाली गेल्यास शेत ताणाखाली आहे.' : 'Green band = historical normal range (±2σ). A line dropping below it means the field is under stress.'}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: `${color}14`, border: `1px solid ${color}44`, fontSize: 13, lineHeight: 1.55, color: theme.text }}>
            {a.level === 'healthy'
              ? (mr ? 'हे शेत सामान्य श्रेणीत आहे. कोणतीही कृती आवश्यक नाही.' : 'This field is within its normal range. No action needed.')
              : (() => {
                  const al = { drought: { en: 'Gradual NDVI decline — consistent with moisture/drought stress. Irrigate if possible and check soil moisture.', mr: 'NDVI हळूहळू घटत आहे — पाण्याचा ताण/दुष्काळाची लक्षणे. शक्य असल्यास सिंचन करा व जमिनीतील ओलावा तपासा.' },
                    pest: { en: 'Sudden NDVI drop — possible pest or disease outbreak. Scout the field this week and consult your krishi officer.', mr: 'NDVI अचानक घटला — कीड/रोगाचा प्रादुर्भाव शक्य. या आठवड्यात शेताची पाहणी करा व कृषी अधिकाऱ्यांचा सल्ला घ्या.' },
                    generic: { en: 'Trending below the seasonal baseline. Keep monitoring.', mr: 'हंगामी सरासरीपेक्षा कमी दिसत आहे. निरीक्षण सुरू ठेवा.' } }[a.cause];
                  return al[mr ? 'mr' : 'en'];
                })()}
          </div>
        </div>

        {/* Field-level early-warning map */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${theme.border}`, minHeight: 300, background: '#0f172a' }}>
          <MapContainer key={`${current.pos[0]}${current.pos[1]}`} center={current.pos} zoom={14} maxZoom={19} style={{ width: '100%', height: '100%', minHeight: 300 }} scrollWheelZoom={false} zoomControl attributionControl={false}>
            <NdviTileLayer />
            {rows.map(({ p, i, a: ra, pos }) => (
              <CircleMarker key={i} center={pos} radius={i === sel ? 11 : 8}
                pathOptions={{ color: '#fff', weight: i === sel ? 3 : 2, fillColor: SEVERITY_COLOR[ra.level], fillOpacity: 0.95 }}
                eventHandlers={{ click: () => setSel(i) }}>
                <MapTip>{p.crop ? String(p.crop).split('/')[0].trim() : ''} · {LABEL[ra.level][mr ? 'mr' : 'en']}</MapTip>
              </CircleMarker>
            ))}
          </MapContainer>
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1000, background: 'rgba(0,0,0,0.78)', color: '#86efac', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', padding: '4px 10px', borderRadius: 6, pointerEvents: 'none' }}>
            {mr ? 'पूर्वसूचना नकाशा · NDVI' : 'EARLY-WARNING MAP · NDVI'}
          </div>
          <NdviLegend />
        </div>
      </div>
    </div>
  );
}
