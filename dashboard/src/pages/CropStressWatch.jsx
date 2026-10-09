import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComposedChart, Area, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import { useEarlyWarnings } from '../components/EarlyWarningContext';
import Glyph from '../components/icons/Glyph';
import { analyseParcel, baselineAt, phenologyFor, OBS_STEP_DAYS, SEVERITY_COLOR } from '../services/earlyWarning';
import { coordsFor } from '../data/districtCoords';
import DailyFieldData from '../components/DailyFieldData';

const LEVEL = {
  healthy:  { en: 'Healthy',  mr: 'निरोगी' },
  watch:    { en: 'Watch',    mr: 'निरीक्षण' },
  warning:  { en: 'Warning',  mr: 'इशारा' },
  critical: { en: 'Critical', mr: 'गंभीर' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cropName = (p) => String(p.crop || 'Crop').split('/')[0].trim();
const plotOf = (p, i) => p.gutNo || p.gatNumber || p.gat_no || String(i + 1);

/** Live weather + soil context for the field's district (Open-Meteo, no key). */
function useFieldWeather(district) {
  const [w, setW] = useState(null);
  useEffect(() => {
    let off = false;
    const [lat, lon] = coordsFor(district);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`
      + '&hourly=soil_moisture_0_to_7cm&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration'
      + '&past_days=14&forecast_days=3&timezone=Asia%2FKolkata')
      .then((r) => r.json())
      .then((d) => {
        if (off || !d.daily) return;
        const sum = (a, x, y) => a.slice(x, y).reduce((s, v) => s + (v || 0), 0);
        const idx = Math.max(0, d.hourly.time.findIndex((t) => t >= d.current.time));
        // one row per day (14 past, today, 2 forecast); soil moisture is the daily mean of the hourly values
        const todayStr = d.current.time.slice(0, 10);
        const soilBy = {};
        d.hourly.time.forEach((t, i) => { const v = d.hourly.soil_moisture_0_to_7cm?.[i]; if (v != null) (soilBy[t.slice(0, 10)] ||= []).push(v); });
        const days = d.daily.time.map((date, i) => ({
          date, tmax: d.daily.temperature_2m_max[i], tmin: d.daily.temperature_2m_min[i],
          rain: d.daily.precipitation_sum[i] || 0, et0: d.daily.et0_fao_evapotranspiration[i] || 0,
          soil: soilBy[date] ? soilBy[date].reduce((x, y) => x + y, 0) / soilBy[date].length : null,
          future: date > todayStr, today: date === todayStr,
        }));
        setW({
          days,
          rain14: sum(d.daily.precipitation_sum, 0, 14),
          rainNext3: sum(d.daily.precipitation_sum, 14, 17),
          maxT: Math.max(...d.daily.temperature_2m_max.slice(10, 17)),
          et0: sum(d.daily.et0_fao_evapotranspiration, 14, 17),
          soil: d.hourly.soil_moisture_0_to_7cm?.[idx] ?? null,
          wind: d.current.wind_speed_10m,
        });
      }).catch(() => {});
    return () => { off = true; };
  }, [district]);
  return w;
}

function Section({ title, sub, children, theme, right }) {
  return (
    <section style={{ background: theme.card, borderRadius: 24, border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>{title}</h2>
          {sub && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 4 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function CropStressWatch() {
  const { theme } = useTheme();
  const { lang } = useLang();
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const navigate = useNavigate();
  const { parcels, claims, isDemo } = useEarlyWarnings();
  const [sel, setSel] = useState(0);

  const rows = useMemo(() => parcels.map((p, i) => ({ p, i, a: analyseParcel(p) })), [parcels]);
  const cur = rows[Math.min(sel, rows.length - 1)];
  const weather = useFieldWeather(cur?.p.district || 'Pune');

  if (!cur) return null;
  const { p, a } = cur;
  const color = SEVERITY_COLOR[a.level];
  const crop = cropName(p);
  const plot = plotOf(p, cur.i);
  const last = a.series[a.series.length - 1];
  const dev = last.ndvi - last.base;                     // NDVI below/above normal
  const health = Math.round(clamp(100 - Math.max(0, -a.z) * 22, 5, 100));

  // growth stage relative to this crop's canopy peak
  const ph = phenologyFor(p.crop);
  const rel = (a.series.length - 1) - ph.peakAt;
  const stage = rel < -3 ? ['Early growth', 'सुरुवातीची वाढ'] : rel < -1 ? ['Vegetative', 'शाखीय वाढ'] : rel <= 1.5 ? ['Peak canopy / flowering', 'पूर्ण वाढ / फुलोरा'] : rel <= 4 ? ['Grain / pod filling', 'दाणे/शेंगा भरणे'] : ['Ripening', 'पक्वता'];
  const das = (a.series.length - 1) * OBS_STEP_DAYS;

  // 30-day outlook by extrapolating the recent anomaly trend
  const proj = [1, 2, 3].map((k) => {
    const nextBase = baselineAt(p.crop, a.series.length - 1 + k).mean;
    return { label: `+${k * OBS_STEP_DAYS}d`, proj: clamp(nextBase + dev + a.trend * k, 0.05, 0.95) };
  });
  const chart = [...a.series.map((s) => ({ ...s, band: [s.low, s.high] })), ...proj.map((x) => ({ label: x.label, proj: x.proj }))];
  chart[a.series.length - 1].proj = last.ndvi; // connect the dashed projection to today
  const projEnd = proj[2].proj;

  // yield-at-risk (indicative): relative NDVI deficit scaled to a yield range
  const deficit = Math.max(0, (last.base - last.ndvi) / last.base);
  const yLow = Math.round(clamp(deficit * 40, 0, 60));
  const yHigh = Math.round(clamp(deficit * 80, 0, 70));

  // alert history: every observation that fell outside the normal range
  const history = a.series.map((s) => ({ ...s, z: (s.ndvi - s.base) / s.std })).filter((s) => s.z <= -1).reverse();
  const zBars = a.series.map((s) => ({ label: s.label, z: Math.round(((s.ndvi - s.base) / s.std) * 10) / 10 }));

  // diagnosis evidence
  const evidence = [
    L(`NDVI is ${last.ndvi.toFixed(2)} against a normal ${last.base.toFixed(2)} for this stage (${dev < 0 ? '' : '+'}${dev.toFixed(2)}).`, `NDVI ${last.ndvi.toFixed(2)} आहे, या टप्प्यासाठी सामान्य ${last.base.toFixed(2)} (${dev < 0 ? '' : '+'}${dev.toFixed(2)}).`),
    L(`That is ${Math.abs(a.z)} standard deviations ${a.z < 0 ? 'below' : 'above'} the historical range for ${crop}.`, `${crop} च्या ऐतिहासिक श्रेणीपेक्षा हे ${Math.abs(a.z)} σ ${a.z < 0 ? 'कमी' : 'जास्त'} आहे.`),
    a.recentDrop > 0.03 ? L(`Over the last 30 days the field lost ${a.recentDrop.toFixed(2)} NDVI relative to normal.`, `गेल्या ३० दिवसांत सामान्याच्या तुलनेत ${a.recentDrop.toFixed(2)} NDVI घट झाली.`) : L('No sharp drop in the last 30 days.', 'गेल्या ३० दिवसांत तीव्र घट नाही.'),
    a.cause === 'drought' ? L('The decline is gradual, the typical signature of moisture stress.', 'घट हळूहळू आहे, हे पाण्याच्या ताणाचे सामान्य लक्षण आहे.')
      : a.cause === 'pest' ? L('The fall was abrupt, the typical signature of pest or disease damage.', 'घट अचानक झाली, हे कीड/रोगाचे सामान्य लक्षण आहे.') : null,
    weather && (a.cause === 'drought' || a.level === 'healthy') ? L(`Rain in the last 14 days was ${weather.rain14.toFixed(0)} mm${weather.rain14 < 15 ? ', which is low' : ''}.`, `गेल्या १४ दिवसांत पाऊस ${weather.rain14.toFixed(0)} मिमी${weather.rain14 < 15 ? ', जो कमी आहे' : ''}.`) : null,
  ].filter(Boolean);

  // action plan: what to do and by when
  const wet = weather && weather.rainNext3 >= 10;
  const plan = a.level === 'healthy' ? [
    [L('This week', 'या आठवड्यात'), L('Keep your normal irrigation and fertiliser schedule. No stress detected.', 'नेहमीचे सिंचन व खत वेळापत्रक चालू ठेवा. तणाव आढळला नाही.')],
    [L('Next 10 days', 'पुढील १० दिवस'), L('Check back after the next satellite pass for any change.', 'पुढील उपग्रह नोंदीनंतर बदल तपासा.')],
  ] : a.cause === 'pest' ? [
    [L('Today', 'आज'), L('Walk the field and inspect plants at 10 spots, including the underside of leaves and growing points.', 'शेतात फिरून १० ठिकाणी झाडे तपासा, पानांची खालची बाजू व वाढीची टोके पाहा.')],
    [L('Today', 'आज'), L('Take geo-tagged photos of the damage. They are your evidence for a claim.', 'नुकसानीचे जिओ-टॅग फोटो काढा. दाव्यासाठी हा पुरावा आहे.')],
    [L('Within 2 days', '२ दिवसांत'), L('Contact your krishi officer or the Kisan Call Centre (1800-180-1551) before spraying anything.', 'फवारणीपूर्वी कृषी अधिकारी किंवा किसान कॉल सेंटर (1800-180-1551) शी संपर्क करा.')],
    [L('Next 10 days', 'पुढील १० दिवस'), L('Re-check the field after treatment and compare the next satellite reading.', 'उपचारानंतर शेत पुन्हा तपासा व पुढील उपग्रह नोंद पाहा.')],
  ] : [
    [L('Today', 'आज'), wet ? L(`Rain of about ${weather.rainNext3.toFixed(0)} mm is forecast in 3 days. Hold off heavy irrigation and watch soil moisture.`, `३ दिवसांत सुमारे ${weather.rainNext3.toFixed(0)} मिमी पावसाचा अंदाज आहे. जास्त सिंचन थांबवा व ओलावा पाहा.`) : L('Check soil moisture at 15 cm depth. If it is dry, irrigate this evening.', '१५ सेमी खोलीवर ओलावा तपासा. कोरडे असल्यास आज संध्याकाळी सिंचन करा.')],
    [L('This week', 'या आठवड्यात'), L('Irrigate lightly and more often, and mulch to cut evaporation. Delay top-dressing fertiliser until moisture recovers.', 'हलके व जास्त वेळा सिंचन करा, बाष्पीभवन कमी करण्यासाठी आच्छादन वापरा. ओलावा सुधारेपर्यंत वरखत थांबवा.')],
    [L('Within 3 days', '३ दिवसांत'), L('Take geo-tagged photos of wilting or leaf curl for your records.', 'सुकणे/पाने वळणे यांचे जिओ-टॅग फोटो नोंदीसाठी काढा.')],
    [L('Next 10 days', 'पुढील १० दिवस'), L('Compare the next satellite reading. If NDVI keeps falling, prepare a claim.', 'पुढील उपग्रह नोंद पाहा. NDVI घसरत राहिल्यास दावा तयार ठेवा.')],
  ];

  // insurance readiness
  const claimed = claims.find((c) => String(c.gatNumber || c.gutNo) === String(plot));
  const evidenceOk = a.level === 'warning' || a.level === 'critical';
  const checks = [
    [evidenceOk, L('Satellite evidence of stress', 'तणावाचा उपग्रह पुरावा'), evidenceOk ? L(`NDVI ${Math.abs(a.z)}σ below normal`, `NDVI सामान्यापेक्षा ${Math.abs(a.z)}σ कमी`) : L('Not enough deviation yet', 'अजून पुरेसा फरक नाही')],
    [!!claimed, L('Claim filed for this plot', 'या गटासाठी दावा दाखल'), claimed ? L(`Status: ${claimed.status}`, `स्थिती: ${claimed.status}`) : L('No claim yet', 'अद्याप दावा नाही')],
    [false, L('Geo-tagged photos', 'जिओ-टॅग फोटो'), L('Add them when filing the claim', 'दावा करताना जोडा')],
    [false, L('Report within 72 hours of the event', 'घटनेनंतर ७२ तासांत कळवा'), L('PMFBY requires prompt intimation', 'PMFBY साठी वेळेत कळवणे आवश्यक')],
  ];

  const tile = (icon, label, value, sub, c) => (
    <div style={{ padding: '16px 18px', borderRadius: 18, background: theme.name === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: c || theme.textDim, marginBottom: 8 }}>
        <Glyph name={icon} size={15} /><span style={{ fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="sc-page-gutter" style={{ padding: 'clamp(16px, 4vw, 40px)', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 12, color: theme.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{L('Field-by-field diagnosis', 'शेतनिहाय निदान')}</div>
            <h1 style={{ fontSize: 34, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>{L('Crop Stress Watch', 'पीक तणाव निरीक्षण')}</h1>
          </div>
          <button onClick={() => navigate('/land')} style={{ background: theme.accent, color: '#111', border: 'none', borderRadius: 30, padding: '12px 22px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Glyph name="sprout" size={16} /> {L('Add land', 'जमीन जोडा')}
          </button>
        </div>

        {isDemo && (
          <div style={{ padding: '12px 16px', borderRadius: 16, marginBottom: 16, background: theme.accentBg, border: `1px solid ${theme.accentBorder}`, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Glyph name="info" size={16} /> {L('Demo fields shown. Add your own land to get a real diagnosis for your crops.', 'डेमो शेते दाखवली आहेत. तुमच्या पिकांचे खरे निदान मिळवण्यासाठी तुमची जमीन जोडा.')}
          </div>
        )}

        {/* field picker */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 18 }}>
          {rows.map(({ p: fp, i, a: fa }) => {
            const on = i === sel;
            return (
              <button key={i} onClick={() => setSel(i)} style={{ flexShrink: 0, textAlign: 'left', padding: '12px 16px', borderRadius: 18, background: on ? theme.card : 'transparent', border: `1px solid ${on ? SEVERITY_COLOR[fa.level] : theme.border}`, color: theme.text, minWidth: 170 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEVERITY_COLOR[fa.level] }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{cropName(fp)}</span>
                </div>
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>{L('Plot', 'गट')} {plotOf(fp, i)} · {fp.village || fp.district}</div>
              </button>
            );
          })}
        </div>

        {/* header: score + status */}
        <Section theme={theme}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
              <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r="56" fill="none" stroke={theme.border} strokeWidth="11" />
                <circle cx="66" cy="66" r="56" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(health / 100) * 351.8} 351.8`} transform="rotate(-90 66 66)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1 }}>{health}</div>
                <div style={{ fontSize: 10, color: theme.textDim, letterSpacing: '.06em', marginTop: 4 }}>{L('HEALTH SCORE', 'आरोग्य गुण')}</div>
              </div>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 500 }}>{crop}</span>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', background: `${color}22`, color }}>{LEVEL[a.level][mr ? 'mr' : 'en']}</span>
              </div>
              <div style={{ fontSize: 13, color: theme.textDim, marginBottom: 14 }}>
                {L('Plot', 'गट')} {plot} · {[p.village, p.taluka, p.district].filter(Boolean).join(', ')} · {p.area || '?'} ha
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13 }}>
                <div><div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{L('Growth stage', 'वाढीचा टप्पा')}</div>{stage[mr ? 1 : 0]}</div>
                <div><div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{L('Days in season', 'हंगामातील दिवस')}</div>{das}</div>
                <div><div style={{ color: theme.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{L('Trend', 'कल')}</div><span style={{ color: a.trend < -0.01 ? '#ef4444' : a.trend > 0.01 ? '#22c55e' : theme.text }}>{a.trend < -0.01 ? L('Falling', 'घसरत') : a.trend > 0.01 ? L('Recovering', 'सुधारत') : L('Steady', 'स्थिर')}</span></div>
              </div>
            </div>
            <div style={{ flex: '0 1 260px', padding: '16px 18px', borderRadius: 18, background: `${color}14`, border: `1px solid ${color}44` }}>
              <div style={{ fontSize: 10, color: theme.textDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>{L('Yield at risk (indicative)', 'उत्पादन धोका (अंदाजे)')}</div>
              <div style={{ fontSize: 28, fontWeight: 500 }}>{deficit < 0.02 ? '0%' : `${yLow}-${yHigh}%`}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, lineHeight: 1.5 }}>{L('Rough range from the NDVI shortfall. The insurer decides actual loss.', 'NDVI तुटीवरून अंदाजे श्रेणी. प्रत्यक्ष नुकसान विमा कंपनी ठरवते.')}</div>
            </div>
          </div>
        </Section>

        {/* diagnosis + action plan */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          <Section theme={theme} title={L('What we found', 'काय आढळले')} sub={L('Evidence behind this status', 'या स्थितीमागील पुरावा')}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {evidence.map((e, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, lineHeight: 1.55 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, marginTop: 8, flexShrink: 0 }} />{e}
                </li>
              ))}
            </ul>
          </Section>

          <Section theme={theme} title={L('What to do', 'काय करावे')} sub={L('In order of urgency', 'तातडीनुसार क्रम')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {plan.map(([when, what], i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flexShrink: 0, width: 96, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: i === 0 && a.level !== 'healthy' ? color : theme.textDim, paddingTop: 2 }}>{when}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55 }}>{what}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* NDVI chart with projection */}
        <Section theme={theme} title={L('Season curve and 30-day outlook', 'हंगामी वक्र व ३० दिवसांचा अंदाज')}
          sub={L('Solid line is measured NDVI. Dashed line is where it heads if the recent trend continues.', 'घन रेषा मोजलेला NDVI. तुटक रेषा सध्याचा कल चालू राहिल्यास अंदाज.')}
          right={<div style={{ fontSize: 12, color: theme.textDim }}>{L('Outlook', 'अंदाज')}: <b style={{ color: projEnd < last.base - 0.1 ? '#ef4444' : theme.text }}>NDVI {projEnd.toFixed(2)}</b></div>}>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={1} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12 }}
                  formatter={(v, n) => (Array.isArray(v) ? [`${v[0].toFixed(2)} - ${v[1].toFixed(2)}`, L('Normal range', 'सामान्य श्रेणी')] : [typeof v === 'number' ? v.toFixed(2) : v, n])} />
                <Area dataKey="band" stroke="none" fill="#22c55e" fillOpacity={0.14} isAnimationActive={false} name="normal" />
                <Line dataKey="base" stroke={theme.textMuted} strokeDasharray="4 4" dot={false} strokeWidth={1.5} name={L('Baseline', 'सरासरी')} isAnimationActive={false} />
                <Line dataKey="ndvi" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} name="NDVI" isAnimationActive={false} connectNulls={false} />
                <Line dataKey="proj" stroke={color} strokeWidth={2} strokeDasharray="2 5" dot={false} name={L('Outlook', 'अंदाज')} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* real weather + soil context */}
        <Section theme={theme} title={L('Conditions on the ground', 'शेतातील परिस्थिती')} sub={`${p.district || 'Pune'} · ${L('live weather and soil data', 'थेट हवामान व जमीन माहिती')}`}>
          {weather ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {tile('drop', L('Rain, last 14 days', 'पाऊस, १४ दिवस'), `${weather.rain14.toFixed(0)} mm`, weather.rain14 < 15 ? L('Below what crops need', 'पिकाच्या गरजेपेक्षा कमी') : L('Adequate', 'पुरेसा'), weather.rain14 < 15 ? '#f59e0b' : '#3b82f6')}
              {tile('chart', L('Soil moisture (top 7 cm)', 'जमिनीतील ओलावा'), weather.soil != null ? `${Math.round(weather.soil * 100)}%` : '-', weather.soil != null && weather.soil < 0.18 ? L('Dry', 'कोरडी') : L('Moist enough', 'पुरेसा ओलावा'), weather.soil != null && weather.soil < 0.18 ? '#f59e0b' : '#22c55e')}
              {tile('sun', L('Peak temperature, 7 days', 'कमाल तापमान, ७ दिवस'), `${Math.round(weather.maxT)}°C`, weather.maxT >= 38 ? L('Heat stress risk', 'उष्णतेचा धोका') : L('Within tolerance', 'सहन करण्याजोगे'), weather.maxT >= 38 ? '#ef4444' : undefined)}
              {tile('cloudrain', L('Rain, next 3 days', 'पाऊस, पुढील ३ दिवस'), `${weather.rainNext3.toFixed(0)} mm`, L(`Crops will use ~${weather.et0.toFixed(0)} mm`, `पिके सुमारे ${weather.et0.toFixed(0)} मिमी वापरतील`))}
            </div>
          ) : <div style={{ fontSize: 13, color: theme.textDim }}>{L('Loading weather and soil data...', 'हवामान व जमीन माहिती लोड होत आहे...')}</div>}
        </Section>

        <DailyFieldData theme={theme} lang={lang} field={p} analysis={a} weather={weather} crop={crop} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {/* anomaly history */}
          <Section theme={theme} title={L('How far from normal', 'सामान्यापासून फरक')} sub={L('Each bar is one satellite pass. Below -1 is outside the normal range.', 'प्रत्येक पट्टी एक उपग्रह नोंद. -१ खाली म्हणजे सामान्य श्रेणीबाहेर.')}>
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer>
                <ComposedChart data={zBars} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: theme.textDim }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={-1} stroke="#f59e0b" strokeDasharray="4 4" />
                  <ReferenceLine y={-2.5} stroke="#ef4444" strokeDasharray="4 4" />
                  <Tooltip contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v} σ`, L('Deviation', 'फरक')]} />
                  <Bar dataKey="z" radius={[4, 4, 4, 4]} isAnimationActive={false}>
                    {zBars.map((d, i) => <Cell key={i} fill={d.z <= -2.5 ? '#ef4444' : d.z <= -1.7 ? '#f59e0b' : d.z <= -1 ? '#84cc16' : '#22c55e'} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {history.length > 0 && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.slice(0, 4).map((h) => (
                  <div key={h.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: theme.textDim }}>{h.label}</span>
                    <span>NDVI {h.ndvi.toFixed(2)} <span style={{ color: theme.textMuted }}>({h.z.toFixed(1)} σ)</span></span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* insurance readiness */}
          <Section theme={theme} title={L('Insurance readiness', 'विमा तयारी')} sub={L('What you need for a claim on this field', 'या शेतासाठी दाव्याला काय लागेल')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {checks.map(([ok, title, note]) => (
                <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: ok ? '#22c55e' : 'transparent', border: `2px solid ${ok ? '#22c55e' : theme.border}`, color: '#111', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ok ? '✓' : ''}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
                    <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{note}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/claims')} style={{ width: '100%', background: evidenceOk ? theme.text : 'transparent', color: evidenceOk ? theme.bg : theme.text, border: evidenceOk ? 'none' : `1px solid ${theme.border}`, borderRadius: 30, padding: 13, fontSize: 14, fontWeight: 500 }}>
              {claimed ? L('View my claim', 'माझा दावा पहा') : L('File a claim for this field', 'या शेतासाठी दावा दाखल करा')}
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
}
