import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import { coordsFor } from '../data/districtCoords';
import { useEarlyWarnings } from '../components/EarlyWarningContext';
import { SEVERITY_COLOR } from '../services/earlyWarning';

/* ── WMO weather codes -> label + icon kind ───────────────────────────── */
export const WMO = (code) => {
  if (code === 0) return { kind: 'clear', en: 'Clear sky', mr: 'निरभ्र आकाश' };
  if (code <= 2) return { kind: 'partly', en: 'Partly cloudy', mr: 'अंशतः ढगाळ' };
  if (code === 3) return { kind: 'cloud', en: 'Overcast', mr: 'ढगाळ' };
  if (code <= 48) return { kind: 'fog', en: 'Fog', mr: 'धुके' };
  if (code <= 57) return { kind: 'rain', en: 'Drizzle', mr: 'रिमझिम' };
  if (code <= 67) return { kind: 'rain', en: 'Rain', mr: 'पाऊस' };
  if (code <= 77) return { kind: 'cloud', en: 'Snow', mr: 'बर्फ' };
  if (code <= 82) return { kind: 'rain', en: 'Rain showers', mr: 'पावसाच्या सरी' };
  return { kind: 'storm', en: 'Thunderstorm', mr: 'वादळी पाऊस' };
};

export function WeatherIcon({ kind, size = 48 }) {
  const sun = <g><circle cx="24" cy="24" r="8" fill="#FCD34D" /><g stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="24" y1="8" x2="24" y2="12" transform={`rotate(${a} 24 24)`} />)}</g></g>;
  const cloud = (fill = '#CBD5E1', dy = 0) => <path transform={`translate(0 ${dy})`} d="M14 36a7 7 0 0 1-.6-14A10 10 0 0 1 33 20a8 8 0 0 1 1 16z" fill={fill} />;
  const drops = <g stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round"><line x1="16" y1="39" x2="14" y2="44" /><line x1="24" y1="39" x2="22" y2="44" /><line x1="32" y1="39" x2="30" y2="44" /></g>;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {kind === 'clear' && sun}
      {kind === 'partly' && <g><g transform="translate(-6 -8) scale(.8)">{sun}</g>{cloud('#E2E8F0', 2)}</g>}
      {kind === 'cloud' && cloud('#CBD5E1')}
      {kind === 'fog' && <g stroke="#94A3B8" strokeWidth="3" strokeLinecap="round"><line x1="10" y1="18" x2="38" y2="18" /><line x1="8" y1="26" x2="40" y2="26" /><line x1="12" y1="34" x2="36" y2="34" /></g>}
      {kind === 'rain' && <g>{cloud('#94A3B8', -4)}{drops}</g>}
      {kind === 'storm' && <g>{cloud('#64748B', -4)}<path d="M25 30l-6 9h5l-2 7 8-11h-5z" fill="#FCD34D" /></g>}
    </svg>
  );
}

const Stat = ({ label, value, sub, theme }) => (
  <div style={{ background: theme.name === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}`, borderRadius: 16, padding: '14px 16px' }}>
    <div style={{ fontSize: 11, color: theme.textDim, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: theme.text, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
  </div>
);

const Meter = ({ label, value, pct, color, theme }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
      <span style={{ color: theme.textDim }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
    <div style={{ height: 6, background: theme.border, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(4, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .6s ease' }} />
    </div>
  </div>
);

const dayName = (iso, mr, i) => (i === 0 ? (mr ? 'आज' : 'Today') : new Date(iso).toLocaleDateString(mr ? 'mr-IN' : 'en-IN', { weekday: 'short' }));

export default function Weather({ profile }) {
  const { theme } = useTheme();
  const { lang } = useLang();
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const navigate = useNavigate();
  const { alerts } = useEarlyWarnings();

  const district = profile?.district || 'Pune';
  const [lat, lon] = coordsFor(district);

  const [wx, setWx] = useState(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setErr(false);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day'
      + '&hourly=temperature_2m,precipitation_probability'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,uv_index_max'
      + '&past_days=7&forecast_days=7&timezone=Asia%2FKolkata';
    fetch(url).then((r) => r.json()).then((d) => { setWx(d); setLoading(false); }).catch(() => { setErr(true); setLoading(false); });
  }, [lat, lon]);
  useEffect(() => { load(); }, [load]);

  const m = useMemo(() => {
    if (!wx?.daily) return null;
    const d = wx.daily;
    const pastN = 7; // first 7 entries are past days
    const sum = (arr, a, b) => arr.slice(a, b).reduce((s, v) => s + (v || 0), 0);
    const rainPast7 = sum(d.precipitation_sum, 0, pastN);
    const rainNext3 = sum(d.precipitation_sum, pastN, pastN + 3);
    const et0Next3 = sum(d.et0_fao_evapotranspiration, pastN, pastN + 3);
    const cur = wx.current;
    const forecast = d.time.slice(pastN).map((t, i) => ({
      iso: t, i, code: d.weather_code[pastN + i], max: Math.round(d.temperature_2m_max[pastN + i]), min: Math.round(d.temperature_2m_min[pastN + i]),
      rain: Math.round((d.precipitation_sum[pastN + i] || 0) * 10) / 10, pop: d.precipitation_probability_max[pastN + i] ?? 0,
    }));
    // next 24h hourly strip from "now"
    const nowIdx = Math.max(0, wx.hourly.time.findIndex((t) => t >= cur.time));
    const hourly = wx.hourly.time.slice(nowIdx, nowIdx + 24).map((t, i) => ({
      h: new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }).toUpperCase(),
      temp: Math.round(wx.hourly.temperature_2m[nowIdx + i]), pop: wx.hourly.precipitation_probability[nowIdx + i] ?? 0,
    }));
    const maxT = Math.max(...forecast.slice(0, 3).map((f) => f.max));
    const uv = d.uv_index_max[pastN];

    const drought = rainPast7 < 5 && et0Next3 - rainNext3 > 10;
    const flood = rainNext3 > 60 || cur.precipitation > 20;
    const heat = maxT >= 38;
    const sprayOk = cur.wind_speed_10m < 15 && (forecast[0].pop < 30);
    const irrigDeficit = Math.max(0, et0Next3 - rainNext3);
    const level = flood || (drought && heat) ? 'critical' : drought || heat ? 'warning' : 'healthy';
    return { cur, forecast, hourly, rainPast7, rainNext3, et0Next3, irrigDeficit, maxT, uv, drought, flood, heat, sprayOk, level };
  }, [wx]);

  const card = { background: theme.card, borderRadius: 24, padding: 24, border: `1px solid ${theme.border}`, boxShadow: theme.shadow };
  const h2 = { fontSize: 16, fontWeight: 500, color: theme.text, margin: 0 };
  const cond = m ? WMO(m.cur.weather_code) : null;

  const advisories = m ? [
    { ok: m.sprayOk, title: L('Spraying', 'फवारणी'), text: m.sprayOk ? L('Good window — wind is calm and rain is unlikely today.', 'चांगली वेळ — वारा कमी व आज पावसाची शक्यता कमी.') : L('Avoid spraying — wind or rain will cause drift/wash-off.', 'फवारणी टाळा — वारा/पावसामुळे औषध वाहून जाईल.') },
    { ok: m.irrigDeficit < 10, title: L('Irrigation', 'सिंचन'), text: m.irrigDeficit < 10 ? L('Soil water balance is fine for the next 3 days.', 'पुढील ३ दिवस जमिनीतील ओलावा पुरेसा आहे.') : L(`Crops will lose ~${m.irrigDeficit.toFixed(0)} mm more than rain supplies in 3 days — plan irrigation.`, `३ दिवसांत पावसापेक्षा सुमारे ${m.irrigDeficit.toFixed(0)} मिमी जास्त पाणी लागेल — सिंचनाचे नियोजन करा.`) },
    { ok: !m.heat, title: L('Heat stress', 'उष्णतेचा ताण'), text: !m.heat ? L(`Peak ${m.maxT}°C in the next 3 days — within crop tolerance.`, `पुढील ३ दिवसांत कमाल ${m.maxT}°C — पिकांसाठी सुरक्षित.`) : L(`Peak ${m.maxT}°C expected — irrigate in the evening and mulch.`, `कमाल ${m.maxT}°C अपेक्षित — संध्याकाळी सिंचन करा व आच्छादन वापरा.`) },
  ] : [];

  return (
    <div className="sc-page-gutter" style={{ padding: 'clamp(16px, 4vw, 40px)', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="sc-weather-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: theme.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{L('Hyper-local climate intelligence', 'स्थानिक हवामान माहिती')}</div>
            <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>{L('Weather & Field Advisory', 'हवामान व शेती सल्ला')}</h1>
          </div>
          <button onClick={load} style={{ background: theme.accent, color: '#111', border: 'none', borderRadius: 30, padding: '12px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ↻ {L('Refresh', 'रिफ्रेश')}
          </button>
        </div>

        {err && <div style={{ ...card, color: theme.danger, marginBottom: 20 }}>{L('Could not reach the weather service. Check your connection and refresh.', 'हवामान सेवेशी संपर्क होऊ शकला नाही. कृपया रिफ्रेश करा.')}</div>}
        {loading && !m && <div style={{ ...card, color: theme.textDim }}>{L('Loading live conditions…', 'हवामान माहिती लोड होत आहे…')}</div>}

        {m && (
          <>
            {/* Hero + tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div style={{ ...card, padding: 28, background: theme.name === 'dark' ? 'linear-gradient(145deg, #1d3a2b 0%, #16221A 60%)' : 'linear-gradient(145deg, #e8f3e2 0%, #ffffff 65%)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, color: theme.textDim, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 4px rgba(34,197,94,0.18)' }} />
                      {district}, Maharashtra · {L('live', 'थेट')}
                    </div>
                    <div style={{ fontSize: 84, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, margin: '18px 0 6px' }}>
                      {Math.round(m.cur.temperature_2m)}<span style={{ fontSize: 32, verticalAlign: 'top', color: theme.textDim }}>°C</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{cond[mr ? 'mr' : 'en']}</div>
                    <div style={{ fontSize: 13, color: theme.textDim, marginTop: 4 }}>{L('Feels like', 'जाणवते')} {Math.round(m.cur.apparent_temperature)}°C · {L('H', 'कमाल')} {m.forecast[0].max}° · {L('L', 'किमान')} {m.forecast[0].min}°</div>
                  </div>
                  <WeatherIcon kind={cond.kind} size={92} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
                <Stat theme={theme} label={L('Humidity', 'आर्द्रता')} value={`${m.cur.relative_humidity_2m}%`} />
                <Stat theme={theme} label={L('Wind', 'वारा')} value={`${m.cur.wind_speed_10m} km/h`} />
                <Stat theme={theme} label={L('Rain · last 7d', 'पाऊस · ७ दिवस')} value={`${m.rainPast7.toFixed(1)} mm`} />
                <Stat theme={theme} label={L('Rain · next 3d', 'पाऊस · पुढील ३ दिवस')} value={`${m.rainNext3.toFixed(1)} mm`} />
                <Stat theme={theme} label={L('UV index', 'UV निर्देशांक')} value={m.uv?.toFixed(0) ?? '–'} sub={m.uv >= 8 ? L('Very high', 'खूप जास्त') : m.uv >= 6 ? L('High', 'जास्त') : L('Moderate', 'मध्यम')} />
                <Stat theme={theme} label={L('Crop water use · 3d', 'पिकाचा पाणी वापर · ३ दिवस')} value={`${m.et0Next3.toFixed(0)} mm`} />
              </div>
            </div>

            {/* 7-day strip */}
            <div style={{ ...card, marginBottom: 20 }}>
              <h2 style={{ ...h2, marginBottom: 16 }}>{L('7-day forecast', '७ दिवसांचा अंदाज')}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 10 }}>
                {m.forecast.map((f, i) => {
                  const w = WMO(f.code);
                  return (
                    <div key={f.iso} style={{ textAlign: 'center', padding: '14px 8px', borderRadius: 18, background: i === 0 ? theme.accentBg : 'transparent', border: `1px solid ${i === 0 ? theme.accentBorder : theme.border}` }}>
                      <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 8 }}>{dayName(f.iso, mr, i)}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><WeatherIcon kind={w.kind} size={38} /></div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{f.max}°<span style={{ color: theme.textMuted, fontWeight: 400 }}> {f.min}°</span></div>
                      <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 4 }}> {f.pop}% · {f.rain}mm</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
              {/* Hourly chart */}
              <div style={{ ...card, minWidth: 0 }}>
                <h2 style={{ ...h2, marginBottom: 4 }}>{L('Next 24 hours', 'पुढील २४ तास')}</h2>
                <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 8 }}>{L('Temperature and chance of rain', 'तापमान व पावसाची शक्यता')}</div>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={m.hourly} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wxT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.accent} stopOpacity={0.45} /><stop offset="100%" stopColor={theme.accent} stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                      <XAxis dataKey="h" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={3} />
                      <YAxis yAxisId="t" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                      <YAxis yAxisId="p" orientation="right" hide domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12 }} />
                      <Bar yAxisId="p" dataKey="pop" name={L('Rain %', 'पाऊस %')} fill="#60a5fa" fillOpacity={0.35} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Area yAxisId="t" type="monotone" dataKey="temp" name="°C" stroke={theme.accent} strokeWidth={2.5} fill="url(#wxT)" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Advisories */}
              <div style={card}>
                <h2 style={{ ...h2, marginBottom: 16 }}>{L('Field advisory', 'शेती सल्ला')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {advisories.map((a) => (
                    <div key={a.title} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 16, background: a.ok ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.1)', border: `1px solid ${a.ok ? 'rgba(34,197,94,0.22)' : 'rgba(245,158,11,0.3)'}` }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: a.ok ? '#22c55e' : '#f59e0b', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{a.ok ? '✓' : '!'}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: theme.textDim, lineHeight: 1.5, marginTop: 2 }}>{a.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Risk + crop stress link */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              <div style={card}>
                <h2 style={{ ...h2, marginBottom: 20 }}>{L('Disaster thresholds', 'आपत्ती मर्यादा')}</h2>
                <Meter theme={theme} label={L('Drought stress', 'दुष्काळ ताण')} value={m.drought ? L('Elevated', 'वाढलेला') : L('Normal', 'सामान्य')} pct={(m.irrigDeficit / 30) * 70 + (m.rainPast7 < 5 ? 25 : 0)} color={m.drought ? '#f59e0b' : '#22c55e'} />
                <Meter theme={theme} label={L('Flood accumulation', 'पूरस्थिती')} value={m.flood ? L('Risk', 'धोका') : L('Safe', 'सुरक्षित')} pct={(m.rainNext3 / 60) * 100} color={m.flood ? '#ef4444' : '#3b82f6'} />
                <Meter theme={theme} label={L('Heat stress', 'उष्णता ताण')} value={`${m.maxT}°C`} pct={((m.maxT - 25) / 18) * 100} color={m.heat ? '#ef4444' : '#22c55e'} />
                <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 14, background: theme.name === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', fontSize: 12, color: theme.textDim, lineHeight: 1.55 }}>
                  <b style={{ color: theme.text }}>{L('Policy trigger: ', 'विमा ट्रिगर: ')}</b>
                  {m.level === 'healthy' ? L('weather is below claim thresholds.', 'हवामान दाव्याच्या मर्यादेखाली आहे.') : L('thresholds approaching — document field damage if it occurs.', 'मर्यादा जवळ येत आहे — नुकसान झाल्यास छायाचित्रे नोंदवा.')}
                </div>
              </div>

              <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ ...h2, marginBottom: 6 }}>{L('Crop stress alerts', 'पीक तणाव इशारे')}</h2>
                <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 16 }}>{L('Satellite NDVI vs historical baseline', 'उपग्रह NDVI विरुद्ध ऐतिहासिक सरासरी')}</div>
                {alerts.length === 0 ? (
                  <div style={{ fontSize: 13, color: theme.textDim }}>{L('All fields healthy ✓', 'सर्व शेते निरोगी ✓')}</div>
                ) : alerts.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEVERITY_COLOR[a.level] }} />
                    <div style={{ flex: 1, fontSize: 13 }}>{a.crop} · {L('Gat', 'गट')} {a.plot}</div>
                    <div style={{ fontSize: 12, color: theme.textDim }}>NDVI {a.ndvi.toFixed(2)}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 20 }}>
                  <button onClick={() => navigate('/home#early-warning')} style={{ flex: 1, background: 'transparent', color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 30, padding: 12, fontSize: 13, cursor: 'pointer' }}>{L('View fields', 'शेते पहा')}</button>
                  <button onClick={() => navigate('/claims')} style={{ flex: 1, background: theme.text, color: theme.bg, border: 'none', borderRadius: 30, padding: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{L('File a claim', 'दावा दाखल करा')}</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
